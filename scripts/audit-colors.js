const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Load manifest ──────────────────────────────────────────────────
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'output', 'audit-manifest.json'), 'utf8')
);
const PAGES = manifest.pages.filter(p => p.status === 'ok');

// ── Color utilities ────────────────────────────────────────────────
function normalizeColor(raw) {
  if (!raw || raw === 'none' || raw === 'transparent' || raw === 'currentColor') return null;
  // rgba(0, 0, 0, 0) → transparent
  const rgbaMatch = raw.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    if (a !== undefined && parseFloat(a) === 0) return null; // fully transparent
    const hex = '#' + [r, g, b].map(c => parseInt(c).toString(16).padStart(2, '0')).join('');
    const alpha = a !== undefined ? parseFloat(a) : 1;
    return { hex: hex.toLowerCase(), alpha, raw };
  }
  // Already hex
  if (raw.startsWith('#')) {
    let hex = raw.toLowerCase();
    if (hex.length === 4) hex = '#' + hex[1]+hex[1] + hex[2]+hex[2] + hex[3]+hex[3];
    return { hex, alpha: 1, raw };
  }
  return null;
}

// ── In-browser extraction function (serialized) ────────────────────
const EXTRACT_COLORS_FN = `(() => {
  const results = {
    textColor: {},
    backgroundColor: {},
    borderColor: {},
    iconColor: {},
    linkColor: {},
    buttonColor: {},
    gradients: [],
    shadowColor: {},
  };

  function rgbaToKey(raw) {
    return raw; // we normalize outside browser
  }

  function isVisible(el) {
    if (!el.offsetParent && el.tagName !== 'HTML' && el.tagName !== 'BODY' &&
        getComputedStyle(el).position !== 'fixed' && getComputedStyle(el).position !== 'sticky') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const vis = getComputedStyle(el).visibility;
    if (vis === 'hidden' || vis === 'collapse') return false;
    return true;
  }

  function addColor(bucket, color, tag, classes) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return;
    if (!bucket[color]) bucket[color] = { count: 0, samples: [] };
    bucket[color].count++;
    if (bucket[color].samples.length < 3) {
      bucket[color].samples.push(tag + (classes ? '.' + classes.split(' ').slice(0,2).join('.') : ''));
    }
  }

  // Walk all elements
  const allEls = document.querySelectorAll('*');
  for (const el of allEls) {
    if (!isVisible(el)) continue;

    const cs = getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const cls = (el.className && typeof el.className === 'string') ? el.className.trim() : '';
    const role = el.getAttribute('role') || '';

    // ── TEXT COLOR ──
    if (el.childNodes.length > 0) {
      // Only count if element has direct text
      let hasText = false;
      for (const child of el.childNodes) {
        if (child.nodeType === 3 && child.textContent.trim().length > 0) {
          hasText = true;
          break;
        }
      }
      if (hasText) {
        addColor(results.textColor, cs.color, tag, cls);
      }
    }

    // ── BACKGROUND COLOR ──
    const bg = cs.backgroundColor;
    addColor(results.backgroundColor, bg, tag, cls);

    // ── BACKGROUND GRADIENT ──
    const bgImage = cs.backgroundImage;
    if (bgImage && bgImage !== 'none' && bgImage.includes('gradient')) {
      if (results.gradients.length < 20) {
        results.gradients.push({
          gradient: bgImage.substring(0, 300),
          element: tag + (cls ? '.' + cls.split(' ').slice(0,2).join('.') : ''),
        });
      }
    }

    // ── BORDER COLOR ──
    const borders = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor];
    const borderWidths = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth];
    for (let i = 0; i < 4; i++) {
      if (borderWidths[i] && borderWidths[i] !== '0px') {
        addColor(results.borderColor, borders[i], tag, cls);
      }
    }
    // Outline
    if (cs.outlineWidth && cs.outlineWidth !== '0px' && cs.outlineStyle !== 'none') {
      addColor(results.borderColor, cs.outlineColor, tag + '[outline]', cls);
    }

    // ── ICON COLOR (SVG) ──
    if (tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'rect' ||
        tag === 'polygon' || tag === 'line' || tag === 'polyline' || tag === 'ellipse' ||
        tag === 'use' || tag === 'g') {
      const fill = cs.fill;
      const stroke = cs.stroke;
      if (fill && fill !== 'none' && fill !== 'transparent') {
        addColor(results.iconColor, fill, tag + '[fill]', cls);
      }
      if (stroke && stroke !== 'none' && stroke !== 'transparent') {
        addColor(results.iconColor, stroke, tag + '[stroke]', cls);
      }
    }
    // Icon fonts (i, span with icon class)
    if ((tag === 'i' || tag === 'span') &&
        (cls.includes('icon') || cls.includes('fa-') || cls.includes('material') ||
         cls.includes('glyphicon') || cls.includes('dashicon'))) {
      addColor(results.iconColor, cs.color, tag + '[icon-font]', cls);
    }

    // ── LINK COLOR ──
    if (tag === 'a' && el.hasAttribute('href')) {
      addColor(results.linkColor, cs.color, 'a', cls);
    }

    // ── BUTTON COLOR ──
    if (tag === 'button' || role === 'button' || tag === 'input' &&
        (el.type === 'submit' || el.type === 'button') ||
        cls.includes('btn') || cls.includes('button') || cls.includes('cta')) {
      addColor(results.buttonColor, cs.color, tag + '[text]', cls);
      addColor(results.buttonColor, cs.backgroundColor, tag + '[bg]', cls);
      addColor(results.buttonColor, cs.borderColor, tag + '[border]', cls);
    }

    // ── BOX SHADOW COLOR ──
    const shadow = cs.boxShadow;
    if (shadow && shadow !== 'none') {
      // Extract color from box-shadow
      const colorMatch = shadow.match(/rgba?\\([^)]+\\)/g);
      if (colorMatch) {
        for (const sc of colorMatch) {
          addColor(results.shadowColor, sc, tag + '[shadow]', cls);
        }
      }
    }
  }

  return results;
})()`;

// ── Main ───────────────────────────────────────────────────────────
(async () => {
  const outputDir = path.join(__dirname, 'output', 'colors');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  EXTRACCIÓN DE COLORES — ${PAGES.length} páginas`);
  console.log(`${'='.repeat(60)}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  let cookiesDismissed = false;
  const allPagesColors = [];

  for (let i = 0; i < PAGES.length; i++) {
    const p = PAGES[i];
    const num = `[${i + 1}/${PAGES.length}]`;
    console.log(`${num} ${p.page_id} — ${p.url}`);

    const page = await context.newPage();

    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1500);

      // Cookie banner
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

      // ── Extract raw colors ──
      const rawColors = await page.evaluate(EXTRACT_COLORS_FN);

      if (!rawColors || typeof rawColors !== 'object') {
        throw new Error('evaluate returned ' + typeof rawColors + ': ' + JSON.stringify(rawColors).substring(0, 200));
      }

      // ── Post-process: normalize colors ──
      const processed = {};
      for (const [category, colorMap] of Object.entries(rawColors)) {
        if (category === 'gradients') {
          processed.gradients = rawColors.gradients;
          continue;
        }
        const normalized = {};
        for (const [rawVal, data] of Object.entries(colorMap)) {
          const norm = normalizeColor(rawVal);
          if (!norm) continue;
          const key = norm.alpha < 1 ? `${norm.hex}/${norm.alpha}` : norm.hex;
          if (!normalized[key]) {
            normalized[key] = { hex: norm.hex, alpha: norm.alpha, count: 0, samples: [] };
          }
          normalized[key].count += data.count;
          normalized[key].samples.push(...data.samples);
          // Keep only top 3 samples
          normalized[key].samples = normalized[key].samples.slice(0, 3);
        }
        // Sort by count desc
        processed[category] = Object.values(normalized).sort((a, b) => b.count - a.count);
      }

      // Save per-page JSON
      const pagePath = path.join(outputDir, `${p.page_id}-colors.json`);
      fs.writeFileSync(pagePath, JSON.stringify(processed, null, 2));

      const counts = Object.entries(processed)
        .filter(([k]) => k !== 'gradients')
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : 0}`)
        .join(', ');
      console.log(`     ✅ ${counts}`);
      console.log(`     📊 gradients: ${processed.gradients?.length || 0}`);

      allPagesColors.push({
        page_id: p.page_id,
        tipo_de_pagina: p.tipo_de_pagina,
        colors: processed,
      });

    } catch (err) {
      console.log(`     ❌ ERROR: ${err.message}`);
    }

    await page.close();
  }

  // ══════════════════════════════════════════════════════════════════
  //  CONSOLIDATION: merge across all pages
  // ══════════════════════════════════════════════════════════════════
  console.log('\nConsolidando paleta global...');

  const CATEGORIES = [
    'textColor', 'backgroundColor', 'borderColor',
    'iconColor', 'linkColor', 'buttonColor', 'shadowColor'
  ];

  const global = {};
  for (const cat of CATEGORIES) {
    const merged = {};
    for (const pageData of allPagesColors) {
      const arr = pageData.colors[cat] || [];
      for (const entry of arr) {
        const key = entry.alpha < 1 ? `${entry.hex}/${entry.alpha}` : entry.hex;
        if (!merged[key]) {
          merged[key] = {
            hex: entry.hex,
            alpha: entry.alpha,
            total_count: 0,
            pages_seen: [],
            samples: [],
          };
        }
        merged[key].total_count += entry.count;
        if (!merged[key].pages_seen.includes(pageData.page_id)) {
          merged[key].pages_seen.push(pageData.page_id);
        }
        for (const s of entry.samples) {
          if (merged[key].samples.length < 5 && !merged[key].samples.includes(s)) {
            merged[key].samples.push(s);
          }
        }
      }
    }
    // Sort by total count desc
    global[cat] = Object.values(merged).sort((a, b) => b.total_count - a.total_count);
  }

  // All gradients
  const allGradients = [];
  const gradientSet = new Set();
  for (const pageData of allPagesColors) {
    for (const g of (pageData.colors.gradients || [])) {
      const key = g.gradient.substring(0, 100);
      if (!gradientSet.has(key)) {
        gradientSet.add(key);
        allGradients.push({ ...g, page_id: pageData.page_id });
      }
    }
  }
  global.gradients = allGradients;

  // ── Compute unique palette summary ──
  const uniqueHexes = new Set();
  for (const cat of CATEGORIES) {
    for (const entry of global[cat]) {
      uniqueHexes.add(entry.hex);
    }
  }

  const summary = {
    generated: new Date().toISOString(),
    total_unique_colors: uniqueHexes.size,
    pages_analyzed: PAGES.length,
    per_category_count: {},
  };
  for (const cat of CATEGORIES) {
    summary.per_category_count[cat] = global[cat].length;
  }
  summary.per_category_count.gradients = allGradients.length;

  const consolidatedPath = path.join(__dirname, 'output', 'colors-global.json');
  fs.writeFileSync(consolidatedPath, JSON.stringify({ summary, global }, null, 2));

  // ── Also generate a flat "design tokens" style palette ──
  const palette = {};
  for (const cat of CATEGORIES) {
    palette[cat] = global[cat]
      .filter(e => e.total_count >= 2 || e.pages_seen.length >= 2) // filter noise
      .slice(0, 30)
      .map(e => ({
        hex: e.hex,
        alpha: e.alpha,
        total_count: e.total_count,
        pages: e.pages_seen.length,
        samples: e.samples,
      }));
  }
  palette.gradients = allGradients.slice(0, 15);

  const palettePath = path.join(__dirname, 'output', 'color-palette.json');
  fs.writeFileSync(palettePath, JSON.stringify(palette, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  COMPLETADO`);
  console.log(`  Colores únicos (hex): ${uniqueHexes.size}`);
  for (const cat of CATEGORIES) {
    const top3 = global[cat].slice(0, 3).map(e => e.hex).join(', ');
    console.log(`  ${cat.padEnd(18)} ${String(global[cat].length).padStart(3)} valores — top: ${top3}`);
  }
  console.log(`  gradients          ${allGradients.length} únicos`);
  console.log(`\n  → ${consolidatedPath}`);
  console.log(`  → ${palettePath}`);
  console.log(`${'='.repeat(60)}`);

  await browser.close();
})();
