const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const filePath = 'file://' + path.join(__dirname, 'output', 'audit.html');
  await page.goto(filePath, { waitUntil: 'networkidle' });

  // Click on Components tab
  await page.click('button[data-tab="components"]');
  await page.waitForTimeout(500);

  // Screenshot 1: top of components
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-comps-1.png'), fullPage: false });

  // Scroll down
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-comps-2.png'), fullPage: false });

  // Scroll more
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-comps-3.png'), fullPage: false });

  console.log('Screenshots saved.');
  await browser.close();
})();
