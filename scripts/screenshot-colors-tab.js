const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const filePath = 'file://' + path.join(__dirname, 'output', 'audit.html');
  await page.goto(filePath, { waitUntil: 'networkidle' });

  // Click on "Colores" tab (first tab, should be active by default)
  await page.click('button[data-tab="colors"]');
  await page.waitForTimeout(500);

  // Screenshot 1: Top of colors tab (palette + top 15)
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-colors-top.png'), fullPage: false });

  // Scroll down to see the role-based grid
  await page.evaluate(() => {
    const titles = document.querySelectorAll('.section-title');
    for (const t of titles) {
      if (t.textContent.includes('Distribución por tipo de uso')) {
        t.scrollIntoView({ behavior: 'instant', block: 'start' });
        break;
      }
    }
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-colors-roles-1.png'), fullPage: false });

  // Scroll a bit more to see more roles
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-colors-roles-2.png'), fullPage: false });

  // Scroll more
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-colors-roles-3.png'), fullPage: false });

  // Scroll more for backgrounds/borders
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-colors-roles-4.png'), fullPage: false });

  console.log('Screenshots saved.');
  await browser.close();
})();
