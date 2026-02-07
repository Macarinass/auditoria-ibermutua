const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('file://' + path.join(__dirname, 'output', 'audit.html'), { waitUntil: 'networkidle' });
  await page.click('button[data-tab="typography"]');
  await page.waitForTimeout(400);

  // Top of typography
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-typo-1.png'), fullPage: false });

  // Scroll to rem scale section
  await page.evaluate(() => {
    const h3s = document.querySelectorAll('h3');
    for (const h of h3s) {
      if (h.textContent.includes('Escala rem()')) {
        h.scrollIntoView({ behavior: 'instant', block: 'start' });
        break;
      }
    }
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-typo-rem-1.png'), fullPage: false });

  // Scroll down a bit more
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-typo-rem-2.png'), fullPage: false });

  console.log('Done');
  await browser.close();
})();
