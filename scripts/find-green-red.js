const { chromium } = require('playwright');

const PAGES = [
  'https://www.ibermutua.es/',
  'https://www.ibermutua.es/empresas/',
  'https://www.ibermutua.es/servicios/',
  'https://www.ibermutua.es/servicios/asistencia-sanitaria/',
  'https://www.ibermutua.es/red-de-centros/',
  'https://www.ibermutua.es/formularios/',
  'https://www.ibermutua.es/noticias/',
  'https://www.ibermutua.es/noticias/ibermutua-entrega-sus-premios-de-prevencion-de-riesgos-laborales-eladio-gonzalez-2/',
  'https://www.ibermutua.es/quienes-somos/',
  'https://www.ibermutua.es/preguntas-frecuentes/',
  'https://www.ibermutua.es/tramite/comunicar-accidente-de-trabajo/',
  'https://www.ibermutua.es/trabaja-con-nosotros/',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let cookiesDone = false;

  console.log('Buscando colores verdes y rojos RENDERIZADOS en el DOM...\n');

  for (const url of PAGES) {
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1500);
      if (!cookiesDone) {
        try {
          const btn = page.locator('button:has-text("Aceptar todo")').first();
          if (await btn.isVisible({ timeout: 1500 })) { await btn.click(); cookiesDone = true; await page.waitForTimeout(500); }
        } catch {}
      }

      const findings = await page.evaluate(() => {
        const results = [];
        function rgbToHex(r, g, b) {
          return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
        }
        function parseRgb(str) {
          const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (!m) return null;
          return { r: +m[1], g: +m[2], b: +m[3], hex: rgbToHex(+m[1], +m[2], +m[3]) };
        }
        function isGreenish(r, g, b) {
          return (g > 100 && g > r * 1.3 && g > b * 1.3) || 
                 (r === 0 && g === 128 && b === 0) || // green keyword
                 (r < 100 && g > 150 && b < 150) ||
                 (r === 19 && g === 186 && b === 147); // #13ba93
        }
        function isReddish(r, g, b) {
          return (r > 180 && g < 100 && b < 100) || 
                 (r > 200 && g < 80 && b < 80) ||
                 (r === 207 && g === 46 && b === 46) || // #cf2e2e
                 (r === 255 && g === 77 && b === 79); // #ff4d4f
        }
        function isOrangeYellow(r, g, b) {
          return (r > 200 && g > 100 && g < 220 && b < 80);
        }

        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          try {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            // Skip invisible elements
            if (r.width === 0 || r.height === 0) continue;
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            // Also skip elements that are off-screen or opacity 0
            if (parseFloat(cs.opacity) === 0) continue;

            const colors = [
              { prop: 'color', val: cs.color },
              { prop: 'background-color', val: cs.backgroundColor },
              { prop: 'border-top-color', val: cs.borderTopColor },
            ];

            for (const c of colors) {
              const parsed = parseRgb(c.val);
              if (!parsed) continue;
              const { r: cr, g: cg, b: cb, hex } = parsed;
              
              let type = null;
              if (isGreenish(cr, cg, cb)) type = 'GREEN';
              else if (isReddish(cr, cg, cb)) type = 'RED';
              else if (isOrangeYellow(cr, cg, cb)) type = 'ORANGE';
              
              if (type) {
                const text = (el.textContent || '').trim().substring(0, 50);
                const tag = el.tagName.toLowerCase();
                const cls = (typeof el.className === 'string' ? el.className : '').substring(0, 60);
                results.push({
                  type,
                  hex,
                  rgb: c.val,
                  property: c.prop,
                  tag,
                  class: cls,
                  text: text.length > 0 ? text : '(no text)',
                  visible: r.width > 0 && r.height > 0,
                  size: Math.round(r.width) + 'x' + Math.round(r.height),
                });
              }
            }
          } catch (e) {}
        }
        return results;
      });

      if (findings.length > 0) {
        console.log('✅ ' + url);
        // Dedupe by type+hex+class
        const seen = {};
        for (const f of findings) {
          const key = f.type + '|' + f.hex + '|' + f.class + '|' + f.property;
          if (seen[key]) continue;
          seen[key] = true;
          console.log('   ' + f.type + ' ' + f.hex + ' (' + f.property + ') → <' + f.tag + '> .' + f.class.substring(0, 40) + ' [' + f.size + ']');
          if (f.text !== '(no text)') console.log('      "' + f.text.substring(0, 60) + '"');
        }
      } else {
        console.log('   ' + url + ' → ningún verde/rojo visible');
      }
    } catch (e) {
      console.log('   ' + url + ' → ERROR: ' + e.message);
    }
    await page.close();
  }

  // Now specifically try to trigger form validation
  console.log('\n--- Intentando provocar validación de formulario ---');
  const formPage = await context.newPage();
  await formPage.goto('https://www.ibermutua.es/red-de-centros/', { waitUntil: 'networkidle', timeout: 60000 });
  await formPage.waitForTimeout(1500);

  // Try clicking search/submit without filling form
  try {
    const searchBtn = formPage.locator('button[type="submit"], input[type="submit"], .btn-search, button:has-text("Buscar")').first();
    if (await searchBtn.isVisible({ timeout: 2000 })) {
      await searchBtn.click();
      await formPage.waitForTimeout(2000);
      const afterSubmit = await formPage.evaluate(() => {
        const results = [];
        document.querySelectorAll('[class*="error"], [class*="invalid"], [class*="alert"], [class*="success"], [class*="warning"], [aria-invalid="true"]').forEach(el => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          results.push({
            class: el.className.toString().substring(0, 80),
            color: cs.color,
            bg: cs.backgroundColor,
            border: cs.borderTopColor,
            visible: r.width > 0 && r.height > 0 && cs.display !== 'none',
            text: (el.textContent || '').trim().substring(0, 50),
          });
        });
        return results;
      });
      console.log('Después de submit:');
      for (const e of afterSubmit) {
        console.log('  .' + e.class.substring(0, 50) + ' → color:' + e.color + ' bg:' + e.bg + ' visible:' + e.visible);
        if (e.text) console.log('    "' + e.text.substring(0, 50) + '"');
      }
    }
  } catch (e) { console.log('  No se pudo hacer submit: ' + e.message); }
  await formPage.close();

  await browser.close();
  console.log('\n=== FIN ===');
})();
