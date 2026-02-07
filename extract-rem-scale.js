const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'output', 'audit-manifest.json'), 'utf8')
);
const PAGES = manifest.pages.filter(p => p.status === 'ok');

const EXTRACT_FN = `(() => {
  const results = [];
  const TARGET = 'h1,h2,h3,h4,h5,h6,p,a,li,span,strong,em,small,label,button,input,select,textarea,figcaption,blockquote,td,th,dt,dd,nav,footer';
  
  function vis(el) {
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch { return false; }
  }

  function getComponent(el) {
    let n = el;
    for (let i = 0; i < 8 && n; i++) {
      const t = (n.tagName || '').toLowerCase();
      const c = (typeof n.className === 'string') ? n.className.toLowerCase() : '';
      if (t === 'header' || c.includes('site-header')) return 'Header';
      if (t === 'footer' || c.includes('site-footer')) return 'Footer';
      if (t === 'nav' || c.includes('main-nav') || c.includes('menu')) return 'Navegación';
      if (c.includes('hero') || c.includes('entry-header') || c.includes('cover')) return 'Hero';
      if (c.includes('card') || c.includes('title-content') || c.includes('item-post')) return 'Card';
      if (c.includes('accordion')) return 'Accordion';
      if (c.includes('tab') && !c.includes('table')) return 'Tabs';
      if (c.includes('breadcrumb')) return 'Breadcrumb';
      if (c.includes('search')) return 'Search';
      if (c.includes('pagination')) return 'Pagination';
      if (c.includes('category-link') || c.includes('chip') || c.includes('tag')) return 'Tag/Chip';
      if (t === 'form' || c.includes('form')) return 'Formulario';
      if (t === 'button' || c.includes('btn') || c.includes('wp-block-button')) return 'Botón';
      if (t === 'table') return 'Tabla';
      if (t === 'blockquote') return 'Cita';
      n = n.parentElement;
    }
    return 'Body';
  }

  function getRole(el) {
    const t = el.tagName.toLowerCase();
    if (t.match(/^h[1-6]$/)) return t.toUpperCase();
    if (t === 'p') return 'Párrafo';
    if (t === 'a') return 'Enlace';
    if (t === 'li') return 'Lista';
    if (t === 'button') return 'Botón';
    if (t === 'label') return 'Label';
    if (t === 'input' || t === 'select' || t === 'textarea') return 'Input';
    if (t === 'small') return 'Small';
    if (t === 'strong' || t === 'em') return 'Énfasis';
    if (t === 'span') return 'Span';
    if (t === 'figcaption') return 'Caption';
    if (t === 'blockquote') return 'Cita';
    if (t === 'td' || t === 'th') return 'Celda';
    return t;
  }

  document.querySelectorAll(TARGET).forEach(el => {
    if (!vis(el)) return;
    // Check has direct text
    let hasText = false;
    for (const c of el.childNodes) {
      if (c.nodeType === 3 && c.textContent.trim().length > 0) { hasText = true; break; }
    }
    if (!hasText && !['input','select','textarea','button'].includes(el.tagName.toLowerCase())) return;

    const cs = getComputedStyle(el);
    const sizePx = parseFloat(cs.fontSize);
    if (!sizePx || sizePx <= 0) return;

    results.push({
      sizePx: Math.round(sizePx * 10) / 10,
      weight: parseInt(cs.fontWeight) || 400,
      lineHeight: Math.round(parseFloat(cs.lineHeight) * 10) / 10 || null,
      family: cs.fontFamily.split(',')[0].trim().replace(/"/g, ''),
      component: getComponent(el),
      role: getRole(el),
      text: (el.textContent || '').trim().substring(0, 40),
    });
  });

  return results;
})()`;

(async () => {
  console.log('Extrayendo escala rem() por componente...\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let cookiesDone = false;

  // remSize → { components: Set, roles: Set, count, weights: Set, lineHeights: Set, samples: [] }
  const remMap = {};

  for (let i = 0; i < PAGES.length; i++) {
    const p = PAGES[i];
    process.stdout.write('[' + (i + 1) + '/' + PAGES.length + '] ' + p.page_id + '... ');
    const page = await context.newPage();
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1500);
      if (!cookiesDone) {
        try {
          const btn = page.locator('button:has-text("Aceptar todo")').first();
          if (await btn.isVisible({ timeout: 1000 })) { await btn.click(); cookiesDone = true; await page.waitForTimeout(500); }
        } catch {}
      }

      const raw = await page.evaluate(EXTRACT_FN);
      console.log(raw.length + ' nodos');

      for (const entry of raw) {
        const rem = (entry.sizePx / 16).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
        const key = rem;
        if (!remMap[key]) {
          remMap[key] = {
            sizePx: entry.sizePx,
            rem: parseFloat(rem),
            count: 0,
            components: {},
            roles: {},
            weights: new Set(),
            lineHeights: new Set(),
            families: new Set(),
            samples: [],
          };
        }
        const m = remMap[key];
        m.count++;
        m.components[entry.component] = (m.components[entry.component] || 0) + 1;
        m.roles[entry.role] = (m.roles[entry.role] || 0) + 1;
        m.weights.add(entry.weight);
        if (entry.lineHeight) m.lineHeights.add(entry.lineHeight);
        m.families.add(entry.family);
        if (m.samples.length < 3 && entry.text) {
          m.samples.push({ component: entry.component, role: entry.role, text: entry.text, page: p.page_id });
        }
      }
    } catch (e) { console.log('ERROR: ' + e.message); }
    await page.close();
  }
  await browser.close();

  // Serialize
  const scale = Object.values(remMap)
    .sort((a, b) => b.sizePx - a.sizePx)
    .map(m => ({
      sizePx: m.sizePx,
      rem: m.rem,
      remLabel: m.rem + 'rem',
      count: m.count,
      components: Object.entries(m.components)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      roles: Object.entries(m.roles)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      weights: [...m.weights].sort(),
      lineHeights: [...m.lineHeights].sort(),
      families: [...m.families],
      samples: m.samples,
    }));

  const output = {
    generated: new Date().toISOString(),
    baseFontSize: 16,
    totalEntries: scale.length,
    scale,
  };

  const outPath = path.join(__dirname, 'output', 'rem-scale.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log('\n→ ' + outPath);
  console.log('\nEscala rem detectada:');
  for (const s of scale) {
    const comps = s.components.slice(0, 4).map(c => c.name + '(' + c.count + ')').join(', ');
    console.log('  ' + s.sizePx + 'px = ' + s.remLabel + ' — ' + s.count + ' usos — ' + comps);
  }
})();
