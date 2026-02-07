const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const reportPath = 'file://' + path.join(__dirname, 'output', 'audit.html');
  await page.goto(reportPath, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click Accesibilidad tab
  await page.click('[data-tab="a11y"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, 'output', 'report-a11y-1-kpi.png'), fullPage: false });

  // Scroll to page summary + failures
  await page.evaluate('window.scrollBy(0, 650)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'output', 'report-a11y-2-failures.png'), fullPage: false });

  // Scroll to visual contrast map
  await page.evaluate('window.scrollBy(0, 650)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'output', 'report-a11y-3-contrast-map.png'), fullPage: false });

  // Scroll to issues + recommendations
  await page.evaluate('window.scrollBy(0, 700)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'output', 'report-a11y-4-issues.png'), fullPage: false });

  // Scroll to recommendations
  await page.evaluate('window.scrollBy(0, 700)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'output', 'report-a11y-5-recs.png'), fullPage: false });

  await browser.close();
  console.log('Screenshots de accesibilidad capturados.');
})();
