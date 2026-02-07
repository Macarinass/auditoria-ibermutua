const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Pages with forms / interactive elements where status colors are most likely
const URLS = [
  { id: 'home', url: 'https://www.ibermutua.es/' },
  { id: 'formularios', url: 'https://www.ibermutua.es/formularios/' },
  { id: 'red-centros', url: 'https://www.ibermutua.es/red-de-centros/' },
  { id: 'faqs', url: 'https://www.ibermutua.es/preguntas-frecuentes/' },
  { id: 'tramite', url: 'https://www.ibermutua.es/tramite/comunicar-accidente-de-trabajo/' },
];

const SCAN_FN = `(() => {
  const results = { statusColors: [], cssVars: [], classColors: [] };

  // 1. Scan ALL CSS custom properties for status-related vars
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const text = rule.cssText || '';
        // Look for variables with status-like names
        const varMatches = text.match(/--[\\w-]*(error|success|warning|danger|alert|info|valid|invalid|positive|negative|caution|notice|red|green|yellow|orange)[\\w-]*\\s*:\\s*[^;]+/gi);
        if (varMatches) {
          for (const m of varMatches) {
            results.cssVars.push(m.trim());
          }
        }
        // Also look for color values in rules with status-like selectors
        if (/(error|success|warning|danger|alert|info|valid|invalid|positive|negative)/.test(rule.selectorText || '')) {
          const cs = rule.style;
          if (cs) {
            for (let i = 0; i < cs.length; i++) {
              const prop = cs[i];
              if (prop.includes('color') || prop === 'background' || prop === 'border-color') {
                results.classColors.push({
                  selector: rule.selectorText,
                  prop: prop,
                  value: cs.getPropertyValue(prop),
                });
              }
            }
          }
        }
      }
    } catch (e) { /* cross-origin sheets */ }
  }

  // 2. Find ALL elements with status-related classes (even if hidden)
  const statusSelectors = [
    '[class*="error"]', '[class*="success"]', '[class*="warning"]', '[class*="danger"]',
    '[class*="alert"]', '[class*="info"]', '[class*="valid"]', '[class*="invalid"]',
    '[class*="notice"]', '[class*="positive"]', '[class*="negative"]',
    '.has-error', '.is-invalid', '.is-valid',
    '[aria-invalid]', '[role="alert"]',
    '.wpcf7-not-valid-tip', '.wpcf7-response-output',
    '[class*="feedback"]', '[class*="message"]',
    '.form-error', '.field-error', '.validation',
  ];

  for (const sel of statusSelectors) {
    try {
      document.querySelectorAll(sel).forEach(el => {
        const cs = getComputedStyle(el);
        results.statusColors.push({
          selector: sel,
          tag: el.tagName.toLowerCase(),
          className: (typeof el.className === 'string' ? el.className : '').substring(0, 100),
          text: (el.textContent || '').trim().substring(0, 60),
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          borderColor: cs.borderTopColor,
          display: cs.display,
          visible: cs.display !== 'none' && cs.visibility !== 'hidden',
        });
      });
    } catch (e) {}
  }

  // 3. Check for specific color values in computed styles that look like status colors
  // (bright red, green, orange/yellow used as text or backgrounds)
  const statusPatterns = [];
  document.querySelectorAll('*').forEach(el => {
    try {
      const cs = getComputedStyle(el);
      const color = cs.color;
      const bg = cs.backgroundColor;
      const bc = cs.borderTopColor;

      function isStatusColor(c) {
        if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') return false;
        const m = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
        if (!m) return false;
        const r = +m[1], g = +m[2], b = +m[3];
        // Bright red (error)
        if (r > 180 && g < 80 && b < 80) return 'error-red';
        // Bright green (success)
        if (g > 120 && r < 100 && b < 100) return 'success-green';
        // Medium green
        if (g > 130 && r < 130 && r > 30) return 'success-green';
        // Orange / amber (warning)
        if (r > 200 && g > 120 && g < 200 && b < 80) return 'warning-orange';
        // Yellow
        if (r > 220 && g > 200 && b < 80) return 'warning-yellow';
        return false;
      }

      const colorStatus = isStatusColor(color);
      const bgStatus = isStatusColor(bg);
      const bcStatus = isStatusColor(bc);

      if (colorStatus || bgStatus || bcStatus) {
        const r = el.getBoundingClientRect();
        statusPatterns.push({
          tag: el.tagName.toLowerCase(),
          className: (typeof el.className === 'string' ? el.className : '').substring(0, 80),
          text: (el.textContent || '').trim().substring(0, 50),
          color: colorStatus ? color : null,
          colorType: colorStatus || null,
          bg: bgStatus ? bg : null,
          bgType: bgStatus || null,
          border: bcStatus ? bc : null,
          borderType: bcStatus || null,
          visible: r.width > 0 && r.height > 0 && cs.display !== 'none',
        });
      }
    } catch (e) {}
  });
  results.statusPatterns = statusPatterns;

  return results;
})()`;

(async () => {
  console.log('Escaneando colores de estado (error/success/warning/info)...\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let cookiesDone = false;

  const allResults = {};
  for (const pg of URLS) {
    process.stdout.write('[' + pg.id + '] ');
    const page = await context.newPage();
    try {
      await page.goto(pg.url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1500);
      if (!cookiesDone) {
        try {
          const btn = page.locator('button:has-text("Aceptar todo")').first();
          if (await btn.isVisible({ timeout: 1000 })) { await btn.click(); cookiesDone = true; await page.waitForTimeout(800); }
        } catch {}
      }

      // Try to trigger form validation on forms pages
      if (pg.id === 'formularios' || pg.id === 'red-centros' || pg.id === 'tramite') {
        try {
          const submitBtns = page.locator('input[type="submit"], button[type="submit"]');
          const count = await submitBtns.count();
          if (count > 0) {
            await submitBtns.first().click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(1000);
          }
        } catch {}
      }

      const result = await page.evaluate(SCAN_FN);
      allResults[pg.id] = result;

      const nVars = result.cssVars.length;
      const nStatus = result.statusColors.length;
      const nPatterns = result.statusPatterns.length;
      const nClass = result.classColors.length;
      console.log('vars:' + nVars + ' status-els:' + nStatus + ' patterns:' + nPatterns + ' css-rules:' + nClass);
    } catch (e) {
      console.log('ERROR: ' + e.message);
    }
    await page.close();
  }
  await browser.close();

  // Consolidate
  const allVars = new Set();
  const allClassColors = [];
  const allStatusEls = [];
  const allPatterns = [];

  for (const [pgId, r] of Object.entries(allResults)) {
    for (const v of r.cssVars) allVars.add(v);
    for (const c of r.classColors) allClassColors.push({ ...c, page: pgId });
    for (const s of r.statusColors) allStatusEls.push({ ...s, page: pgId });
    for (const p of r.statusPatterns) allPatterns.push({ ...p, page: pgId });
  }

  console.log('\n── RESUMEN ──');
  console.log('CSS vars de estado:', allVars.size);
  for (const v of allVars) console.log('  ' + v);

  console.log('\nCSS rules con selectores de estado:', allClassColors.length);
  for (const c of allClassColors.slice(0, 20)) console.log('  ' + c.selector + ' → ' + c.prop + ': ' + c.value);

  console.log('\nElementos con clases de estado:', allStatusEls.length);
  const uniqueStatusEls = {};
  for (const s of allStatusEls) {
    const key = s.className + '|' + s.color + '|' + s.backgroundColor;
    if (!uniqueStatusEls[key]) uniqueStatusEls[key] = s;
  }
  for (const s of Object.values(uniqueStatusEls)) {
    console.log('  [' + s.selector + '] .' + s.className.substring(0, 60) + ' → color:' + s.color + ' bg:' + s.backgroundColor + (s.visible ? ' ✓' : ' (hidden)'));
  }

  console.log('\nPatrones de color de estado (rojo/verde/naranja en DOM):', allPatterns.length);
  const uniquePatterns = {};
  for (const p of allPatterns) {
    const key = (p.colorType || '') + (p.bgType || '') + (p.borderType || '') + '|' + p.className.substring(0, 30);
    if (!uniquePatterns[key]) uniquePatterns[key] = p;
  }
  for (const p of Object.values(uniquePatterns).slice(0, 30)) {
    let desc = p.tag + '.' + p.className.substring(0, 50);
    if (p.colorType) desc += ' text:' + p.color + '(' + p.colorType + ')';
    if (p.bgType) desc += ' bg:' + p.bg + '(' + p.bgType + ')';
    if (p.borderType) desc += ' border:' + p.border + '(' + p.borderType + ')';
    desc += p.visible ? ' ✓' : ' (hidden)';
    console.log('  ' + desc);
  }

  fs.writeFileSync(
    path.join(__dirname, 'output', 'status-colors.json'),
    JSON.stringify({ cssVars: [...allVars], classColors: allClassColors, statusElements: allStatusEls, statusPatterns: allPatterns }, null, 2)
  );
  console.log('\n→ output/status-colors.json');
})();
