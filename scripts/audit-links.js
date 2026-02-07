const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('Navegando a ibermutua.es...');
  await page.goto('https://www.ibermutua.es/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Cookie banner
  try {
    const btn = page.locator('button:has-text("Aceptar todo")').first();
    if (await btn.isVisible({ timeout: 2000 })) {
      await btn.click();
      await page.waitForTimeout(1000);
    }
  } catch {}

  // ====== EXTRACT ALL INTERNAL LINKS ======
  console.log('Extrayendo enlaces...');

  const allLinks = await page.evaluate(() => {
    const base = 'https://www.ibermutua.es';
    const results = [];

    function getZone(el) {
      // Walk up to find semantic zone
      let node = el;
      while (node && node !== document.body) {
        const tag = node.tagName?.toLowerCase();
        const cls = (node.className || '').toString().toLowerCase();
        const id = (node.id || '').toLowerCase();
        if (tag === 'header' || cls.includes('header') || id.includes('header')) return 'header';
        if (tag === 'footer' || cls.includes('footer') || id.includes('footer')) return 'footer';
        if (tag === 'nav' || cls.includes('nav-') || cls.includes('navbar') || cls.includes('menu')) return 'nav';
        node = node.parentElement;
      }
      return 'body';
    }

    document.querySelectorAll('a[href]').forEach(a => {
      let href = a.getAttribute('href') || '';
      // Normalize
      if (href.startsWith('/')) href = base + href;
      if (!href.startsWith(base)) return; // skip external
      if (href.includes('#') && href.split('#')[0] === base + '/') return; // skip anchor-only
      if (href.match(/\.(pdf|jpg|png|gif|svg|zip|doc|xls)$/i)) return; // skip files

      const text = (a.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 120);
      const zone = getZone(a);

      results.push({ href, text, zone });
    });

    // Deduplicate by href
    const seen = new Set();
    return results.filter(r => {
      const key = r.href.replace(/\/$/, '').replace(/\/+$/, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  console.log(`Total enlaces internos únicos: ${allLinks.length}`);

  // Organize by zone
  const byZone = { header: [], nav: [], body: [], footer: [] };
  allLinks.forEach(l => {
    const z = byZone[l.zone] || byZone.body;
    z.push(l);
  });

  console.log(`  header: ${byZone.header.length}`);
  console.log(`  nav:    ${byZone.nav.length}`);
  console.log(`  body:   ${byZone.body.length}`);
  console.log(`  footer: ${byZone.footer.length}`);

  // Save full link inventory
  const linksPath = path.join(outputDir, 'all-links.json');
  fs.writeFileSync(linksPath, JSON.stringify({ byZone, total: allLinks.length }, null, 2));
  console.log(`Inventario completo guardado en ${linksPath}`);

  await browser.close();
  console.log('Fase 1 completada.');
})();
