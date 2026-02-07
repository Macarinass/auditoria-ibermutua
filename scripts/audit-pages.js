const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ======================================================================
// SELECCIÓN DE 12 URLs REPRESENTATIVAS
// ======================================================================
const PAGES = [
  {
    page_id: 'home',
    url: 'https://www.ibermutua.es/',
    tipo_de_pagina: 'home',
    motivo: 'Página principal: hero, buscador, tarjetas de trámites, grid de servicios, noticias, banners CTA. Máxima densidad de componentes y patrones UI.',
  },
  {
    page_id: 'empresas',
    url: 'https://www.ibermutua.es/empresas/',
    tipo_de_pagina: 'landing-audiencia',
    motivo: 'Landing segmentada por audiencia (Empresas). Muestra cómo se adapta la arquitectura visual a un público específico con CTAs y bloques diferenciados.',
  },
  {
    page_id: 'servicios',
    url: 'https://www.ibermutua.es/servicios/',
    tipo_de_pagina: 'listado',
    motivo: 'Página índice de servicios con tarjetas/grid. Permite auditar el sistema de cards, espaciados y jerarquía visual de listados.',
  },
  {
    page_id: 'servicio-detalle',
    url: 'https://www.ibermutua.es/servicio/accidentes-de-trabajo-y-enfermedad-profesional/',
    tipo_de_pagina: 'detalle-servicio',
    motivo: 'Detalle de un servicio individual. Plantilla con contenido extenso, iconos, posibles acordeones y sidebar informativo.',
  },
  {
    page_id: 'red-centros',
    url: 'https://www.ibermutua.es/red-de-centros/',
    tipo_de_pagina: 'mapa-interactivo',
    motivo: 'Buscador de centros con mapa. Componente interactivo, formularios de búsqueda, tarjetas de resultado. Patrón UI único en el sitio.',
  },
  {
    page_id: 'formularios',
    url: 'https://www.ibermutua.es/formularios/',
    tipo_de_pagina: 'formulario',
    motivo: 'Directorio de formularios. Permite auditar enlaces de descarga, iconografía de documentos y layout de listados de recursos.',
  },
  {
    page_id: 'noticias-listado',
    url: 'https://www.ibermutua.es/corporativo/sala-de-comunicacion/prensa-y-noticias/',
    tipo_de_pagina: 'listado-noticias',
    motivo: 'Listado de noticias/prensa con tarjetas, fechas, categorías y paginación. Patrón blog/editorial clave para la auditoría.',
  },
  {
    page_id: 'noticia-detalle',
    url: 'https://www.ibermutua.es/noticia/reconocimiento-25-anos-murcia/',
    tipo_de_pagina: 'detalle-noticia',
    motivo: 'Artículo individual de noticia. Plantilla editorial con imagen destacada, tipografía de lectura, sidebar y metadatos.',
  },
  {
    page_id: 'corporativo-quienes-somos',
    url: 'https://www.ibermutua.es/corporativo/conocenos/quienes-somos/',
    tipo_de_pagina: 'corporativo',
    motivo: 'Página institucional "Quiénes somos". Heavy en tipografía, bloques de texto, imágenes corporativas y secciones informativas.',
  },
  {
    page_id: 'faqs',
    url: 'https://www.ibermutua.es/faqs/',
    tipo_de_pagina: 'faq',
    motivo: 'Preguntas frecuentes. Patrón de acordeones/expandibles, buscador interno, categorización. Componente UI diferenciado.',
  },
  {
    page_id: 'tramite-detalle',
    url: 'https://www.ibermutua.es/tramite/solicitud-de-asistencia-sanitaria/',
    tipo_de_pagina: 'detalle-tramite',
    motivo: 'Ficha de trámite individual. Información paso a paso, enlaces a formularios, documentos requeridos. Patrón informativo procedimental.',
  },
  {
    page_id: 'microsite-trabaja',
    url: 'https://www.ibermutua.es/microsite/trabaja-en-ibermutua/',
    tipo_de_pagina: 'microsite',
    motivo: 'Microsite de empleo. Diseño alternativo tipo landing con branding propio, posibles animaciones y secciones diferenciadas del sitio principal.',
  },
];

// ======================================================================
// SCRIPT PRINCIPAL
// ======================================================================
(async () => {
  const outputDir = path.join(__dirname, 'output', 'pages');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  AUDITORÍA VISUAL — ${PAGES.length} páginas seleccionadas`);
  console.log(`${'='.repeat(60)}\n`);

  // Save the selection JSON first
  const selectionPath = path.join(__dirname, 'output', 'page-selection.json');
  fs.writeFileSync(selectionPath, JSON.stringify(PAGES.map(p => ({
    page_id: p.page_id,
    url: p.url,
    tipo_de_pagina: p.tipo_de_pagina,
    motivo: p.motivo,
  })), null, 2));
  console.log(`Selección guardada: ${selectionPath}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  // Handle cookies on first page load
  let cookiesDismissed = false;

  const results = [];

  for (let i = 0; i < PAGES.length; i++) {
    const p = PAGES[i];
    const num = `[${i + 1}/${PAGES.length}]`;
    console.log(`${num} ${p.page_id} — ${p.tipo_de_pagina}`);
    console.log(`     ${p.url}`);

    const page = await context.newPage();

    try {
      // Navigate
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1500);

      // Cookie banner (only try on first few pages)
      if (!cookiesDismissed) {
        const cookieSelectors = [
          'button:has-text("Aceptar todo")',
          'button:has-text("Aceptar todas")',
          'button:has-text("Aceptar")',
          '#onetrust-accept-btn-handler',
          '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
        ];
        for (const sel of cookieSelectors) {
          try {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 1000 })) {
              await btn.click();
              cookiesDismissed = true;
              await page.waitForTimeout(1000);
              console.log(`     🍪 Cookies aceptadas`);
              break;
            }
          } catch {}
        }
      }

      // Extra stability
      await page.waitForTimeout(1000);

      // Get page title and final URL
      const title = await page.title();
      const finalUrl = page.url();

      // --- Screenshot fullPage ---
      const screenshotFile = `${p.page_id}-fullpage.png`;
      const screenshotPath = path.join(outputDir, screenshotFile);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // --- Screenshot viewport ---
      const viewportFile = `${p.page_id}-viewport.png`;
      const viewportPath = path.join(outputDir, viewportFile);
      await page.screenshot({ path: viewportPath, fullPage: false });

      // --- HTML Snapshot (outer HTML of <html>) ---
      const htmlFile = `${p.page_id}.html`;
      const htmlPath = path.join(outputDir, htmlFile);
      const htmlContent = await page.content();
      fs.writeFileSync(htmlPath, htmlContent);

      const result = {
        page_id: p.page_id,
        url: p.url,
        final_url: finalUrl,
        title,
        tipo_de_pagina: p.tipo_de_pagina,
        motivo: p.motivo,
        files: {
          screenshot_fullpage: `pages/${screenshotFile}`,
          screenshot_viewport: `pages/${viewportFile}`,
          html_snapshot: `pages/${htmlFile}`,
        },
        status: 'ok',
      };
      results.push(result);

      console.log(`     ✅ title: "${title}"`);
      console.log(`     📸 ${screenshotFile}  |  📄 ${htmlFile}`);

    } catch (err) {
      console.log(`     ❌ ERROR: ${err.message}`);
      results.push({
        page_id: p.page_id,
        url: p.url,
        tipo_de_pagina: p.tipo_de_pagina,
        motivo: p.motivo,
        status: 'error',
        error: err.message,
      });
    }

    await page.close();
    console.log('');
  }

  // Save consolidated results
  const resultsPath = path.join(__dirname, 'output', 'audit-manifest.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    generated: new Date().toISOString(),
    viewport: { width: 1440, height: 900 },
    total_pages: PAGES.length,
    pages_ok: results.filter(r => r.status === 'ok').length,
    pages_error: results.filter(r => r.status === 'error').length,
    pages: results,
  }, null, 2));

  console.log(`${'='.repeat(60)}`);
  console.log(`  COMPLETADO`);
  console.log(`  OK: ${results.filter(r => r.status === 'ok').length} / ${PAGES.length}`);
  console.log(`  Manifiesto: ${resultsPath}`);
  console.log(`${'='.repeat(60)}`);

  await browser.close();
})();
