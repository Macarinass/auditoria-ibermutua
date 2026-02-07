const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const filePath = 'file://' + path.join(__dirname, 'output', 'audit.html');
  await page.goto(filePath, { waitUntil: 'networkidle' });

  await page.click('button[data-tab="colors"]');
  await page.waitForTimeout(300);

  // "Todos" (default)
  await page.screenshot({ path: path.join(__dirname, 'output', 'preview-palette-all.png'), fullPage: false });

  // "Azules"
  const azulesBtn = page.locator('button[data-palette-tab="blues"]');
  if (await azulesBtn.count() > 0) {
    await azulesBtn.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(__dirname, 'output', 'preview-palette-blues.png'), fullPage: false });
  }

  // "Grises"
  const grisesBtn = page.locator('button[data-palette-tab="grays"]');
  if (await grisesBtn.count() > 0) {
    await grisesBtn.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(__dirname, 'output', 'preview-palette-grays.png'), fullPage: false });
  }

  // "Estado"
  const statusBtn = page.locator('button[data-palette-tab="status"]');
  if (await statusBtn.count() > 0) {
    await statusBtn.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(__dirname, 'output', 'preview-palette-status.png'), fullPage: false });
  }

  console.log('Done');
  await browser.close();
})();
