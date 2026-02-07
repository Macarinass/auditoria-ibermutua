const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'output', 'audit-manifest.json'), 'utf8')
);
const PAGES = manifest.pages.filter(p => p.status === 'ok');

// ── In-browser: detailed color extraction with semantic roles ──
const EXTRACT_FN = `(() => {
  const result = {
    textColor: [],
    backgroundColor: [],
    borderColor: [],
    linkColor: [],
    buttonBg: [],
    buttonText: [],
    iconColor: [],
  };

  function vis(el) {
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch { return false; }
  }

  function hasText(el) {
    for (const c of el.childNodes) {
      if (c.nodeType === 3 && c.textContent.trim().length > 0) return true;
    }
    return false;
  }

  function getEffBg(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      n = n.parentElement;
    }
    return 'rgb(255, 255, 255)';
  }

  function zone(el) {
    let n = el;
    for (let i = 0; i < 6 && n; i++) {
      const t = (n.tagName || '').toLowerCase();
      const c = (typeof n.className === 'string') ? n.className.toLowerCase() : '';
      if (t === 'header' || c.includes('site-header')) return 'header';
      if (t === 'footer' || c.includes('site-footer')) return 'footer';
      if (t === 'nav' || c.includes('nav') || c.includes('menu')) return 'nav';
      if (c.includes('hero') || c.includes('entry-header') || c.includes('cover')) return 'hero';
      if (c.includes('card') || c.includes('title-content') || c.includes('item-post')) return 'card';
      if (t === 'button' || c.includes('btn') || c.includes('wp-block-button')) return 'button';
      if (c.includes('accordion')) return 'accordion';
      if (c.includes('tab')) return 'tabs';
      if (c.includes('breadcrumb')) return 'breadcrumb';
      if (c.includes('search')) return 'search';
      n = n.parentElement;
    }
    return 'body';
  }

  function push(bucket, color, role, tag, sample, bg) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return;
    bucket.push({ color, role, tag, sample: (sample || '').substring(0, 40), bg: bg || null });
  }

  // ── TEXT COLORS (with semantic role) ──
  document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,strong,em,small,label,li,a,button,input,select,textarea,figcaption,blockquote,td,th,dt,dd').forEach(el => {
    if (!vis(el)) return;
    if (!hasText(el) && !['input','select','textarea'].includes(el.tagName.toLowerCase())) return;
    const tag = el.tagName.toLowerCase();
    const cs = getComputedStyle(el);
    const color = cs.color;
    const bg = getEffBg(el);
    const text = (el.textContent || '').trim().substring(0, 40);
    const cls = (typeof el.className === 'string') ? el.className.toLowerCase() : '';
    const z = zone(el);
    const fontSize = parseFloat(cs.fontSize);
    const fontWeight = parseInt(cs.fontWeight) || 400;

    // Determine semantic role
    let role = '';
    if (tag === 'h1') role = 'heading-h1';
    else if (tag === 'h2') role = 'heading-h2';
    else if (tag === 'h3') role = 'heading-h3';
    else if (tag === 'h4' || tag === 'h5' || tag === 'h6') role = 'heading-small';
    else if (tag === 'p' && z === 'hero') role = 'text-hero';
    else if (tag === 'p' || (tag === 'span' && !cls.includes('icon'))) {
      if (fontSize <= 12) role = 'text-caption';
      else if (fontWeight >= 600) role = 'text-bold';
      else role = 'text-body';
    }
    else if (tag === 'small' || tag === 'figcaption') role = 'text-caption';
    else if (tag === 'strong') role = 'text-bold';
    else if (tag === 'em') role = 'text-secondary';
    else if (tag === 'label') role = 'form-label';
    else if (tag === 'li' && z === 'nav') role = 'nav-item';
    else if (tag === 'li') role = 'list-item';
    else if (tag === 'input' || tag === 'select' || tag === 'textarea') role = 'form-input';
    else if (tag === 'a' && z === 'nav') role = 'nav-link';
    else if (tag === 'a' && z === 'footer') role = 'footer-link';
    else if (tag === 'a' && z === 'card') role = 'card-link';
    else if (tag === 'a' && (cls.includes('btn') || cls.includes('button') || cls.includes('wp-block-button'))) role = 'cta-link';
    else if (tag === 'a' && cls.includes('category')) role = 'tag-link';
    else if (tag === 'a') role = 'text-link';
    else if (tag === 'button') role = 'button-text';
    else if (tag === 'td' || tag === 'th') role = 'table-cell';
    else role = 'text-other';

    push(result.textColor, color, role, tag, text, bg);

    // Also capture as link specifically
    if (tag === 'a') {
      let linkRole = 'link-default';
      if (z === 'nav') linkRole = 'link-nav';
      else if (z === 'footer') linkRole = 'link-footer';
      else if (z === 'card') linkRole = 'link-card';
      else if (z === 'hero') linkRole = 'link-hero';
      else if (cls.includes('category')) linkRole = 'link-category';
      else if (cls.includes('btn') || cls.includes('button')) linkRole = 'link-cta';
      else linkRole = 'link-inline';
      push(result.linkColor, color, linkRole, tag, text, bg);
    }
  });

  // ── BACKGROUND COLORS ──
  document.querySelectorAll('body,header,footer,nav,main,section,div,article,aside,figure,span,a,button').forEach(el => {
    if (!vis(el)) return;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return;
    const tag = el.tagName.toLowerCase();
    const cls = (typeof el.className === 'string') ? el.className.toLowerCase() : '';
    const z = zone(el);
    const r = el.getBoundingClientRect();
    
    let role = 'bg-other';
    if (tag === 'body') role = 'bg-page';
    else if (z === 'header' && (tag === 'header' || cls.includes('header'))) role = 'bg-header';
    else if (z === 'footer') role = 'bg-footer';
    else if (z === 'hero' || cls.includes('entry-header')) role = 'bg-hero';
    else if (z === 'nav' || cls.includes('top-header')) role = 'bg-nav';
    else if (z === 'card') role = 'bg-card';
    else if (z === 'button' || tag === 'button' || cls.includes('btn') || cls.includes('wp-block-button')) role = 'bg-button';
    else if (cls.includes('search')) role = 'bg-search';
    else if (cls.includes('accordion') || cls.includes('tab')) role = 'bg-interactive';
    else if (cls.includes('block-ibermutua-digital') || cls.includes('block-group')) role = 'bg-section';
    else if (r.width >= 1000) role = 'bg-section';
    else if (tag === 'a') role = 'bg-link';
    else role = 'bg-block';

    push(result.backgroundColor, bg, role, tag, '', null);
  });

  // ── BORDER COLORS ──
  document.querySelectorAll('*').forEach(el => {
    if (!vis(el)) return;
    const cs = getComputedStyle(el);
    const borders = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor];
    const widths = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth];
    let hasBorder = false;
    let borderColor = null;
    for (let i = 0; i < 4; i++) {
      if (widths[i] && widths[i] !== '0px') { hasBorder = true; borderColor = borders[i]; break; }
    }
    if (!hasBorder || !borderColor || borderColor === 'rgba(0, 0, 0, 0)') return;
    const tag = el.tagName.toLowerCase();
    const cls = (typeof el.className === 'string') ? el.className.toLowerCase() : '';
    const z = zone(el);

    let role = 'border-other';
    if (tag === 'input' || tag === 'select' || tag === 'textarea') role = 'border-input';
    else if (z === 'header' || cls.includes('site-header')) role = 'border-header';
    else if (z === 'card') role = 'border-card';
    else if (z === 'button' || tag === 'button' || cls.includes('btn') || tag === 'a' && cls.includes('wp-block-button')) role = 'border-button';
    else if (z === 'nav' || tag === 'li' && cls.includes('menu-item')) role = 'border-nav';
    else if (cls.includes('accordion')) role = 'border-accordion';
    else if (cls.includes('tab')) role = 'border-tab';
    else if (cls.includes('question')) role = 'border-faq';
    else if (tag === 'div' || tag === 'article' || tag === 'section') role = 'border-divider';

    push(result.borderColor, borderColor, role, tag, '', null);
  });

  // ── BUTTON COLORS (bg + text separately) ──
  document.querySelectorAll('button, a[class*="btn"], a[class*="button"], a[class*="wp-block-button"], input[type="submit"]').forEach(el => {
    if (!vis(el)) return;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const color = cs.color;
    const cls = (typeof el.className === 'string') ? el.className.toLowerCase() : '';
    const text = (el.textContent || '').trim().substring(0, 30);

    // Classify
    let variant = 'default';
    if (bg && (bg.includes('0, 117') || bg.includes('0, 101') || bg.includes('0, 86'))) variant = 'primary';
    else if (bg && (bg.includes('255, 255, 255') || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) variant = 'secondary';
    else variant = 'other';

    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      push(result.buttonBg, bg, 'btn-bg-' + variant, el.tagName.toLowerCase(), text, null);
    }
    push(result.buttonText, color, 'btn-text-' + variant, el.tagName.toLowerCase(), text, bg);
  });

  // ── ICON COLORS ──
  document.querySelectorAll('svg').forEach(svg => {
    if (!vis(svg)) return;
    const r = svg.getBoundingClientRect();
    if (r.width > 120 || r.height > 120 || r.width < 4) return;
    const shape = svg.querySelector('path,circle,rect,polygon');
    if (!shape) return;
    const fill = getComputedStyle(shape).fill;
    const stroke = getComputedStyle(shape).stroke;
    const z = zone(svg);
    if (fill && fill !== 'none' && fill !== 'transparent' && !fill.startsWith('url'))
      push(result.iconColor, fill, 'icon-' + z, 'svg', '', null);
    if (stroke && stroke !== 'none' && stroke !== 'transparent')
      push(result.iconColor, stroke, 'icon-stroke-' + z, 'svg', '', null);
  });
  // Icon fonts
  document.querySelectorAll('i[class*="icon"],i[class*="fa-"],span[class*="icon"],span[class*="svg-icon"]').forEach(el => {
    if (!vis(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width > 80) return;
    push(result.iconColor, getComputedStyle(el).color, 'icon-font', el.tagName.toLowerCase(), '', null);
  });

  return result;
})()`;

// ── Color normalization ──
function parseColor(raw) {
  if (!raw) return null;
  const m = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
  if (a === 0) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a,
    hex: '#' + [+m[1],+m[2],+m[3]].map(c => c.toString(16).padStart(2,'0')).join('') };
}

// ── Main ──
(async () => {
  console.log('Enriqueciendo datos de color con roles semánticos...\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let cookiesDismissed = false;

  const CATEGORIES = ['textColor','backgroundColor','borderColor','linkColor','buttonBg','buttonText','iconColor'];
  const globalByRole = {}; // category → role → hex → { hex, count, pages, samples }
  for (const cat of CATEGORIES) globalByRole[cat] = {};

  for (let i = 0; i < PAGES.length; i++) {
    const p = PAGES[i];
    process.stdout.write('[' + (i+1) + '/' + PAGES.length + '] ' + p.page_id + '... ');
    const page = await context.newPage();
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1500);
      if (!cookiesDismissed) {
        try {
          const btn = page.locator('button:has-text("Aceptar todo")').first();
          if (await btn.isVisible({ timeout: 1000 })) { await btn.click(); cookiesDismissed = true; await page.waitForTimeout(800); }
        } catch {}
      }
      await page.waitForTimeout(500);

      const raw = await page.evaluate(EXTRACT_FN);
      for (const cat of CATEGORIES) {
        for (const entry of (raw[cat] || [])) {
          const parsed = parseColor(entry.color);
          if (!parsed) continue;
          const role = entry.role;
          if (!globalByRole[cat][role]) globalByRole[cat][role] = {};
          const key = parsed.a < 1 ? parsed.hex + '/' + parsed.a : parsed.hex;
          if (!globalByRole[cat][role][key]) {
            globalByRole[cat][role][key] = { hex: parsed.hex, alpha: parsed.a, count: 0, pages: new Set(), samples: [] };
          }
          const g = globalByRole[cat][role][key];
          g.count++;
          g.pages.add(p.page_id);
          if (g.samples.length < 2 && entry.sample) g.samples.push(entry.sample);
        }
      }
      const counts = CATEGORIES.map(c => c.split(/(?=[A-Z])/).join('').substring(0,6) + ':' + (raw[c]||[]).length).join(' ');
      console.log(counts);
    } catch (err) { console.log('ERROR ' + err.message); }
    await page.close();
  }
  await browser.close();

  // Serialize
  const output = {};
  for (const cat of CATEGORIES) {
    output[cat] = {};
    for (const [role, hexMap] of Object.entries(globalByRole[cat])) {
      output[cat][role] = Object.values(hexMap)
        .map(v => ({ hex: v.hex, alpha: v.alpha, count: v.count, pages: v.pages.size, samples: v.samples }))
        .sort((a, b) => b.count - a.count);
    }
  }

  const outPath = path.join(__dirname, 'output', 'colors-by-role.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log('\n→ ' + outPath);
})();
