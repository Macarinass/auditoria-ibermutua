const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const reportPath = 'file://' + path.join(__dirname, 'output', 'audit.html');
  await page.goto(reportPath, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Tab 1: Colors
  await page.screenshot({ path: path.join(__dirname, 'output', 'report-tab-colors.png'), fullPage: false });

  // Scroll down to see table
  await page.evaluate('window.scrollBy(0, 700)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'output', 'report-tab-colors-2.png'), fullPage: false });

  // Tab 2: Typography
  await page.evaluate('window.scrollTo(0,0)');
  await page.click('[data-tab="typography"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, 'output', 'report-tab-typography.png'), fullPage: false });

  // Tab 3: Icons
  await page.click('[data-tab="icons"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, 'output', 'report-tab-icons.png'), fullPage: false });

  // Scroll to grid
  await page.evaluate('window.scrollBy(0, 600)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'output', 'report-tab-icons-2.png'), fullPage: false });

  // Tab 4: Components
  await page.evaluate('window.scrollTo(0,0)');
  await page.click('[data-tab="components"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, 'output', 'report-tab-components.png'), fullPage: false });

  await page.evaluate('window.scrollBy(0, 700)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'output', 'report-tab-components-2.png'), fullPage: false });

  await browser.close();
  console.log('Screenshots del informe capturados.');
})();
