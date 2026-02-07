const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Load manifest ──────────────────────────────────────────────────
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'output', 'audit-manifest.json'), 'utf8')
);
const PAGES = manifest.pages.filter(p => p.status === 'ok');

// ── Target tags ────────────────────────────────────────────────────
const TARGET_TAGS = [
  'h1','h2','h3','h4','h5','h6',
  'p','a','li','button','input','textarea','select',
  'label','small','span','strong','em',
  'nav','footer','blockquote','figcaption','th','td','dt','dd'
];

// ── In-browser extraction (IIFE string) ────────────────────────────
const EXTRACT_TYPO_FN = `(() => {
  const TARGET = new Set(${JSON.stringify(TARGET_TAGS)});
  const results = [];

  function isVisible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    if (!el.offsetParent && cs.position !== 'fixed' && cs.position !== 'sticky' &&
        el.tagName !== 'HTML' && el.tagName !== 'BODY') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  function hasDirectText(el) {
    for (const child of el.childNodes) {
      if (child.nodeType === 3 && child.textContent.trim().length > 0) return true;
    }
    return false;
  }

  function getSemanticRole(el) {
    const tag = el.tagName.toLowerCase();
    const cls = (typeof el.className === 'string') ? el.className : '';
    const parent = el.parentElement;
    const parentTag = parent ? parent.tagName.toLowerCase() : '';
    const parentCls = parent && typeof parent.className === 'string' ? parent.className : '';

    // Detect hero context
    const isInHero = (function() {
      let n = el;
      for (let i = 0; i < 6 && n; i++) {
        const c = (typeof n.className === 'string') ? n.className.toLowerCase() : '';
        if (c.includes('hero') || c.includes('banner') || c.includes('entry-header') ||
            c.includes('cover') || c.includes('slider')) return true;
        n = n.parentElement;
      }
      return false;
    })();

    // Detect nav context
    const isInNav = (function() {
      let n = el;
      for (let i = 0; i < 6 && n; i++) {
        const t = n.tagName.toLowerCase();
        const c = (typeof n.className === 'string') ? n.className.toLowerCase() : '';
        if (t === 'nav' || c.includes('nav') || c.includes('menu') || c.includes('header')) return true;
        n = n.parentElement;
      }
      return false;
    })();

    // Detect footer
    const isInFooter = (function() {
      let n = el;
      for (let i = 0; i < 6 && n; i++) {
        const t = n.tagName.toLowerCase();
        const c = (typeof n.className === 'string') ? n.className.toLowerCase() : '';
        if (t === 'footer' || c.includes('footer')) return true;
        n = n.parentElement;
      }
      return false;
    })();

    // Detect card context
    const isInCard = (function() {
      let n = el;
      for (let i = 0; i < 4 && n; i++) {
        const c = (typeof n.className === 'string') ? n.className.toLowerCase() : '';
        if (c.includes('card') || c.includes('item-post') || c.includes('title-content') ||
            c.includes('block-button')) return true;
        n = n.parentElement;
      }
      return false;
    })();

    if (tag === 'h1' && isInHero) return 'H1 hero';
    if (tag === 'h1') return 'H1 page-title';
    if (tag === 'h2' && isInHero) return 'H2 hero-subtitle';
    if (tag === 'h2' && isInCard) return 'H2 card-title';
    if (tag === 'h2') return 'H2 section-title';
    if (tag === 'h3' && isInCard) return 'H3 card-title';
    if (tag === 'h3') return 'H3 subsection';
    if (tag === 'h4') return 'H4 subheading';
    if (tag === 'h5') return 'H5 small-heading';
    if (tag === 'h6') return 'H6 micro-heading';
    if (tag === 'p' && isInHero) return 'p hero-description';
    if (tag === 'p' && isInCard) return 'p card-text';
    if (tag === 'p' && isInFooter) return 'p footer-text';
    if (tag === 'p') return 'p body-text';
    if (tag === 'a' && isInNav) return 'a nav-link';
    if (tag === 'a' && isInFooter) return 'a footer-link';
    if (tag === 'a' && isInCard) return 'a card-link';
    if ((tag === 'a') && (cls.includes('button') || cls.includes('btn') || cls.includes('cta')))
      return 'a button-link';
    if (tag === 'a') return 'a link';
    if (tag === 'button' || (tag === 'input' && (el.type === 'submit' || el.type === 'button')))
      return 'button';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'form-input';
    if (tag === 'label') return 'label';
    if (tag === 'small') return 'small caption';
    if (tag === 'li' && isInNav) return 'li nav-item';
    if (tag === 'li' && isInFooter) return 'li footer-item';
    if (tag === 'li') return 'li list-item';
    if (tag === 'strong') return 'strong emphasis';
    if (tag === 'em') return 'em emphasis';
    if (tag === 'blockquote') return 'blockquote';
    if (tag === 'figcaption') return 'figcaption';
    if (tag === 'th') return 'th table-header';
    if (tag === 'td') return 'td table-cell';
    if (tag === 'dt') return 'dt definition-term';
    if (tag === 'dd') return 'dd definition-desc';
    if (tag === 'span' && isInNav) return 'span nav';
    if (tag === 'span') return 'span inline';
    return tag;
  }

  const allEls = document.querySelectorAll(${JSON.stringify(TARGET_TAGS.join(','))});
  for (const el of allEls) {
    const tag = el.tagName.toLowerCase();
    if (!isVisible(el)) continue;

    // For containers (nav, footer) skip unless they have direct text
    if (['nav','footer'].includes(tag) && !hasDirectText(el)) continue;
    // For span/strong/em only if they have direct text
    if (['span','strong','em'].includes(tag) && !hasDirectText(el)) continue;

    const cs = getComputedStyle(el);
    const text = (el.textContent || '').trim().substring(0, 80).replace(/\\s+/g, ' ');
    if (!text) continue;

    const fontFamily = cs.fontFamily;
    const fontSize = parseFloat(cs.fontSize);
    const fontWeight = cs.fontWeight;
    const lineHeight = cs.lineHeight === 'normal' ? 'normal' : parseFloat(cs.lineHeight);
    const letterSpacing = cs.letterSpacing === 'normal' ? 'normal' : cs.letterSpacing;
    const textTransform = cs.textTransform === 'none' ? null : cs.textTransform;
    const fontStyle = cs.fontStyle === 'normal' ? null : cs.fontStyle;

    const cls = (typeof el.className === 'string') ? el.className.trim() : '';
    const selector = tag + (cls ? '.' + cls.split(' ').slice(0, 2).join('.') : '');
    const role = getSemanticRole(el);

    results.push({
      tag,
      selector: selector.substring(0, 120),
      role,
      text: text.substring(0, 60),
      fontFamily,
      fontSize,
      fontWeight,
      lineHeight: typeof lineHeight === 'number' ? Math.round(lineHeight * 100) / 100 : lineHeight,
      letterSpacing,
      textTransform,
      fontStyle,
    });
  }

  return results;
})()`;

// ── Normalize font-family ──────────────────────────────────────────
function normFamily(raw) {
  // Remove quotes and extra whitespace
  return raw.replace(/["']/g, '').replace(/\s*,\s*/g, ', ').trim();
}

// Style key for grouping
function styleKey(entry) {
  return [
    normFamily(entry.fontFamily),
    Math.round(entry.fontSize),
    entry.fontWeight,
    typeof entry.lineHeight === 'number' ? Math.round(entry.lineHeight) : entry.lineHeight,
  ].join('|');
}

// ── Main ───────────────────────────────────────────────────────────
(async () => {
  const outputDir = path.join(__dirname, 'output', 'typography');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  AUDITORÍA TIPOGRÁFICA — ${PAGES.length} páginas`);
  console.log(`${'='.repeat(60)}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  let cookiesDismissed = false;

  // Collect all entries across pages
  const allEntries = []; // { ...entry, page_id }

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

      const entries = await page.evaluate(EXTRACT_TYPO_FN);
      if (!entries || !Array.isArray(entries)) {
        throw new Error('evaluate returned ' + typeof entries);
      }

      // Tag with page_id
      for (const e of entries) {
        e.page_id = p.page_id;
        allEntries.push(e);
      }

      // Save per-page
      const pagePath = path.join(outputDir, `${p.page_id}-typo.json`);
      fs.writeFileSync(pagePath, JSON.stringify(entries, null, 2));
      console.log(`     ✅ ${entries.length} nodos tipográficos extraídos`);

    } catch (err) {
      console.log(`     ❌ ${err.message}`);
    }
    await page.close();
  }

  await browser.close();

  // ══════════════════════════════════════════════════════════════════
  //  POST-PROCESSING
  // ══════════════════════════════════════════════════════════════════
  console.log(`\nProcesando ${allEntries.length} nodos tipográficos...\n`);

  // ── 1. Font families ──
  const familyMap = {};
  for (const e of allEntries) {
    const fam = normFamily(e.fontFamily);
    if (!familyMap[fam]) familyMap[fam] = { family: fam, count: 0, pages: new Set() };
    familyMap[fam].count++;
    familyMap[fam].pages.add(e.page_id);
  }
  const families = Object.values(familyMap)
    .map(f => ({ family: f.family, count: f.count, pages: f.pages.size, page_list: [...f.pages] }))
    .sort((a, b) => b.count - a.count);

  // ── 2. Group by typographic style ──
  const styleGroups = {};
  for (const e of allEntries) {
    const key = styleKey(e);
    if (!styleGroups[key]) {
      styleGroups[key] = {
        fontFamily: normFamily(e.fontFamily),
        fontSize: Math.round(e.fontSize),
        fontWeight: e.fontWeight,
        lineHeight: typeof e.lineHeight === 'number' ? Math.round(e.lineHeight) : e.lineHeight,
        letterSpacing: null,
        textTransform: null,
        fontStyle: null,
        count: 0,
        roles: {},
        pages: new Set(),
        examples: [],
      };
    }
    const g = styleGroups[key];
    g.count++;
    g.pages.add(e.page_id);
    // Roles
    if (!g.roles[e.role]) g.roles[e.role] = 0;
    g.roles[e.role]++;
    // letterSpacing / textTransform / fontStyle – take most common non-null
    if (e.letterSpacing !== 'normal' && e.letterSpacing) g.letterSpacing = e.letterSpacing;
    if (e.textTransform) g.textTransform = e.textTransform;
    if (e.fontStyle) g.fontStyle = e.fontStyle;
    // Examples (max 4)
    if (g.examples.length < 4) {
      g.examples.push({
        page: e.page_id,
        tag: e.tag,
        role: e.role,
        selector: e.selector,
        text: e.text,
      });
    }
  }

  // Convert to sorted array
  const styles = Object.values(styleGroups)
    .map(g => ({
      ...g,
      pages: g.pages.size,
      page_list: [...g.pages],
      roles: Object.entries(g.roles)
        .sort(([, a], [, b]) => b - a)
        .map(([role, count]) => ({ role, count })),
      typical_uses: Object.entries(g.roles)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([role]) => role),
    }))
    .sort((a, b) => b.count - a.count);

  // ── 3. Font-size scale ──
  const sizeMap = {};
  for (const s of styles) {
    const sz = s.fontSize;
    if (!sizeMap[sz]) sizeMap[sz] = { size_px: sz, count: 0, styles: [], roles: {} };
    sizeMap[sz].count += s.count;
    sizeMap[sz].styles.push({
      fontWeight: s.fontWeight,
      fontFamily: s.fontFamily.split(',')[0].trim(),
      count: s.count,
    });
    for (const r of s.roles) {
      if (!sizeMap[sz].roles[r.role]) sizeMap[sz].roles[r.role] = 0;
      sizeMap[sz].roles[r.role] += r.count;
    }
  }
  const scale = Object.values(sizeMap)
    .map(s => ({
      size_px: s.size_px,
      count_total: s.count,
      typical_uses: Object.entries(s.roles)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([role]) => role),
      styles: s.styles.sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.size_px - a.size_px);

  // ── 4. Suggested scale map ──
  // Pick the most-used sizes that are >= 2 pages or >= 5 uses
  const coreScaleSizes = scale
    .filter(s => s.count_total >= 5)
    .map(s => s.size_px)
    .sort((a, b) => a - b);

  // Round to nearest standard sizes
  const standardSnap = [10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 64, 72];
  function snapToStandard(px) {
    let best = standardSnap[0];
    let bestDist = Math.abs(px - best);
    for (const s of standardSnap) {
      if (Math.abs(px - s) < bestDist) { best = s; bestDist = Math.abs(px - s); }
    }
    return best;
  }
  const suggestedScale = [...new Set(coreScaleSizes.map(snapToStandard))].sort((a, b) => a - b);

  // ── Build final output ──
  const typography = {
    generated: new Date().toISOString(),
    total_nodes_analyzed: allEntries.length,
    pages_analyzed: PAGES.length,

    families,

    scale,

    top_styles: styles.slice(0, 25).map(s => ({
      fontFamily: s.fontFamily.split(',')[0].trim(),
      fontFamily_full: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      textTransform: s.textTransform,
      fontStyle: s.fontStyle,
      count: s.count,
      pages: s.pages,
      typical_uses: s.typical_uses,
      examples: s.examples,
    })),

    suggested_scale: {
      sizes_px: suggestedScale,
      note: 'Based on frequency analysis across 12 pages, snapped to standard typographic increments.',
      mapping: suggestedScale.map(sz => {
        const match = scale.find(s => Math.abs(s.size_px - sz) <= 1);
        return {
          size_px: sz,
          primary_use: match ? match.typical_uses[0] || '—' : '—',
          count: match ? match.count_total : 0,
        };
      }),
    },
  };

  const typoPath = path.join(__dirname, 'output', 'typography.json');
  fs.writeFileSync(typoPath, JSON.stringify(typography, null, 2));

  // ── Console summary ──
  console.log('FAMILIAS DETECTADAS:');
  for (const f of families.slice(0, 5)) {
    console.log(`  "${f.family.split(',')[0].trim()}" — ${f.count} usos, ${f.pages} páginas`);
  }

  console.log('\nESCALA DE TAMAÑOS (freq ≥ 5):');
  for (const s of scale.filter(x => x.count_total >= 5)) {
    console.log(`  ${String(s.size_px).padStart(3)}px  (×${String(s.count_total).padStart(4)})  ${s.typical_uses.slice(0, 3).join(', ')}`);
  }

  console.log(`\nESCALA SUGERIDA: ${suggestedScale.join(' / ')} px`);

  console.log('\nTOP 10 ESTILOS:');
  for (const s of styles.slice(0, 10)) {
    const fam = s.fontFamily.split(',')[0].trim();
    console.log(`  ${fam} ${s.fontSize}px/${s.fontWeight} lh:${s.lineHeight}  ×${s.count}  [${s.typical_uses.slice(0, 3).join(', ')}]`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  COMPLETADO — ${typoPath}`);
  console.log(`${'='.repeat(60)}`);
})();
