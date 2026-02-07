const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('https://www.ibermutua.es/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  
  // Dismiss cookies
  try {
    const btn = page.locator('button:has-text("Aceptar todo")').first();
    if (await btn.isVisible({ timeout: 2000 })) await btn.click();
    await page.waitForTimeout(500);
  } catch {}

  console.log('=== VERIFICACIÓN DE COLORES EN IBERMUTUA.ES ===\n');

  // 1. Extract ALL CSS custom properties from :root / html
  const cssVars = await page.evaluate(() => {
    const vars = {};
    // From computed styles
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    
    // Try to get all --wp and --color variables from stylesheets
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          const text = rule.cssText || '';
          // Extract all color-related CSS variables
          const matches = text.matchAll(/(--([\w-]+)):\s*([^;]+)/g);
          for (const m of matches) {
            const name = m[1];
            const value = m[3].trim();
            // Only color-like values
            if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl') || 
                value.startsWith('linear-gradient') || 
                name.includes('color') || name.includes('red') || name.includes('green') || 
                name.includes('blue') || name.includes('yellow') || name.includes('orange') ||
                name.includes('success') || name.includes('error') || name.includes('warning') ||
                name.includes('info') || name.includes('danger') || name.includes('alert')) {
              vars[name] = value;
            }
          }
        }
      } catch (e) { /* cross-origin */ }
    }
    return vars;
  });

  console.log('1. CSS CUSTOM PROPERTIES (variables reales en stylesheets):');
  console.log('   Total encontradas:', Object.keys(cssVars).length);
  const sorted = Object.entries(cssVars).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [name, value] of sorted) {
    console.log('   ' + name + ': ' + value);
  }

  // 2. Check if Ant Design CSS exists
  const antDesignCheck = await page.evaluate(() => {
    const results = { hasAntCSS: false, antRules: [] };
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          const sel = rule.selectorText || '';
          if (sel.includes('.ant-')) {
            results.hasAntCSS = true;
            if (results.antRules.length < 30) {
              const style = rule.style;
              const props = {};
              if (style) {
                for (let i = 0; i < Math.min(style.length, 5); i++) {
                  const p = style[i];
                  if (p.includes('color') || p === 'background-color' || p.includes('border')) {
                    props[p] = style.getPropertyValue(p);
                  }
                }
              }
              if (Object.keys(props).length > 0) {
                results.antRules.push({ selector: sel, props });
              }
            }
          }
        }
      } catch (e) {}
    }
    return results;
  });

  console.log('\n2. ANT DESIGN CSS:');
  console.log('   ¿Existe CSS de Ant Design?', antDesignCheck.hasAntCSS);
  if (antDesignCheck.antRules.length > 0) {
    console.log('   Reglas con colores:');
    for (const r of antDesignCheck.antRules) {
      console.log('     ' + r.selector + ' → ' + JSON.stringify(r.props));
    }
  }

  // 3. Check for form validation / error classes in CSS
  const statusCSS = await page.evaluate(() => {
    const found = [];
    const keywords = ['error', 'success', 'warning', 'danger', 'alert', 'valid', 'invalid'];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          const sel = (rule.selectorText || '').toLowerCase();
          for (const kw of keywords) {
            if (sel.includes(kw) && !sel.includes('fancybox')) {
              const style = rule.style;
              if (style) {
                const colorProps = {};
                for (let i = 0; i < style.length; i++) {
                  const p = style[i];
                  if (p.includes('color') || p === 'background-color' || p.includes('background') || p.includes('border')) {
                    const v = style.getPropertyValue(p);
                    if (v && v !== 'initial' && v !== 'inherit') colorProps[p] = v;
                  }
                }
                if (Object.keys(colorProps).length > 0) {
                  found.push({ selector: rule.selectorText, props: colorProps });
                }
              }
              break;
            }
          }
        }
      } catch (e) {}
    }
    return found;
  });

  console.log('\n3. CSS RULES CON SELECTORES DE ESTADO (error/success/warning/etc):');
  console.log('   Total:', statusCSS.length);
  for (const r of statusCSS) {
    console.log('   ' + r.selector);
    for (const [p, v] of Object.entries(r.props)) {
      console.log('     ' + p + ': ' + v);
    }
  }

  // 4. Check actual colors in use on the page (computed styles of real elements)
  const realColors = await page.evaluate(() => {
    const uniqueColors = new Set();
    const els = document.querySelectorAll('*');
    for (const el of els) {
      try {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        uniqueColors.add(cs.color);
        if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') uniqueColors.add(cs.backgroundColor);
        if (cs.borderTopColor !== 'rgb(0, 0, 0)' && cs.borderTopWidth !== '0px') uniqueColors.add(cs.borderTopColor);
      } catch {}
    }
    return [...uniqueColors].sort();
  });

  console.log('\n4. COLORES COMPUTED REALES EN EL DOM DE LA HOME:');
  console.log('   Total:', realColors.length);
  for (const c of realColors) {
    console.log('   ' + c);
  }

  // 5. Also check formularios page for form-specific colors
  await page.goto('https://www.ibermutua.es/formularios/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  const formColors = await page.evaluate(() => {
    const found = [];
    // Try submitting a form to trigger validation
    const forms = document.querySelectorAll('form');
    // Check wpcf7 elements
    const wpcf7 = document.querySelectorAll('.wpcf7-form, .wpcf7-not-valid-tip, .wpcf7-response-output, [class*="error"], [class*="success"]');
    for (const el of wpcf7) {
      const cs = getComputedStyle(el);
      found.push({
        tag: el.tagName,
        class: el.className.toString().substring(0, 80),
        color: cs.color,
        bg: cs.backgroundColor,
        border: cs.borderTopColor,
        display: cs.display,
      });
    }
    return { formCount: forms.length, statusElements: found };
  });

  console.log('\n5. FORMULARIOS PAGE:');
  console.log('   Formularios encontrados:', formColors.formCount);
  console.log('   Elementos de estado:', formColors.statusElements.length);
  for (const e of formColors.statusElements) {
    console.log('   ' + e.tag + '.' + e.class.substring(0, 50) + ' → color:' + e.color + ' bg:' + e.bg + ' display:' + e.display);
  }

  await browser.close();
  console.log('\n=== FIN VERIFICACIÓN ===');
})();
