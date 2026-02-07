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

// ══════════════════════════════════════════════════════════════════════
//  IN-BROWSER COMPONENT DETECTION  (single IIFE string)
// ══════════════════════════════════════════════════════════════════════
const DETECT_FN = `(() => {
  const found = [];
  let idx = 0;

  /* ── helpers ─────────────────────────────────────────────── */
  function rect(el) {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  }
  function vis(el) {
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch { return false; }
  }
  function cls(el) { return typeof el.className === 'string' ? el.className.trim() : ''; }
  function markup(el, max) {
    const h = el.outerHTML || '';
    if (h.length <= max) return h;
    // Return opening tag + ...
    const close = h.indexOf('>');
    if (close > 0 && close < max) return h.substring(0, close + 1) + '...';
    return h.substring(0, max) + '...';
  }
  function mark(el) {
    const id = 'comp-mark-' + idx++;
    el.setAttribute('data-comp-mark', id);
    return id;
  }

  /* ── 1. HEADER / NAV ─────────────────────────────────────── */
  document.querySelectorAll('header, nav, [role="banner"], [role="navigation"]').forEach(el => {
    if (!vis(el)) return;
    const r = rect(el);
    if (r.h < 20 || r.w < 200) return;
    const tag = el.tagName.toLowerCase();
    const c = cls(el);
    const isHeader = tag === 'header' || c.includes('header') || el.getAttribute('role') === 'banner';
    const isNav = tag === 'nav' || c.includes('nav') || el.getAttribute('role') === 'navigation';
    // Skip nested navs inside header (count header as one)
    if (isNav && el.closest('header')) return;
    found.push({
      category: isHeader ? 'header' : 'navigation',
      markId: mark(el),
      hashSource: tag + '|' + c.substring(0, 200),
      selector: tag + (c ? '.' + c.split(' ').slice(0,2).join('.') : ''),
      markup: markup(el, 300),
      rect: r,
    });
  });

  /* ── 2. FOOTER ───────────────────────────────────────────── */
  document.querySelectorAll('footer, [role="contentinfo"]').forEach(el => {
    if (!vis(el)) return;
    const r = rect(el);
    if (r.h < 20) return;
    found.push({
      category: 'footer',
      markId: mark(el),
      hashSource: 'footer|' + cls(el).substring(0, 200),
      selector: 'footer' + (cls(el) ? '.' + cls(el).split(' ').slice(0,2).join('.') : ''),
      markup: markup(el, 300),
      rect: r,
    });
  });

  /* ── 3. BUTTONS ──────────────────────────────────────────── */
  document.querySelectorAll('button, [role="button"], a.wp-block-button__link, a[class*="btn"], a[class*="button"], input[type="submit"], input[type="button"]').forEach(el => {
    if (!vis(el)) return;
    const r = rect(el);
    if (r.w < 10 || r.h < 10) return;
    const c = cls(el);
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const color = cs.color;
    const border = cs.borderColor;
    // Classify variant
    let variant = 'default';
    if (bg && bg.includes('0, 117, 201') || bg && bg.includes('0, 101, 183') || bg && bg.includes('0, 86, 167'))
      variant = 'primary';
    else if (bg && (bg.includes('255, 255, 255') || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent'))
      variant = (border && (border.includes('0, 117') || border.includes('0, 101'))) ? 'secondary' : 'tertiary';
    const text = (el.textContent || '').trim().substring(0, 60);
    found.push({
      category: 'button',
      variant,
      markId: mark(el),
      hashSource: c.substring(0, 200) + '|' + variant,
      selector: el.tagName.toLowerCase() + (c ? '.' + c.split(' ').filter(Boolean).slice(0,3).join('.') : ''),
      markup: markup(el, 250),
      rect: r,
      meta: { text, bg, color, border, fontSize: cs.fontSize, fontWeight: cs.fontWeight },
    });
  });

  /* ── 4. LINKS (CTA vs normal) ────────────────────────────── */
  // Only top-level CTA-looking links (skip nav / button links already captured)
  document.querySelectorAll('a[href]').forEach(el => {
    if (!vis(el)) return;
    if (el.closest('nav') || el.closest('header') || el.closest('footer')) return;
    if (el.hasAttribute('data-comp-mark')) return;
    const c = cls(el);
    const isCTA = c.includes('btn') || c.includes('button') || c.includes('cta') ||
                  c.includes('wp-block-button') || c.includes('bold');
    if (!isCTA) return; // skip regular inline links
    const r = rect(el);
    if (r.w < 10 || r.h < 10) return;
    const text = (el.textContent || '').trim().substring(0, 60);
    found.push({
      category: 'link-cta',
      markId: mark(el),
      hashSource: 'cta|' + c.substring(0, 200),
      selector: 'a' + (c ? '.' + c.split(' ').filter(Boolean).slice(0,3).join('.') : ''),
      markup: markup(el, 250),
      rect: r,
      meta: { text },
    });
  });

  /* ── 5. FORM ELEMENTS ────────────────────────────────────── */
  document.querySelectorAll('form, .search-form, .search-map-form, [role="search"]').forEach(el => {
    if (!vis(el)) return;
    const r = rect(el);
    if (r.w < 50 || r.h < 20) return;
    found.push({
      category: 'form',
      markId: mark(el),
      hashSource: 'form|' + cls(el).substring(0, 200),
      selector: el.tagName.toLowerCase() + (cls(el) ? '.' + cls(el).split(' ').slice(0,2).join('.') : ''),
      markup: markup(el, 300),
      rect: r,
    });
  });
  ['input[type="text"]','input[type="email"]','input[type="search"]','input[type="tel"]',
   'input[type="number"]','input[type="password"]','textarea','select',
   'input[type="checkbox"]','input[type="radio"]'].forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (!vis(el)) return;
      if (el.hasAttribute('data-comp-mark')) return;
      const r = rect(el);
      if (r.w < 10) return;
      const inputType = el.type || el.tagName.toLowerCase();
      found.push({
        category: 'form-element',
        variant: inputType,
        markId: mark(el),
        hashSource: 'input|' + inputType + '|' + cls(el).substring(0, 100),
        selector: el.tagName.toLowerCase() + '[type=' + inputType + ']' + (cls(el) ? '.' + cls(el).split(' ').slice(0,2).join('.') : ''),
        markup: markup(el, 200),
        rect: r,
      });
    });
  });

  /* ── 6. CARDS / TEASERS ──────────────────────────────────── */
  document.querySelectorAll('[class*="card"], [class*="teaser"], [class*="item-post"], [class*="title-content"], .wp-block-column, article.post').forEach(el => {
    if (!vis(el)) return;
    if (el.hasAttribute('data-comp-mark')) return;
    const c = cls(el);
    // Filter: must look like a card (bounded, not full-width)
    const r = rect(el);
    if (r.w < 80 || r.h < 60 || r.w > 1200) return;
    // Skip if it's inside another already-marked card
    if (el.closest('[data-comp-mark]') && el.closest('[data-comp-mark]') !== el) return;
    found.push({
      category: 'card',
      markId: mark(el),
      hashSource: 'card|' + c.substring(0, 200),
      selector: el.tagName.toLowerCase() + (c ? '.' + c.split(' ').filter(Boolean).slice(0,3).join('.') : ''),
      markup: markup(el, 350),
      rect: r,
    });
  });

  /* ── 7. ACCORDIONS ───────────────────────────────────────── */
  document.querySelectorAll('[class*="accordion"], [class*="toggle"], details, [class*="expandable"], [class*="collaps"]').forEach(el => {
    if (!vis(el)) return;
    if (el.hasAttribute('data-comp-mark')) return;
    const c = cls(el);
    const r = rect(el);
    if (r.w < 100 || r.h < 30) return;
    // Only top-level accordion containers
    const parent = el.parentElement;
    if (parent && parent.hasAttribute('data-comp-mark')) return;
    found.push({
      category: 'accordion',
      markId: mark(el),
      hashSource: 'accordion|' + c.substring(0, 200),
      selector: el.tagName.toLowerCase() + (c ? '.' + c.split(' ').filter(Boolean).slice(0,2).join('.') : ''),
      markup: markup(el, 300),
      rect: r,
    });
  });

  /* ── 8. TABS ─────────────────────────────────────────────── */
  document.querySelectorAll('[class*="tabs"], [role="tablist"]').forEach(el => {
    if (!vis(el)) return;
    if (el.hasAttribute('data-comp-mark')) return;
    const r = rect(el);
    if (r.w < 100) return;
    found.push({
      category: 'tabs',
      markId: mark(el),
      hashSource: 'tabs|' + cls(el).substring(0, 200),
      selector: el.tagName.toLowerCase() + (cls(el) ? '.' + cls(el).split(' ').filter(Boolean).slice(0,2).join('.') : ''),
      markup: markup(el, 300),
      rect: r,
    });
  });

  /* ── 9. BREADCRUMBS ──────────────────────────────────────── */
  document.querySelectorAll('[class*="breadcrumb"], nav[aria-label*="bread"], [class*="crumb"]').forEach(el => {
    if (!vis(el)) return;
    const r = rect(el);
    found.push({
      category: 'breadcrumb',
      markId: mark(el),
      hashSource: 'breadcrumb|' + cls(el).substring(0, 100),
      selector: el.tagName.toLowerCase() + '.' + cls(el).split(' ').slice(0,2).join('.'),
      markup: markup(el, 250),
      rect: r,
    });
  });

  /* ── 10. SEARCH BARS ─────────────────────────────────────── */
  document.querySelectorAll('[class*="search"], [role="search"], input[type="search"]').forEach(el => {
    if (!vis(el)) return;
    if (el.hasAttribute('data-comp-mark')) return;
    const c = cls(el);
    if (!c.includes('search') && el.getAttribute('role') !== 'search' && el.type !== 'search') return;
    const r = rect(el);
    if (r.w < 60 || r.h < 20) return;
    found.push({
      category: 'search-bar',
      markId: mark(el),
      hashSource: 'search|' + c.substring(0, 150),
      selector: el.tagName.toLowerCase() + (c ? '.' + c.split(' ').filter(Boolean).slice(0,2).join('.') : ''),
      markup: markup(el, 250),
      rect: r,
    });
  });

  /* ── 11. PAGINATION ──────────────────────────────────────── */
  document.querySelectorAll('[class*="pagination"], [class*="pager"], nav[aria-label*="paginat"]').forEach(el => {
    if (!vis(el)) return;
    found.push({
      category: 'pagination',
      markId: mark(el),
      hashSource: 'pagination|' + cls(el).substring(0, 100),
      selector: el.tagName.toLowerCase() + '.' + cls(el).split(' ').slice(0,2).join('.'),
      markup: markup(el, 250),
      rect: rect(el),
    });
  });

  /* ── 12. CHIPS / TAGS / BADGES ───────────────────────────── */
  document.querySelectorAll('[class*="tag"], [class*="badge"], [class*="chip"], [class*="category-link"], [class*="label-cat"]').forEach(el => {
    if (!vis(el)) return;
    if (el.hasAttribute('data-comp-mark')) return;
    const c = cls(el);
    // Filter out non-UI uses of "tag"
    if (el.tagName === 'META' || el.tagName === 'LINK') return;
    const r = rect(el);
    if (r.w < 15 || r.h < 10 || r.h > 60) return;
    found.push({
      category: 'chip-tag',
      markId: mark(el),
      hashSource: 'chip|' + c.substring(0, 100),
      selector: el.tagName.toLowerCase() + (c ? '.' + c.split(' ').filter(Boolean).slice(0,2).join('.') : ''),
      markup: markup(el, 200),
      rect: r,
    });
  });

  /* ── 13. TABLES ──────────────────────────────────────────── */
  document.querySelectorAll('table').forEach(el => {
    if (!vis(el)) return;
    const r = rect(el);
    if (r.w < 100) return;
    found.push({
      category: 'table',
      markId: mark(el),
      hashSource: 'table|' + cls(el).substring(0, 100),
      selector: 'table' + (cls(el) ? '.' + cls(el).split(' ').slice(0,2).join('.') : ''),
      markup: markup(el, 300),
      rect: r,
    });
  });

  /* ── 14. ALERTS / NOTIFICATIONS ──────────────────────────── */
  document.querySelectorAll('[class*="alert"], [class*="notification"], [class*="notice"], [role="alert"], [role="status"]').forEach(el => {
    if (!vis(el)) return;
    const r = rect(el);
    if (r.w < 50) return;
    found.push({
      category: 'alert',
      markId: mark(el),
      hashSource: 'alert|' + cls(el).substring(0, 100),
      selector: el.tagName.toLowerCase() + '.' + cls(el).split(' ').slice(0,2).join('.'),
      markup: markup(el, 250),
      rect: r,
    });
  });

  /* ── 15. MODALS / DRAWERS ────────────────────────────────── */
  document.querySelectorAll('[class*="modal"], [class*="drawer"], [class*="overlay"], [role="dialog"]').forEach(el => {
    const c = cls(el);
    // Only if it seems like a modal container
    if (!c.includes('modal') && !c.includes('drawer') && !c.includes('dialog') &&
        el.getAttribute('role') !== 'dialog') return;
    const r = rect(el);
    found.push({
      category: 'modal',
      markId: mark(el),
      hashSource: 'modal|' + c.substring(0, 100),
      selector: el.tagName.toLowerCase() + '.' + c.split(' ').slice(0,2).join('.'),
      markup: markup(el, 300),
      rect: r,
      meta: { visible: vis(el) },
    });
  });

  /* ── 16. LISTS (styled) ──────────────────────────────────── */
  document.querySelectorAll('ul, ol').forEach(el => {
    if (!vis(el)) return;
    if (el.hasAttribute('data-comp-mark')) return;
    if (el.closest('nav') || el.closest('[data-comp-mark]')) return;
    const c = cls(el);
    const r = rect(el);
    if (r.h < 30 || r.w < 100) return;
    // Must have at least 2 visible li
    const lis = el.querySelectorAll(':scope > li');
    if (lis.length < 2) return;
    // Skip very large lists (likely nav menus already captured)
    if (lis.length > 30) return;
    found.push({
      category: 'list',
      variant: el.tagName.toLowerCase(),
      markId: mark(el),
      hashSource: 'list|' + el.tagName + '|' + c.substring(0, 100),
      selector: el.tagName.toLowerCase() + (c ? '.' + c.split(' ').filter(Boolean).slice(0,2).join('.') : ''),
      markup: markup(el, 300),
      rect: r,
      meta: { items: lis.length },
    });
  });

  return found;
})()`;

// ══════════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════════
(async () => {
  const compDir = path.join(__dirname, 'output', 'assets', 'components');
  if (!fs.existsSync(compDir)) fs.mkdirSync(compDir, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  INVENTARIO DE COMPONENTES UI — ${PAGES.length} páginas`);
  console.log(`${'='.repeat(60)}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  let cookiesDismissed = false;
  const globalComps = {}; // component_id → data

  for (let i = 0; i < PAGES.length; i++) {
    const p = PAGES[i];
    console.log(`[${i + 1}/${PAGES.length}] ${p.page_id}`);

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

      // Scroll full page to trigger lazy content
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(600);
      await page.evaluate('window.scrollTo(0, 0)');
      await page.waitForTimeout(400);

      const rawComps = await page.evaluate(DETECT_FN);
      if (!Array.isArray(rawComps)) throw new Error('returned ' + typeof rawComps);

      // Count by category for this page
      const catCount = {};
      for (const c of rawComps) {
        catCount[c.category] = (catCount[c.category] || 0) + 1;
      }
      const catSummary = Object.entries(catCount).map(([k, v]) => `${k}:${v}`).join(' ');
      console.log(`     🧩 ${rawComps.length} componentes — ${catSummary}`);

      // Dedup and screenshot
      let ssCount = 0;
      for (const comp of rawComps) {
        const compId = md5(comp.hashSource);

        if (!globalComps[compId]) {
          globalComps[compId] = {
            component_id: compId,
            category: comp.category,
            variant: comp.variant || null,
            occurrences: 0,
            pages: {},
            sample_locations: [],
            selector: comp.selector,
            markup_sample: comp.markup,
            size: { w: comp.rect.w, h: comp.rect.h },
            meta: comp.meta || null,
            asset_path_png: null,
            _markId: comp.markId,
            _needsSS: true,
            _ssPage: p.page_id,
          };
        }

        const g = globalComps[compId];
        g.occurrences++;
        if (!g.pages[p.page_id]) g.pages[p.page_id] = 0;
        g.pages[p.page_id]++;

        if (g.sample_locations.length < 3) {
          g.sample_locations.push({ page: p.page_id, rect: comp.rect });
        }

        // Screenshot first occurrence
        if (g._needsSS && g._ssPage === p.page_id) {
          try {
            const el = page.locator(`[data-comp-mark="${comp.markId}"]`);
            if (await el.count() > 0) {
              await el.first().scrollIntoViewIfNeeded({ timeout: 3000 });
              await page.waitForTimeout(150);
              // Clip to max 1440x600 to avoid huge screenshots
              const box = await el.first().boundingBox();
              if (box) {
                const clipW = Math.min(box.width, 1440);
                const clipH = Math.min(box.height, 600);
                const clipX = Math.max(0, box.x);
                const clipY = Math.max(0, box.y);
                const pngPath = path.join(compDir, `${compId}.png`);
                await page.screenshot({
                  path: pngPath,
                  clip: { x: clipX, y: clipY, width: clipW, height: clipH },
                });
                g.asset_path_png = `assets/components/${compId}.png`;
                g._needsSS = false;
                ssCount++;
              }
            }
          } catch {}
        }
      }
      console.log(`     📸 ${ssCount} capturas nuevas`);

    } catch (err) {
      console.log(`     ❌ ${err.message}`);
    }
    await page.close();
  }

  await browser.close();

  // ── Build output ──
  const compsList = Object.values(globalComps)
    .map(c => {
      const { _markId, _needsSS, _ssPage, ...clean } = c;
      clean.pages_count = Object.keys(clean.pages).length;
      clean.pages_list = Object.keys(clean.pages);
      return clean;
    })
    .sort((a, b) => b.occurrences - a.occurrences);

  // Category summary
  const byCat = {};
  for (const c of compsList) {
    if (!byCat[c.category]) byCat[c.category] = { unique: 0, total: 0, variants: {} };
    byCat[c.category].unique++;
    byCat[c.category].total += c.occurrences;
    if (c.variant) {
      byCat[c.category].variants[c.variant] = (byCat[c.category].variants[c.variant] || 0) + c.occurrences;
    }
  }

  const output = {
    generated: new Date().toISOString(),
    pages_analyzed: PAGES.length,
    total_unique_components: compsList.length,
    total_occurrences: compsList.reduce((s, c) => s + c.occurrences, 0),
    screenshots_captured: compsList.filter(c => c.asset_path_png).length,
    by_category: byCat,
    top_components: compsList.slice(0, 30).map(c => ({
      component_id: c.component_id,
      category: c.category,
      variant: c.variant,
      occurrences: c.occurrences,
      pages_count: c.pages_count,
      size: c.size,
      selector: c.selector,
      asset_path_png: c.asset_path_png,
    })),
    components: compsList,
  };

  const outPath = path.join(__dirname, 'output', 'components.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  // Console
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  INVENTARIO COMPLETADO`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Componentes únicos: ${compsList.length}`);
  console.log(`  Ocurrencias total:  ${output.total_occurrences}`);
  console.log(`  Screenshots:        ${output.screenshots_captured}`);
  console.log('');
  console.log('  POR CATEGORÍA:');
  for (const [cat, d] of Object.entries(byCat).sort((a, b) => b[1].total - a[1].total)) {
    const vars = Object.keys(d.variants).length > 0
      ? ' (' + Object.entries(d.variants).map(([k,v]) => k+':'+v).join(', ') + ')'
      : '';
    console.log(`    ${cat.padEnd(16)} ${String(d.unique).padStart(3)} únicos, ${String(d.total).padStart(4)} usos${vars}`);
  }
  console.log('');
  console.log('  TOP 15 POR REPETICIÓN:');
  for (let j = 0; j < Math.min(15, compsList.length); j++) {
    const c = compsList[j];
    console.log(`    ${String(j+1).padStart(2)}. [${c.category.padEnd(14)}] ×${String(c.occurrences).padStart(3)} (${c.pages_count}pg) ${c.size.w}×${c.size.h}  ${c.selector.substring(0, 60)}`);
  }
  console.log(`\n  → ${outPath}`);
  console.log(`  → ${compDir}/`);
  console.log(`${'='.repeat(60)}`);
})();
