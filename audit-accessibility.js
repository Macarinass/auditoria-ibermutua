const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'output', 'audit-manifest.json'), 'utf8')
);
const PAGES = manifest.pages.filter(p => p.status === 'ok');

// ══════════════════════════════════════════════════════════════
//  WCAG CONTRAST UTILITIES (Node-side)
// ══════════════════════════════════════════════════════════════
function parseRgba(raw) {
  if (!raw) return null;
  const m = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

function relativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg.r, fg.g, fg.b);
  const l2 = relativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Blend foreground with alpha over opaque background
function alphaBlend(fg, bg) {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}

function wcagLevel(ratio, isLargeText) {
  if (isLargeText) {
    if (ratio >= 4.5) return 'AAA';
    if (ratio >= 3) return 'AA';
    return 'FAIL';
  } else {
    if (ratio >= 7) return 'AAA';
    if (ratio >= 4.5) return 'AA';
    return 'FAIL';
  }
}

// ══════════════════════════════════════════════════════════════
//  IN-BROWSER: CONTRAST PAIRS + GENERAL A11Y CHECKS
// ══════════════════════════════════════════════════════════════
const AUDIT_FN = `(() => {
  const contrastPairs = [];
  const a11yIssues = [];
  let idx = 0;

  /* helpers */
  function vis(el) {
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch { return false; }
  }

  function getEffectiveBg(el) {
    let node = el;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      const bg = cs.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        return bg;
      }
      node = node.parentElement;
    }
    return 'rgb(255, 255, 255)'; // default white
  }

  function hasDirectText(el) {
    for (const c of el.childNodes) {
      if (c.nodeType === 3 && c.textContent.trim().length > 0) return true;
    }
    return false;
  }

  function getContext(el) {
    let n = el;
    for (let i = 0; i < 5 && n; i++) {
      const tag = n.tagName?.toLowerCase() || '';
      const cls = (typeof n.className === 'string') ? n.className.toLowerCase() : '';
      if (tag === 'nav' || cls.includes('nav')) return 'nav';
      if (tag === 'header' || cls.includes('header')) return 'header';
      if (tag === 'footer' || cls.includes('footer')) return 'footer';
      if (cls.includes('hero') || cls.includes('banner')) return 'hero';
      if (cls.includes('card') || cls.includes('item-post')) return 'card';
      if (tag === 'button' || cls.includes('btn')) return 'button';
      n = n.parentElement;
    }
    return 'content';
  }

  // ── 1. CONTRAST: Text elements ──
  const textTags = 'h1,h2,h3,h4,h5,h6,p,a,li,span,strong,em,label,button,small,figcaption,blockquote,td,th,dt,dd,input,select,textarea';
  document.querySelectorAll(textTags).forEach(el => {
    if (!vis(el)) return;
    if (!hasDirectText(el) && !['input','select','textarea'].includes(el.tagName.toLowerCase())) return;

    const cs = getComputedStyle(el);
    const fg = cs.color;
    const bg = getEffectiveBg(el);
    const fontSize = parseFloat(cs.fontSize);
    const fontWeight = parseInt(cs.fontWeight) || 400;
    const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    const tag = el.tagName.toLowerCase();
    const cls = (typeof el.className === 'string') ? el.className.trim() : '';
    const text = (el.textContent || '').trim().substring(0, 60).replace(/\\s+/g, ' ');

    contrastPairs.push({
      fg, bg, fontSize, fontWeight, isLarge,
      tag, cls: cls.substring(0, 80),
      text: text.substring(0, 50),
      context: getContext(el),
      selector: tag + (cls ? '.' + cls.split(' ').slice(0,2).join('.') : ''),
    });
  });

  // ── 2. CONTRAST: SVG icons ──
  document.querySelectorAll('svg').forEach(svg => {
    if (!vis(svg)) return;
    const r = svg.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.width > 120) return;
    const firstShape = svg.querySelector('path,circle,rect,polygon,line');
    if (!firstShape) return;
    const shapeFill = getComputedStyle(firstShape).fill;
    if (!shapeFill || shapeFill === 'none' || shapeFill === 'transparent') return;
    const bg = getEffectiveBg(svg);
    contrastPairs.push({
      fg: shapeFill, bg, fontSize: 0, fontWeight: 0, isLarge: true,
      tag: 'svg-icon', cls: '', text: '[icon]',
      context: getContext(svg),
      selector: 'svg',
      isIcon: true,
    });
  });

  // ── 3. GENERAL A11Y CHECKS ──

  // 3a. Images without alt
  document.querySelectorAll('img').forEach(img => {
    if (!vis(img)) return;
    const alt = img.getAttribute('alt');
    if (alt === null) {
      a11yIssues.push({
        type: 'missing-alt',
        severity: 'error',
        criterion: '1.1.1',
        tag: 'img',
        selector: 'img' + (img.className ? '.' + img.className.split(' ').slice(0,2).join('.') : ''),
        src: (img.src || '').substring(0, 120),
        detail: 'Imagen sin atributo alt',
      });
    } else if (alt.trim() === '' && !img.closest('a') && !img.getAttribute('role')) {
      // Empty alt on non-decorative context might be ok, but flag for review
      a11yIssues.push({
        type: 'empty-alt',
        severity: 'warning',
        criterion: '1.1.1',
        tag: 'img',
        selector: 'img',
        src: (img.src || '').substring(0, 120),
        detail: 'Imagen con alt vacío (verificar si es decorativa)',
      });
    }
  });

  // 3b. Form elements without labels
  document.querySelectorAll('input,select,textarea').forEach(el => {
    if (!vis(el)) return;
    if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') return;
    const id = el.id;
    const hasLabel = id && document.querySelector('label[for="' + id + '"]');
    const hasAriaLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
    const hasTitle = el.getAttribute('title');
    const wrappedInLabel = el.closest('label');
    if (!hasLabel && !hasAriaLabel && !hasTitle && !wrappedInLabel) {
      a11yIssues.push({
        type: 'missing-label',
        severity: 'error',
        criterion: '1.3.1 / 4.1.2',
        tag: el.tagName.toLowerCase(),
        selector: el.tagName.toLowerCase() + '[type=' + (el.type||'text') + ']',
        detail: 'Campo de formulario sin label, aria-label ni title',
      });
    }
  });

  // 3c. Heading hierarchy
  const headings = [];
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
    if (!vis(h)) return;
    headings.push({ level: parseInt(h.tagName[1]), text: h.textContent.trim().substring(0, 60) });
  });
  const h1Count = headings.filter(h => h.level === 1).length;
  if (h1Count === 0) {
    a11yIssues.push({ type: 'heading-no-h1', severity: 'error', criterion: '1.3.1', tag: 'h1', detail: 'No se encontró ningún H1 en la página' });
  } else if (h1Count > 1) {
    a11yIssues.push({ type: 'heading-multiple-h1', severity: 'warning', criterion: '1.3.1', tag: 'h1', detail: 'Múltiples H1 (' + h1Count + '). Recomendado: uno solo.' });
  }
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level - headings[i-1].level > 1) {
      a11yIssues.push({
        type: 'heading-skip',
        severity: 'warning',
        criterion: '1.3.1',
        tag: 'h' + headings[i].level,
        detail: 'Salto de nivel: H' + headings[i-1].level + ' → H' + headings[i].level + ' ("' + headings[i].text.substring(0,30) + '")',
      });
    }
  }

  // 3d. Links without discernible text
  document.querySelectorAll('a[href]').forEach(a => {
    if (!vis(a)) return;
    const text = a.textContent.trim();
    const ariaLabel = a.getAttribute('aria-label') || '';
    const title = a.getAttribute('title') || '';
    const imgAlt = a.querySelector('img')?.getAttribute('alt') || '';
    if (!text && !ariaLabel && !title && !imgAlt) {
      a11yIssues.push({
        type: 'link-no-text',
        severity: 'error',
        criterion: '2.4.4 / 4.1.2',
        tag: 'a',
        selector: 'a[href]',
        detail: 'Enlace sin texto discernible ni aria-label',
        href: (a.href || '').substring(0, 100),
      });
    }
  });

  // 3e. Buttons without discernible text
  document.querySelectorAll('button,[role="button"]').forEach(btn => {
    if (!vis(btn)) return;
    const text = btn.textContent.trim();
    const ariaLabel = btn.getAttribute('aria-label') || '';
    const title = btn.getAttribute('title') || '';
    if (!text && !ariaLabel && !title) {
      a11yIssues.push({
        type: 'button-no-text',
        severity: 'error',
        criterion: '4.1.2',
        tag: btn.tagName.toLowerCase(),
        detail: 'Botón sin texto discernible ni aria-label',
      });
    }
  });

  // 3f. Document lang
  const htmlLang = document.documentElement.getAttribute('lang');
  if (!htmlLang) {
    a11yIssues.push({ type: 'no-lang', severity: 'error', criterion: '3.1.1', tag: 'html', detail: 'Elemento <html> sin atributo lang' });
  }

  // 3g. Focus visible — check if there are :focus styles that remove outlines
  // We can't fully test this but flag common anti-patterns
  const styles = document.querySelectorAll('style');
  let hasOutlineNone = false;
  styles.forEach(s => {
    if (s.textContent.includes('outline: none') || s.textContent.includes('outline:none') ||
        s.textContent.includes('outline: 0') || s.textContent.includes('outline:0')) {
      hasOutlineNone = true;
    }
  });
  if (hasOutlineNone) {
    a11yIssues.push({
      type: 'focus-outline-removed',
      severity: 'warning',
      criterion: '2.4.7',
      tag: 'style',
      detail: 'Se detectó "outline: none/0" en estilos. Verificar que existe indicador de foco alternativo.',
    });
  }

  // 3h. Landmark regions
  const hasMain = !!document.querySelector('main, [role="main"]');
  const hasNav = !!document.querySelector('nav, [role="navigation"]');
  if (!hasMain) {
    a11yIssues.push({ type: 'no-main-landmark', severity: 'warning', criterion: '1.3.1', tag: 'main', detail: 'No se encontró landmark <main> o role="main"' });
  }

  // 3i. Skip navigation link
  const skipLink = document.querySelector('a[href="#content"], a[href="#main"], a.skip-link, a.screen-reader-text');
  if (!skipLink) {
    a11yIssues.push({ type: 'no-skip-link', severity: 'warning', criterion: '2.4.1', tag: 'a', detail: 'No se detectó enlace "saltar al contenido" (skip navigation)' });
  }

  // 3j. Touch target size (WCAG 2.5.5 — 44x44 min for AA)
  document.querySelectorAll('a, button, [role="button"], input[type="submit"]').forEach(el => {
    if (!vis(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24)) {
      // Only flag very small targets
      if (r.width < 24 && r.height < 24) {
        a11yIssues.push({
          type: 'small-touch-target',
          severity: 'warning',
          criterion: '2.5.5',
          tag: el.tagName.toLowerCase(),
          detail: 'Objetivo táctil muy pequeño: ' + Math.round(r.width) + '×' + Math.round(r.height) + 'px (mínimo 44×44 recomendado)',
          selector: el.tagName.toLowerCase() + (el.className ? '.' + (typeof el.className === 'string' ? el.className : '').split(' ').slice(0,2).join('.') : ''),
        });
      }
    }
  });

  return { contrastPairs, a11yIssues, headingStructure: headings, htmlLang };
})()`;

// ══════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════
(async () => {
  const outDir = path.join(__dirname, 'output');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  AUDITORÍA DE ACCESIBILIDAD (WCAG AA) — ${PAGES.length} páginas`);
  console.log(`${'='.repeat(60)}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });

  let cookiesDismissed = false;

  // Global accumulators
  const allContrastPairs = [];  // { ...pair, page_id, ratio, level }
  const allIssues = [];         // { ...issue, page_id }
  const pageSummaries = [];

  for (let i = 0; i < PAGES.length; i++) {
    const p = PAGES[i];
    console.log(`[${i+1}/${PAGES.length}] ${p.page_id}`);
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

      const raw = await page.evaluate(AUDIT_FN);
      if (!raw || typeof raw !== 'object') throw new Error('returned ' + typeof raw);

      // Process contrast pairs
      let passCount = 0, failCount = 0;
      for (const pair of raw.contrastPairs) {
        const fgParsed = parseRgba(pair.fg);
        const bgParsed = parseRgba(pair.bg);
        if (!fgParsed || !bgParsed) continue;

        // Blend if fg has alpha
        const fgFinal = fgParsed.a < 1 ? alphaBlend(fgParsed, bgParsed) : fgParsed;
        const bgFinal = bgParsed; // bg should already be opaque from our walker

        const ratio = contrastRatio(fgFinal, bgFinal);
        const level = wcagLevel(ratio, pair.isLarge);

        const entry = {
          page_id: p.page_id,
          fg_raw: pair.fg,
          bg_raw: pair.bg,
          fg_hex: rgbToHex(fgFinal.r, fgFinal.g, fgFinal.b),
          bg_hex: rgbToHex(bgFinal.r, bgFinal.g, bgFinal.b),
          ratio: Math.round(ratio * 100) / 100,
          level,
          isLarge: pair.isLarge,
          isIcon: pair.isIcon || false,
          fontSize: pair.fontSize,
          fontWeight: pair.fontWeight,
          tag: pair.tag,
          text: pair.text,
          context: pair.context,
          selector: pair.selector,
        };
        allContrastPairs.push(entry);
        if (level === 'FAIL') failCount++; else passCount++;
      }

      // A11y issues
      for (const issue of raw.a11yIssues) {
        allIssues.push({ ...issue, page_id: p.page_id });
      }

      pageSummaries.push({
        page_id: p.page_id,
        pairs_total: raw.contrastPairs.length,
        pairs_pass: passCount,
        pairs_fail: failCount,
        issues_error: raw.a11yIssues.filter(i => i.severity === 'error').length,
        issues_warning: raw.a11yIssues.filter(i => i.severity === 'warning').length,
        htmlLang: raw.htmlLang,
        headings: raw.headingStructure?.length || 0,
      });

      console.log(`     ✅ contrast: ${passCount} pass / ${failCount} fail | issues: ${raw.a11yIssues.length}`);

    } catch (err) {
      console.log(`     ❌ ${err.message}`);
    }
    await page.close();
  }

  await browser.close();

  // ══════════════════════════════════════════════════════════════
  //  POST-PROCESSING: Deduplicate contrast pairs
  // ══════════════════════════════════════════════════════════════
  const pairMap = {};
  for (const pair of allContrastPairs) {
    const key = `${pair.fg_hex}|${pair.bg_hex}|${pair.isLarge ? 'L' : 'N'}`;
    if (!pairMap[key]) {
      pairMap[key] = {
        fg_hex: pair.fg_hex,
        bg_hex: pair.bg_hex,
        ratio: pair.ratio,
        level: pair.level,
        isLarge: pair.isLarge,
        count: 0,
        pages: new Set(),
        samples: [],
        contexts: new Set(),
      };
    }
    pairMap[key].count++;
    pairMap[key].pages.add(pair.page_id);
    pairMap[key].contexts.add(pair.context);
    if (pairMap[key].samples.length < 3) {
      pairMap[key].samples.push({
        tag: pair.tag, text: pair.text, page: pair.page_id,
        fontSize: pair.fontSize, fontWeight: pair.fontWeight,
      });
    }
  }

  const uniquePairs = Object.values(pairMap)
    .map(p => ({
      ...p,
      pages: [...p.pages],
      pages_count: p.pages.size,
      contexts: [...p.contexts],
    }))
    .sort((a, b) => a.ratio - b.ratio); // worst contrast first

  // Deduplicate issues
  const issueMap = {};
  for (const issue of allIssues) {
    const key = `${issue.type}|${issue.detail?.substring(0, 50)}`;
    if (!issueMap[key]) {
      issueMap[key] = { ...issue, pages: [issue.page_id], count: 1 };
      delete issueMap[key].page_id;
    } else {
      issueMap[key].count++;
      if (!issueMap[key].pages.includes(issue.page_id)) {
        issueMap[key].pages.push(issue.page_id);
      }
    }
  }
  const uniqueIssues = Object.values(issueMap).sort((a, b) => {
    const sev = { error: 0, warning: 1 };
    return (sev[a.severity] || 2) - (sev[b.severity] || 2) || b.count - a.count;
  });

  // Stats
  const totalPairs = allContrastPairs.length;
  const totalFail = allContrastPairs.filter(p => p.level === 'FAIL').length;
  const totalPass = allContrastPairs.filter(p => p.level !== 'FAIL').length;
  const failUnique = uniquePairs.filter(p => p.level === 'FAIL').length;
  const passUnique = uniquePairs.filter(p => p.level !== 'FAIL').length;

  // Build improvement recommendations
  const recommendations = [];

  // Contrast failures grouped
  const contrastFails = uniquePairs.filter(p => p.level === 'FAIL');
  if (contrastFails.length > 0) {
    recommendations.push({
      criterion: '1.4.3 Contraste mínimo',
      severity: 'error',
      title: `${contrastFails.length} combinaciones de color no cumplen WCAG AA`,
      detail: 'Los pares de color texto/fondo listados no alcanzan el ratio mínimo de contraste (4.5:1 para texto normal, 3:1 para texto grande).',
      action: 'Oscurecer textos claros o aclarar fondos. Para los grises sobre blanco, usar como mínimo #595959 (ratio 7:1) o #767676 (ratio 4.5:1).',
      affected: contrastFails.slice(0, 5).map(p => `${p.fg_hex} sobre ${p.bg_hex} (ratio ${p.ratio}:1)`),
    });
  }

  const missingAlts = uniqueIssues.filter(i => i.type === 'missing-alt');
  if (missingAlts.length > 0) {
    recommendations.push({
      criterion: '1.1.1 Contenido no textual',
      severity: 'error',
      title: `${missingAlts.reduce((s,i) => s + i.count, 0)} imágenes sin atributo alt`,
      detail: 'Las imágenes sin alt son inaccesibles para lectores de pantalla.',
      action: 'Añadir alt descriptivo a imágenes informativas. Usar alt="" para decorativas.',
      affected: missingAlts.slice(0, 3).map(i => i.src || i.selector),
    });
  }

  const missingLabels = uniqueIssues.filter(i => i.type === 'missing-label');
  if (missingLabels.length > 0) {
    recommendations.push({
      criterion: '1.3.1 / 4.1.2 Etiquetas de formulario',
      severity: 'error',
      title: `${missingLabels.reduce((s,i) => s + i.count, 0)} campos sin label asociado`,
      detail: 'Los campos sin label, aria-label ni title no son accesibles.',
      action: 'Asociar un <label for="id"> a cada campo, o usar aria-label.',
      affected: missingLabels.slice(0, 3).map(i => i.selector),
    });
  }

  const headingIssues = uniqueIssues.filter(i => i.type.startsWith('heading-'));
  if (headingIssues.length > 0) {
    recommendations.push({
      criterion: '1.3.1 Estructura de encabezados',
      severity: 'warning',
      title: 'Problemas en la jerarquía de encabezados',
      detail: headingIssues.map(i => i.detail).join('. '),
      action: 'Mantener jerarquía secuencial (H1→H2→H3). Un solo H1 por página.',
      affected: headingIssues.map(i => `${i.pages.length} páginas`),
    });
  }

  const linkIssues = uniqueIssues.filter(i => i.type === 'link-no-text');
  if (linkIssues.length > 0) {
    recommendations.push({
      criterion: '2.4.4 / 4.1.2 Propósito de enlaces',
      severity: 'error',
      title: `${linkIssues.reduce((s,i) => s + i.count, 0)} enlaces sin texto discernible`,
      detail: 'Enlaces que solo contienen imágenes sin alt o están vacíos.',
      action: 'Añadir aria-label o texto oculto visualmente con .sr-only.',
      affected: linkIssues.slice(0, 3).map(i => i.href || i.selector),
    });
  }

  const focusIssue = uniqueIssues.find(i => i.type === 'focus-outline-removed');
  if (focusIssue) {
    recommendations.push({
      criterion: '2.4.7 Foco visible',
      severity: 'warning',
      title: 'Indicador de foco posiblemente eliminado',
      detail: 'Se detectó "outline: none/0" en CSS. Los usuarios de teclado necesitan un indicador de foco visible.',
      action: 'Reemplazar outline:none con un estilo de foco alternativo (box-shadow, border, etc.).',
      affected: ['Estilos globales'],
    });
  }

  const touchIssues = uniqueIssues.filter(i => i.type === 'small-touch-target');
  if (touchIssues.length > 0) {
    recommendations.push({
      criterion: '2.5.5 Tamaño del objetivo',
      severity: 'warning',
      title: `${touchIssues.reduce((s,i) => s + i.count, 0)} objetivos táctiles demasiado pequeños`,
      detail: 'Botones o enlaces con área interactiva menor a 44×44px.',
      action: 'Aumentar padding o min-width/min-height a 44px mínimo.',
      affected: touchIssues.slice(0, 3).map(i => i.detail),
    });
  }

  // ── Save output ──
  const output = {
    generated: new Date().toISOString(),
    pages_analyzed: PAGES.length,
    contrast: {
      total_pairs_checked: totalPairs,
      total_pass: totalPass,
      total_fail: totalFail,
      pass_rate: Math.round(totalPass / totalPairs * 1000) / 10,
      unique_combinations: uniquePairs.length,
      unique_fail: failUnique,
      unique_pass: passUnique,
      pairs: uniquePairs,
    },
    issues: {
      total: allIssues.length,
      errors: allIssues.filter(i => i.severity === 'error').length,
      warnings: allIssues.filter(i => i.severity === 'warning').length,
      unique: uniqueIssues,
    },
    page_summaries: pageSummaries,
    recommendations,
  };

  const outPath = path.join(outDir, 'accessibility.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  // Console
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ACCESIBILIDAD — COMPLETADO`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Pares de contraste: ${totalPairs} (${uniquePairs.length} únicos)`);
  console.log(`  PASS: ${totalPass} (${output.contrast.pass_rate}%)`);
  console.log(`  FAIL: ${totalFail} (${failUnique} combinaciones únicas)`);
  console.log(`  Issues: ${allIssues.length} (${uniqueIssues.length} únicos)`);
  console.log(`    Errors:   ${allIssues.filter(i => i.severity === 'error').length}`);
  console.log(`    Warnings: ${allIssues.filter(i => i.severity === 'warning').length}`);
  console.log(`  Recomendaciones: ${recommendations.length}`);
  console.log(`\n  TOP FAIL contraste:`);
  for (const p of contrastFails.slice(0, 8)) {
    console.log(`    ${p.fg_hex} / ${p.bg_hex}  ratio ${p.ratio}:1  (×${p.count}, ${p.contexts.join('/')})`);
  }
  console.log(`\n  → ${outPath}`);
  console.log(`${'='.repeat(60)}`);
})();
