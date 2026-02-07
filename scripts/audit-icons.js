const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'output', 'audit-manifest.json'), 'utf8')
);
const PAGES = manifest.pages.filter(p => p.status === 'ok');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 12);
}

// ── In-browser icon detection ──────────────────────────────────────
const DETECT_ICONS_FN = `(() => {
  const icons = [];
  let idx = 0;

  function isVisible(el) {
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return false;
      return true;
    } catch { return false; }
  }

  function getContext(el) {
    let n = el.parentElement;
    for (let i = 0; i < 5 && n; i++) {
      const tag = n.tagName.toLowerCase();
      const cls = (typeof n.className === 'string') ? n.className : '';
      if (tag === 'nav' || cls.includes('nav') || cls.includes('menu')) return 'navigation';
      if (tag === 'header' || cls.includes('header')) return 'header';
      if (tag === 'footer' || cls.includes('footer')) return 'footer';
      if (cls.includes('hero') || cls.includes('banner') || cls.includes('cover')) return 'hero';
      if (cls.includes('card') || cls.includes('item-post') || cls.includes('title-content')) return 'card';
      if (tag === 'button' || cls.includes('btn') || cls.includes('button')) return 'button';
      if (tag === 'a') return 'link';
      n = n.parentElement;
    }
    return 'content';
  }

  // ── 1. Inline <svg> (top-level, not nested path/circle) ──
  document.querySelectorAll('svg').forEach(svg => {
    if (!isVisible(svg)) return;
    const rect = svg.getBoundingClientRect();
    // Only icons: max 120px either dimension
    if (rect.width > 120 || rect.height > 120) return;
    if (rect.width < 4 || rect.height < 4) return;

    const cs = getComputedStyle(svg);
    const outerHTML = svg.outerHTML;
    // Detect fill/stroke from first child with those attrs or computed
    let colorHint = null;
    const firstPath = svg.querySelector('path, circle, rect, polygon, line, use');
    if (firstPath) {
      const pcs = getComputedStyle(firstPath);
      const fill = pcs.fill;
      const stroke = pcs.stroke;
      if (fill && fill !== 'none' && fill !== 'transparent' && !fill.startsWith('url')) colorHint = fill;
      else if (stroke && stroke !== 'none' && stroke !== 'transparent') colorHint = stroke;
    }
    if (!colorHint) {
      const svgFill = svg.getAttribute('fill');
      if (svgFill && svgFill !== 'none') colorHint = svgFill;
    }
    if (!colorHint) colorHint = cs.color;

    // Check if it uses <use> (sprite)
    const useEl = svg.querySelector('use');
    let spriteRef = null;
    if (useEl) {
      spriteRef = useEl.getAttribute('xlink:href') || useEl.getAttribute('href') || null;
    }

    const cls = (typeof svg.className === 'object' && svg.className.baseVal)
      ? svg.className.baseVal : (typeof svg.className === 'string' ? svg.className : '');
    const ariaLabel = svg.getAttribute('aria-label') || '';
    const title = svg.querySelector('title')?.textContent || '';

    // Mark element for screenshot
    const markId = 'icon-mark-' + idx++;
    svg.setAttribute('data-icon-mark', markId);

    icons.push({
      type: spriteRef ? 'sprite' : 'svg',
      markId,
      hashSource: outerHTML.replace(/data-icon-mark="[^"]*"/g, '').substring(0, 2000),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      colorHint,
      spriteRef,
      className: cls.substring(0, 120),
      ariaLabel: ariaLabel.substring(0, 80),
      titleText: title.substring(0, 80),
      context: getContext(svg),
      selector: 'svg' + (cls ? '.' + cls.split(' ').filter(Boolean).slice(0,2).join('.') : ''),
    });
  });

  // ── 2. <img> icons (small images or icon-like names) ──
  document.querySelectorAll('img').forEach(img => {
    if (!isVisible(img)) return;
    const rect = img.getBoundingClientRect();
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    const cls = (typeof img.className === 'string') ? img.className : '';

    const isSmall = rect.width <= 80 && rect.height <= 80 && rect.width >= 4 && rect.height >= 4;
    const hasIconName = /icon|ico|logo-small|badge|symbol|sprite/i.test(src + ' ' + cls + ' ' + alt);
    const isSvgSrc = /\\.svg/i.test(src);

    if (!isSmall && !hasIconName) return;
    if (rect.width < 4 || rect.height < 4) return;
    if (rect.width > 120 || rect.height > 120) return;

    const markId = 'icon-mark-' + idx++;
    img.setAttribute('data-icon-mark', markId);

    icons.push({
      type: isSvgSrc ? 'img-svg' : 'img',
      markId,
      hashSource: src,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      colorHint: null,
      src: src.substring(0, 300),
      alt: alt.substring(0, 80),
      className: cls.substring(0, 120),
      context: getContext(img),
      selector: 'img' + (cls ? '.' + cls.split(' ').filter(Boolean).slice(0,2).join('.') : ''),
    });
  });

  // ── 3. Icon fonts (i, span with icon classes) ──
  const fontSelectors = [
    'i[class*="icon"]', 'i[class*="fa-"]', 'i[class*="fa "]',
    'i[class*="material"]', 'i[class*="glyphicon"]', 'i[class*="dashicon"]',
    'span[class*="icon"]', 'span[class*="fa-"]', 'span[class*="fa "]',
    'span[class*="material"]', 'span[class*="dashicon"]',
    'i[class*="svg-icon"]', 'span[class*="svg-icon"]',
  ];
  const seen = new Set();
  for (const sel of fontSelectors) {
    try {
      document.querySelectorAll(sel).forEach(el => {
        if (seen.has(el)) return;
        seen.add(el);
        if (!isVisible(el)) return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return;
        if (rect.width > 80 || rect.height > 80) return;

        const cls = (typeof el.className === 'string') ? el.className : '';
        const cs = getComputedStyle(el);
        const content = cs.content;
        const color = cs.color;

        const markId = 'icon-mark-' + idx++;
        el.setAttribute('data-icon-mark', markId);

        icons.push({
          type: 'icon-font',
          markId,
          hashSource: cls + '|' + (content || ''),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          colorHint: color,
          className: cls.substring(0, 120),
          pseudoContent: content ? content.substring(0, 20) : null,
          context: getContext(el),
          selector: el.tagName.toLowerCase() + '.' + cls.split(' ').filter(Boolean).slice(0,3).join('.'),
        });
      });
    } catch {}
  }

  return icons;
})()`;

// ── Main ───────────────────────────────────────────────────────────
(async () => {
  const iconsDir = path.join(__dirname, 'output', 'assets', 'icons');
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  INVENTARIO DE ICONOS — ${PAGES.length} páginas`);
  console.log(`${'='.repeat(60)}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  let cookiesDismissed = false;

  // Global dedup map: icon_id → data
  const globalIcons = {};

  for (let i = 0; i < PAGES.length; i++) {
    const p = PAGES[i];
    const num = `[${i + 1}/${PAGES.length}]`;
    console.log(`${num} ${p.page_id}`);

    const page = await context.newPage();
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1500);

      if (!cookiesDismissed) {
        try {
          const btn = page.locator('button:has-text("Aceptar todo")').first();
          if (await btn.isVisible({ timeout: 1000 })) {
            await btn.click();
            cookiesDismissed = true;
            await page.waitForTimeout(800);
          }
        } catch {}
      }
      await page.waitForTimeout(500);

      // Scroll down to trigger lazy elements, then back up
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(800);
      await page.evaluate('window.scrollTo(0, 0)');
      await page.waitForTimeout(500);

      // Detect icons
      const rawIcons = await page.evaluate(DETECT_ICONS_FN);
      if (!Array.isArray(rawIcons)) throw new Error('Detection returned ' + typeof rawIcons);

      console.log(`     🔍 ${rawIcons.length} iconos detectados (svg:${rawIcons.filter(x=>x.type==='svg').length} sprite:${rawIcons.filter(x=>x.type==='sprite').length} img:${rawIcons.filter(x=>x.type==='img'||x.type==='img-svg').length} font:${rawIcons.filter(x=>x.type==='icon-font').length})`);

      // Process each icon
      let screenshotsTaken = 0;
      for (const icon of rawIcons) {
        const iconId = md5(icon.hashSource);

        if (!globalIcons[iconId]) {
          globalIcons[iconId] = {
            icon_id: iconId,
            type: icon.type,
            occurrences_total: 0,
            pages_breakdown: {},
            sample_locations: [],
            size: { w: icon.width, h: icon.height },
            color_hint: icon.colorHint || null,
            className: icon.className || null,
            src: icon.src || null,
            spriteRef: icon.spriteRef || null,
            ariaLabel: icon.ariaLabel || null,
            titleText: icon.titleText || null,
            pseudoContent: icon.pseudoContent || null,
            asset_path_png: null,
            _needsScreenshot: true,
            _markId: icon.markId,
            _page_id_for_ss: p.page_id,
          };
        }

        globalIcons[iconId].occurrences_total++;
        if (!globalIcons[iconId].pages_breakdown[p.page_id]) {
          globalIcons[iconId].pages_breakdown[p.page_id] = 0;
        }
        globalIcons[iconId].pages_breakdown[p.page_id]++;

        if (globalIcons[iconId].sample_locations.length < 4) {
          globalIcons[iconId].sample_locations.push({
            page: p.page_id,
            context: icon.context,
            selector: icon.selector,
          });
        }

        // Take screenshot of first occurrence
        if (globalIcons[iconId]._needsScreenshot && globalIcons[iconId]._page_id_for_ss === p.page_id) {
          try {
            const el = page.locator(`[data-icon-mark="${icon.markId}"]`);
            if (await el.count() > 0) {
              // Scroll element into view
              await el.first().scrollIntoViewIfNeeded({ timeout: 2000 });
              await page.waitForTimeout(100);
              const pngPath = path.join(iconsDir, `${iconId}.png`);
              await el.first().screenshot({ path: pngPath });
              globalIcons[iconId].asset_path_png = `assets/icons/${iconId}.png`;
              globalIcons[iconId]._needsScreenshot = false;
              screenshotsTaken++;
            }
          } catch (err) {
            // Screenshot failed, skip
          }
        }
      }
      console.log(`     📸 ${screenshotsTaken} miniaturas nuevas capturadas`);

    } catch (err) {
      console.log(`     ❌ ${err.message}`);
    }
    await page.close();
  }

  // ── Second pass: capture any remaining screenshots ──
  const needScreenshot = Object.values(globalIcons).filter(ic => ic._needsScreenshot && ic.asset_path_png === null);
  if (needScreenshot.length > 0) {
    console.log(`\n🔄 Segunda pasada: ${needScreenshot.length} iconos sin miniatura...`);
    // Group by page
    const byPage = {};
    for (const ic of needScreenshot) {
      const pg = ic._page_id_for_ss;
      if (!byPage[pg]) byPage[pg] = [];
      byPage[pg].push(ic);
    }

    for (const [pageId, icons] of Object.entries(byPage)) {
      const pInfo = PAGES.find(p => p.page_id === pageId);
      if (!pInfo) continue;
      const page = await context.newPage();
      try {
        await page.goto(pInfo.url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(1500);
        // Re-detect (to re-add data-icon-mark)
        await page.evaluate(DETECT_ICONS_FN);
        await page.waitForTimeout(300);

        for (const ic of icons) {
          try {
            const el = page.locator(`[data-icon-mark="${ic._markId}"]`);
            if (await el.count() > 0) {
              await el.first().scrollIntoViewIfNeeded({ timeout: 2000 });
              await page.waitForTimeout(100);
              const pngPath = path.join(iconsDir, `${ic.icon_id}.png`);
              await el.first().screenshot({ path: pngPath });
              ic.asset_path_png = `assets/icons/${ic.icon_id}.png`;
              ic._needsScreenshot = false;
            }
          } catch {}
        }
      } catch {}
      await page.close();
    }
  }

  await browser.close();

  // ── Clean internal fields and build output ──
  const iconsList = Object.values(globalIcons)
    .map(ic => {
      const { _needsScreenshot, _markId, _page_id_for_ss, ...clean } = ic;
      return clean;
    })
    .sort((a, b) => b.occurrences_total - a.occurrences_total);

  const withScreenshots = iconsList.filter(ic => ic.asset_path_png);
  const withoutScreenshots = iconsList.filter(ic => !ic.asset_path_png);

  // Summary by type
  const byType = {};
  for (const ic of iconsList) {
    if (!byType[ic.type]) byType[ic.type] = { count_unique: 0, count_total: 0 };
    byType[ic.type].count_unique++;
    byType[ic.type].count_total += ic.occurrences_total;
  }

  const output = {
    generated: new Date().toISOString(),
    pages_analyzed: PAGES.length,
    total_unique_icons: iconsList.length,
    total_occurrences: iconsList.reduce((s, ic) => s + ic.occurrences_total, 0),
    by_type: byType,
    screenshots_captured: withScreenshots.length,
    top_20: iconsList.slice(0, 20).map(ic => ({
      icon_id: ic.icon_id,
      type: ic.type,
      occurrences_total: ic.occurrences_total,
      pages: Object.keys(ic.pages_breakdown).length,
      size: ic.size,
      color_hint: ic.color_hint,
      context: ic.sample_locations[0]?.context,
      className: ic.className,
      asset_path_png: ic.asset_path_png,
    })),
    icons: iconsList,
  };

  const outPath = path.join(__dirname, 'output', 'icons.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  // ── Console summary ──
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  INVENTARIO DE ICONOS — COMPLETADO`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Iconos únicos:    ${iconsList.length}`);
  console.log(`  Ocurrencias total: ${output.total_occurrences}`);
  console.log(`  Miniaturas PNG:   ${withScreenshots.length}`);
  console.log(`  Sin miniatura:    ${withoutScreenshots.length}`);
  console.log('');
  console.log('  Por tipo:');
  for (const [t, d] of Object.entries(byType)) {
    console.log(`    ${t.padEnd(12)} ${String(d.count_unique).padStart(3)} únicos, ${String(d.count_total).padStart(4)} usos`);
  }
  console.log('');
  console.log('  TOP 20:');
  for (let j = 0; j < Math.min(20, iconsList.length); j++) {
    const ic = iconsList[j];
    const pgs = Object.keys(ic.pages_breakdown).length;
    const ctx = ic.sample_locations[0]?.context || '';
    const label = ic.titleText || ic.ariaLabel || ic.className?.substring(0, 40) || ic.src?.split('/').pop()?.substring(0, 40) || ic.icon_id;
    console.log(`    ${String(j+1).padStart(2)}. [${ic.type.padEnd(9)}] ×${String(ic.occurrences_total).padStart(3)} (${pgs}pg) ${ic.size.w}×${ic.size.h}  ${ctx.padEnd(10)} ${label}`);
  }
  console.log(`\n  → ${outPath}`);
  console.log(`  → ${iconsDir}/`);
  console.log(`${'='.repeat(60)}`);
})();
