const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const filePath = 'file://' + path.join(__dirname, 'output', 'audit.html');
  await page.goto(filePath, { waitUntil: 'networkidle' });

  await page.click('button[data-tab="colors"]');
  await page.waitForTimeout(300);

  // Screenshot "Todos" tab (default)
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-palette-all.png'), fullPage: false });

  // Click "Azules" tab
  await page.click('button[data-palette-tab="blues"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-palette-blues.png'), fullPage: false });

  // Click "Grises" tab
  await page.click('button[data-palette-tab="grays"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-palette-grays.png'), fullPage: false });

  // Click "Verdes" tab
  await page.click('button[data-palette-tab="greens"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-palette-greens.png'), fullPage: false });

  // Click "Rojos" tab
  await page.click('button[data-palette-tab="reds"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-palette-reds.png'), fullPage: false });

  // Click "Estado" tab
  await page.click('button[data-palette-tab="status"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-palette-status.png'), fullPage: false });

  console.log('Screenshots saved.');
  await browser.close();
})();
