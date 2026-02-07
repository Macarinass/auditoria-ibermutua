const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log('🚀 Lanzando navegador...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // --- Navegar a la home ---
  console.log('🌐 Navegando a https://www.ibermutua.es/ ...');
  await page.goto('https://www.ibermutua.es/', { waitUntil: 'networkidle', timeout: 60000 });
  // Extra wait for stability
  await page.waitForTimeout(2000);

  // --- Manejar banner de cookies (robusto) ---
  console.log('🍪 Buscando banner de cookies...');
  const cookieSelectors = [
    // Botones típicos de aceptar cookies
    'button:has-text("Aceptar todas")',
    'button:has-text("Aceptar todo")',
    'button:has-text("Aceptar cookies")',
    'button:has-text("Aceptar")',
    'button:has-text("Accept all")',
    'button:has-text("Accept")',
    // Botones de rechazar
    'button:has-text("Rechazar")',
    'button:has-text("Rechazar todas")',
    'button:has-text("Reject")',
    // Botones de guardar/cerrar
    'button:has-text("Guardar")',
    'button:has-text("Cerrar")',
    'button:has-text("Close")',
    // Selectores genéricos de consent
    '#onetrust-accept-btn-handler',
    '#accept-cookies',
    '.cookie-accept',
    '.cookies-accept',
    '[data-testid="cookie-accept"]',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '#CybotCookiebotDialogBodyButtonAccept',
    '.cc-accept',
    '.cc-btn.cc-allow',
    // Links típicos
    'a:has-text("Aceptar")',
    'a:has-text("Aceptar todas")',
  ];

  let cookieHandled = false;
  for (const selector of cookieSelectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 500 })) {
        console.log(`  ✅ Encontrado: "${selector}" — haciendo clic...`);
        await btn.click();
        cookieHandled = true;
        await page.waitForTimeout(1000);
        break;
      }
    } catch {
      // selector no encontrado, siguiente
    }
  }

  if (!cookieHandled) {
    console.log('  ℹ️  No se encontró banner de cookies visible.');
  }

  // Extra wait after cookie handling
  await page.waitForTimeout(1500);

  // --- Recopilar info básica ---
  const title = await page.title();
  const url = page.url();

  console.log('\n📋 Información de la página:');
  console.log(`   Título: ${title}`);
  console.log(`   URL final: ${url}`);

  // --- Screenshot de la home ---
  const screenshotPath = path.join(outputDir, 'home-screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`   📸 Screenshot guardado: ${screenshotPath}`);

  // --- Screenshot full page ---
  const fullScreenshotPath = path.join(outputDir, 'home-full-screenshot.png');
  await page.screenshot({ path: fullScreenshotPath, fullPage: true });
  console.log(`   📸 Screenshot full-page guardado: ${fullScreenshotPath}`);

  // --- Guardar resultado JSON ---
  const result = {
    timestamp: new Date().toISOString(),
    title,
    url,
    cookieHandled,
    viewport: { width: 1440, height: 900 },
    screenshots: {
      viewport: 'home-screenshot.png',
      fullPage: 'home-full-screenshot.png',
    },
  };

  const jsonPath = path.join(outputDir, 'home-info.json');
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  console.log(`   💾 JSON guardado: ${jsonPath}`);

  console.log('\n✅ Auditoría home completada.');
  await browser.close();
})();
