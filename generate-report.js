const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'output');
const colors   = JSON.parse(fs.readFileSync(path.join(OUT, 'color-palette.json'), 'utf8'));
const colorsG  = JSON.parse(fs.readFileSync(path.join(OUT, 'colors-global.json'), 'utf8'));
const typo     = JSON.parse(fs.readFileSync(path.join(OUT, 'typography.json'), 'utf8'));
const icons    = JSON.parse(fs.readFileSync(path.join(OUT, 'icons.json'), 'utf8'));
const comps    = JSON.parse(fs.readFileSync(path.join(OUT, 'components.json'), 'utf8'));
const a11y     = JSON.parse(fs.readFileSync(path.join(OUT, 'accessibility.json'), 'utf8'));
const colorsByRole = JSON.parse(fs.readFileSync(path.join(OUT, 'colors-by-role.json'), 'utf8'));
const remScale   = JSON.parse(fs.readFileSync(path.join(OUT, 'rem-scale.json'), 'utf8'));

function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function pct(count, total) { return total > 0 ? (count / total * 100).toFixed(1) : '0'; }

// Helper: build sub-navigation bar for a tab
// items = [{ id: 'sec-palette', label: 'Paleta', icon: '🎨' }, ...]
function buildSubNav(items) {
  var html = '<div class="sub-nav">';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    html += '<a class="sub-nav-btn" href="#' + it.id + '">' + (it.icon ? it.icon + ' ' : '') + esc(it.label) + '</a>';
  }
  html += '</div>';
  return html;
}

// ══════════════════════════════════════════════════════════════
//  TAB 1 — COLORS
// ══════════════════════════════════════════════════════════════
function buildColorsTab() {
  const allCats = ['textColor','backgroundColor','borderColor','iconColor','linkColor','buttonColor','shadowColor'];
  const catLabels = {
    textColor:'Texto', backgroundColor:'Fondo', borderColor:'Borde',
    iconColor:'Icono', linkColor:'Link', buttonColor:'Botón', shadowColor:'Sombra'
  };

  // Flatten unique hex values for top swatches
  const hexMap = {};
  for (const cat of allCats) {
    for (const c of (colorsG.global[cat] || [])) {
      const key = c.alpha < 1 ? c.hex + '/' + c.alpha : c.hex;
      if (!hexMap[key]) hexMap[key] = { hex: c.hex, alpha: c.alpha, total: 0, contexts: [], pages: new Set() };
      hexMap[key].total += c.total_count;
      hexMap[key].contexts.push(catLabels[cat]);
      for (const p of c.pages_seen) hexMap[key].pages.add(p);
    }
  }
  const allHexes = Object.values(hexMap).sort((a,b) => b.total - a.total);
  const grandTotal = allHexes.reduce((s,c) => s + c.total, 0);

  // ──── TABBED PALETTE by color family ────
  // ONLY colors that are actually RENDERED on ibermutua.es pages (verified 2026-02-07)
  // Source: computed styles from real DOM elements across 12 pages
  var paletteTabs = [
    { id: 'all', label: 'Todos', icon: '●', colors: [] },
    { id: 'blues', label: 'Azules', icon: '🔵', colors: [
      // All verified via computed styles on rendered elements
      { hex: '#004799', label: 'Primary 80', role: '--wp--preset--color--primary-80 · headings, gradientes' },
      { hex: '#0056a7', label: 'Blue 600', role: 'Computed · cookie widget, sidebar oscuro' },
      { hex: '#0065b7', label: 'Blue 500', role: 'Computed · links, sidebar, clusters' },
      { hex: '#0075c9', label: 'Primary 60', role: '--wp--preset--color--primary-60 · CTA, links, botones' },
      { hex: '#1863dc', label: 'Blue 450', role: 'Computed · gradiente hover' },
      { hex: '#293c5b', label: 'Blue 800', role: 'Computed · gradiente oscuro header' },
      { hex: '#ecf6fe', label: 'Blue 50', role: 'Computed · fondo tarjetas highlight' },
    ]},
    { id: 'grays', label: 'Grises', icon: '⬛', colors: [
      // All verified via computed styles on rendered elements
      { hex: '#000000', label: 'Black', role: 'Computed · headings alt, sombras' },
      { hex: '#212121', label: 'Gray 950', role: 'Computed · cookie banner text' },
      { hex: '#262d33', label: 'Neutral 80', role: '--wp--preset--color--neutral-80 · H1, títulos' },
      { hex: '#566673', label: 'Neutral 60', role: '--wp--preset--color--neutral-60 · body text, nav' },
      { hex: '#d1d9e0', label: 'Gray 250', role: 'Computed · bordes internos' },
      { hex: '#ebeff2', label: 'Gray 200', role: 'Computed · bordes, dividers' },
      { hex: '#ededed', label: 'Gray 180', role: 'Computed · bordes secundarios' },
      { hex: '#f4f4f4', label: 'Gray 120', role: 'Computed · fondos alternos' },
      { hex: '#f5f8fa', label: 'Gray 100', role: 'Computed · fondos de sección' },
      { hex: '#ffffff', label: 'White', role: 'Computed · fondo base, tarjetas' },
    ]},
    { id: 'status', label: 'Estado (CSS cargado)', icon: '⚡', colors: [
      // Estos colores existen en el CSS cargado (Ant Design + WP) pero NO se
      // renderizan en ninguna página pública. Se incluyen como referencia de lo
      // que el sistema tiene disponible si se usan componentes .ant-alert o
      // validación de formularios.
      { hex: '#52c41a', label: 'Success', role: 'CSS .ant-alert-success — no renderizado' },
      { hex: '#b7eb8f', label: 'Success border', role: 'CSS .ant-alert-success — no renderizado' },
      { hex: '#f6ffed', label: 'Success bg', role: 'CSS .ant-alert-success — no renderizado' },
      { hex: '#1890ff', label: 'Info', role: 'CSS .ant-alert-info — no renderizado' },
      { hex: '#faad14', label: 'Warning', role: 'CSS .ant-alert-warning — no renderizado' },
      { hex: '#ff4d4f', label: 'Error', role: 'CSS .ant-alert-error — no renderizado' },
      { hex: '#ffccc7', label: 'Error border', role: 'CSS .ant-alert-error — no renderizado' },
      { hex: '#fff2f0', label: 'Error bg', role: 'CSS .ant-alert-error — no renderizado' },
      { hex: '#008000', label: 'Form success', role: 'CSS .result.success — solo tras envío OK' },
    ]},
  ];

  // Fill "Todos" tab with all unique colors
  var seenAll = {};
  for (var ti = 1; ti < paletteTabs.length; ti++) {
    for (var ci2 = 0; ci2 < paletteTabs[ti].colors.length; ci2++) {
      var c2 = paletteTabs[ti].colors[ci2];
      if (!seenAll[c2.hex]) { paletteTabs[0].colors.push(c2); seenAll[c2.hex] = true; }
    }
  }

  // Build tabbed palette HTML
  var paletteTabBtns = '';
  var paletteTabPanels = '';
  for (var ti = 0; ti < paletteTabs.length; ti++) {
    var tab = paletteTabs[ti];
    var activeClass = ti === 0 ? ' palette-tab-active' : '';
    var activePanel = ti === 0 ? '' : ' style="display:none"';
    paletteTabBtns += '<button class="palette-tab-btn' + activeClass + '" data-palette-tab="' + tab.id + '">' +
      tab.icon + ' ' + esc(tab.label) + ' <span class="palette-tab-count">' + tab.colors.length + '</span></button>';

    paletteTabPanels += '<div class="palette-tab-panel" id="palette-panel-' + tab.id + '"' + activePanel + '>' +
      '<div class="swatch-grid">';
    for (var si = 0; si < tab.colors.length; si++) {
      var sw = tab.colors[si];
      var isLight = false;
      var rr = parseInt(sw.hex.substring(1,3), 16) || 0;
      var gg = parseInt(sw.hex.substring(3,5), 16) || 0;
      var bb = parseInt(sw.hex.substring(5,7), 16) || 0;
      if ((rr*0.299 + gg*0.587 + bb*0.114) > 200) isLight = true;
      var swBorder = isLight ? 'border:1px solid #dde3e8;' : '';
      paletteTabPanels += '<div class="swatch" data-search="' + esc(sw.hex) + ' ' + esc(sw.label) + ' ' + esc(sw.role) + '">' +
        '<div class="swatch-box" style="background:' + sw.hex + ';' + swBorder + '"></div>' +
        '<div class="swatch-label">' + sw.hex + '</div>' +
        '<div class="swatch-meta">' + esc(sw.label) + '</div>' +
        '<div class="swatch-role">' + esc(sw.role) + '</div>' +
      '</div>';
    }
    paletteTabPanels += '</div></div>';
  }

  var swatches = '<div class="palette-tabs-nav">' + paletteTabBtns + '</div>' + paletteTabPanels;

  // Top 15 table
  var top15 = '<table class="data-table"><thead><tr>' +
    '<th>#</th><th>Color</th><th>Hex</th><th>Usos</th><th>%</th><th>Páginas</th><th>Contextos</th>' +
    '</tr></thead><tbody>';
  for (var i = 0; i < Math.min(15, allHexes.length); i++) {
    var c = allHexes[i];
    var display = c.alpha < 1 ? c.hex + ' / ' + c.alpha : c.hex;
    var ctxPills = [];
    var seen = {};
    for (var ci = 0; ci < c.contexts.length; ci++) {
      if (!seen[c.contexts[ci]]) { ctxPills.push('<span class="pill pill-blue">' + c.contexts[ci] + '</span>'); seen[c.contexts[ci]] = true; }
    }
    top15 += '<tr data-search="' + esc(c.hex) + ' ' + c.contexts.join(' ') + '">' +
      '<td>' + (i+1) + '</td>' +
      '<td><span class="color-dot" style="background:' + c.hex + ';opacity:' + c.alpha + '"></span></td>' +
      '<td class="mono">' + esc(display) + '</td>' +
      '<td><strong>' + c.total + '</strong></td>' +
      '<td>' + pct(c.total, grandTotal) + '%</td>' +
      '<td>' + c.pages.size + '/12</td>' +
      '<td>' + ctxPills.join('') + '</td>' +
    '</tr>';
  }
  top15 += '</tbody></table>';

  // ──────── New: Full grid by role per category ────────
  var roleLabels = {
    // Text
    'heading-h1': 'H1 / Título principal',
    'heading-h2': 'H2 / Título sección',
    'heading-h3': 'H3 / Subtítulo',
    'heading-small': 'H4-H6 / Heading menor',
    'text-hero': 'Hero / Destacado',
    'text-body': 'Body / Texto corrido',
    'text-caption': 'Caption / Pie de foto',
    'text-bold': 'Texto bold / Énfasis',
    'text-secondary': 'Texto secundario',
    'text-link': 'Enlace en texto',
    'text-other': 'Otro texto',
    'nav-link': 'Enlace de navegación',
    'nav-item': 'Item de navegación',
    'cta-link': 'Enlace CTA / Botón',
    'card-link': 'Enlace en tarjeta',
    'tag-link': 'Enlace categoría / Tag',
    'footer-link': 'Enlace de footer',
    'form-label': 'Label de formulario',
    'form-input': 'Texto de input',
    'button-text': 'Texto de botón',
    'list-item': 'Elemento de lista',
    'table-cell': 'Celda de tabla',
    // Background
    'bg-page': 'Fondo de página',
    'bg-header': 'Fondo de header',
    'bg-nav': 'Fondo de navegación',
    'bg-footer': 'Fondo de footer',
    'bg-hero': 'Fondo de hero',
    'bg-section': 'Fondo de sección',
    'bg-card': 'Fondo de tarjeta',
    'bg-button': 'Fondo de botón',
    'bg-search': 'Fondo de buscador',
    'bg-link': 'Fondo de enlace',
    'bg-block': 'Fondo de bloque',
    'bg-interactive': 'Fondo interactivo (tab/accordion)',
    // Border
    'border-header': 'Borde de header',
    'border-nav': 'Borde de navegación',
    'border-card': 'Borde de tarjeta',
    'border-button': 'Borde de botón',
    'border-input': 'Borde de input',
    'border-divider': 'Separador / Divisor',
    'border-accordion': 'Borde de accordion',
    'border-tab': 'Borde de tab',
    'border-faq': 'Borde de FAQ',
    'border-other': 'Otro borde',
    // Link
    'link-nav': 'Link navegación',
    'link-inline': 'Link en texto',
    'link-cta': 'Link CTA',
    'link-card': 'Link tarjeta',
    'link-footer': 'Link footer',
    'link-hero': 'Link hero',
    'link-category': 'Link categoría',
    // Button
    'btn-bg-primary': 'Fondo botón primario',
    'btn-bg-secondary': 'Fondo botón secundario',
    'btn-text-primary': 'Texto botón primario',
    'btn-text-secondary': 'Texto botón secundario',
    // Icon
    'icon-font': 'Icono (font)',
    'icon-header': 'Icono header',
    'icon-nav': 'Icono navegación',
    'icon-body': 'Icono body',
    'icon-footer': 'Icono footer',
    'icon-card': 'Icono tarjeta',
    'icon-stroke-header': 'Icono stroke header',
    'icon-stroke-body': 'Icono stroke body',
  };

  var catOrder = [
    { key: 'textColor', title: 'Colores de texto', icon: 'Aa' },
    { key: 'backgroundColor', title: 'Colores de fondo', icon: '▮' },
    { key: 'borderColor', title: 'Colores de borde', icon: '☐' },
    { key: 'linkColor', title: 'Colores de enlace', icon: '🔗' },
    { key: 'buttonBg', title: 'Fondos de botón', icon: '⬜' },
    { key: 'buttonText', title: 'Texto de botón', icon: 'Bt' },
    { key: 'iconColor', title: 'Colores de icono', icon: '★' },
  ];

  var roleGrids = '';
  for (var ci = 0; ci < catOrder.length; ci++) {
    var cat = catOrder[ci];
    var catData = colorsByRole[cat.key];
    if (!catData || Object.keys(catData).length === 0) continue;

    // ── Merge: group by hex across all roles in this category ──
    var hexMerged = {}; // hex → { hex, totalCount, maxPages, roles: [{role, count, samples}] }
    var roleCount = 0;
    for (var role in catData) {
      roleCount++;
      for (var ri = 0; ri < catData[role].length; ri++) {
        var item = catData[role][ri];
        var hex = item.hex;
        if (!hexMerged[hex]) {
          hexMerged[hex] = { hex: hex, totalCount: 0, maxPages: 0, roles: [], allSamples: [] };
        }
        hexMerged[hex].totalCount += item.count;
        if (item.pages > hexMerged[hex].maxPages) hexMerged[hex].maxPages = item.pages;
        var rl = roleLabels[role] || role.replace(/[-_]/g, ' ');
        hexMerged[hex].roles.push({ role: role, label: rl, count: item.count });
        if (item.samples) {
          for (var si = 0; si < item.samples.length; si++) {
            if (hexMerged[hex].allSamples.length < 3) hexMerged[hex].allSamples.push(item.samples[si]);
          }
        }
      }
    }

    // Sort merged items by total count desc
    var mergedList = [];
    for (var hk in hexMerged) mergedList.push(hexMerged[hk]);
    mergedList.sort(function(a, b) { return b.totalCount - a.totalCount; });

    var catTotal = 0;
    for (var mi = 0; mi < mergedList.length; mi++) catTotal += mergedList[mi].totalCount;

    roleGrids += '<div class="panel-card" data-search="' + esc(cat.title) + '">' +
      '<h3>' + cat.icon + ' ' + esc(cat.title) + ' <span style="font-size:13px;color:var(--gray-400);font-weight:400">' + mergedList.length + ' colores, ' + roleCount + ' roles, ' + catTotal + ' usos</span></h3>' +
      '<div class="role-color-grid">';

    for (var mi = 0; mi < mergedList.length; mi++) {
      var m = mergedList[mi];
      var isLight = false;
      var rr = parseInt(m.hex.substring(1,3), 16);
      var gg = parseInt(m.hex.substring(3,5), 16);
      var bb = parseInt(m.hex.substring(5,7), 16);
      if ((rr*0.299 + gg*0.587 + bb*0.114) > 200) isLight = true;

      var boxBorder = isLight ? 'border:1px solid #dde3e8;' : '';
      var textColor = isLight ? 'color:#333;' : 'color:#fff;';
      var barW = catTotal > 0 ? Math.max(4, (m.totalCount / catTotal * 100)) : 0;

      // Build role pills sorted by count desc
      m.roles.sort(function(a, b) { return b.count - a.count; });
      var rolePills = '';
      for (var rpi = 0; rpi < m.roles.length; rpi++) {
        var r = m.roles[rpi];
        rolePills += '<span class="role-pill" title="' + esc(r.role) + ': ' + r.count + ' usos">' + esc(r.label) + ' <strong>' + r.count + '</strong></span>';
      }

      var sampleText = m.allSamples.length > 0 ? m.allSamples[0] : '';
      var searchStr = m.hex;
      for (var rsi = 0; rsi < m.roles.length; rsi++) searchStr += ' ' + m.roles[rsi].role + ' ' + m.roles[rsi].label;

      roleGrids += '<div class="role-color-card" data-search="' + esc(searchStr) + '">' +
        '<div class="role-color-swatch" style="background:' + m.hex + ';' + boxBorder + '">' +
          '<span class="role-color-hex" style="' + textColor + '">' + m.hex + '</span>' +
        '</div>' +
        '<div class="role-color-info">' +
          '<div class="role-color-count"><strong>' + m.totalCount + '</strong> usos totales</div>' +
          '<div class="role-color-pages">' + m.maxPages + '/12 pág.</div>' +
          '<div class="role-pills-wrap">' + rolePills + '</div>' +
          (sampleText ? '<div class="role-color-sample" title="' + esc(sampleText) + '">' + esc(sampleText.substring(0, 30)) + '</div>' : '') +
        '</div>' +
        '<div class="role-color-bar"><div class="role-color-bar-fill" style="width:' + barW + '%;background:' + m.hex + ';' + boxBorder + '"></div></div>' +
      '</div>';
    }

    roleGrids += '</div></div>';
  }

  // Gradients
  var grads = '';
  if (colorsG.global.gradients && colorsG.global.gradients.length > 0) {
    grads = '<div style="display:flex;gap:16px;flex-wrap:wrap">';
    for (var gi = 0; gi < colorsG.global.gradients.length; gi++) {
      var g = colorsG.global.gradients[gi];
      grads += '<div style="width:200px;height:60px;border-radius:8px;background:' + g.gradient + ';box-shadow:var(--shadow-sm)"></div>';
    }
    grads += '</div>';
  }

  var colorSubNav = buildSubNav([
    { id: 'sec-palette', label: 'Paleta', icon: '🎨' },
    { id: 'sec-top15', label: 'Top 15' },
    { id: 'sec-uso', label: 'Por tipo de uso' },
    colorsG.global.gradients && colorsG.global.gradients.length > 0 ? { id: 'sec-gradients', label: 'Gradientes' } : null,
  ].filter(Boolean));

  return '\n' +
    '    <h2 class="section-title">Colores</h2>\n' +
    '    <p class="section-desc">' + colorsG.summary.total_unique_colors + ' colores únicos detectados en ' + colorsG.summary.pages_analyzed + ' páginas</p>\n' +
    colorSubNav + '\n' +
    '    <div id="sec-palette" class="panel-card"><h3>Paleta del sistema de diseño</h3>' + swatches + '</div>\n' +
    '    <div id="sec-top15" class="panel-card"><h3>Top 15 colores por frecuencia de uso</h3>' + top15 + '</div>\n\n' +
    '    <h2 id="sec-uso" class="section-title" style="margin-top:40px">Distribución por tipo de uso</h2>\n' +
    '    <p class="section-desc">Todos los colores organizados por rol semántico detectado en la web</p>\n' +
    roleGrids + '\n' +
    (grads ? '    <div id="sec-gradients" class="panel-card"><h3>Gradientes detectados (' + colorsG.global.gradients.length + ')</h3>' + grads + '</div>\n' : '') +
    '  ';
}

// ══════════════════════════════════════════════════════════════
//  TAB 2 — TYPOGRAPHY
// ══════════════════════════════════════════════════════════════
function buildTypoTab() {
  // Families
  let fams = '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px">';
  for (const f of typo.families) {
    const name = f.family.split(',')[0].trim();
    fams += `<div class="type-card" style="flex:1;min-width:220px" data-search="${esc(f.family)}">
      <div style="font-family:${f.family};font-size:28px;font-weight:600;margin-bottom:8px">${esc(name)}</div>
      <div class="type-meta">
        <span><strong>${f.count}</strong> usos</span>
        <span><strong>${f.pages}</strong>/12 páginas</span>
      </div>
      <div style="font-size:12px;color:var(--gray-400);margin-top:6px;word-break:break-all">${esc(f.family)}</div>
    </div>`;
  }
  fams += '</div>';

  // Scale cards
  let scaleCards = '<div class="type-scale-grid">';
  for (const s of typo.scale.filter(x => x.count_total >= 3)) {
    const uses = s.typical_uses.slice(0, 4).map(u => `<span class="type-badge">${esc(u)}</span>`).join(' ');
    const weights = s.styles.map(st => st.fontWeight).filter((v,i,a) => a.indexOf(v)===i).join(', ');
    scaleCards += `<div class="type-card" data-search="${s.size_px}px ${s.typical_uses.join(' ')}">
      <div class="type-sample" style="font-size:${Math.min(s.size_px, 48)}px;line-height:1.3">
        Aa Bb Cc 123
      </div>
      <div class="type-meta">
        <span><strong>${s.size_px}px</strong></span>
        <span>weight: <strong>${weights}</strong></span>
        <span>×<strong>${s.count_total}</strong></span>
      </div>
      <div style="margin-top:8px">${uses}</div>
    </div>`;
  }
  scaleCards += '</div>';

  // Top styles table
  let stylesTable = `<table class="data-table"><thead><tr>
    <th>#</th><th>Familia</th><th>Size</th><th>Weight</th><th>Line-H</th><th>Usos</th><th>Páginas</th><th>Roles típicos</th>
  </tr></thead><tbody>`;
  for (let i = 0; i < Math.min(20, typo.top_styles.length); i++) {
    const s = typo.top_styles[i];
    const uses = s.typical_uses.slice(0, 3).map(u => `<span class="pill pill-blue">${esc(u)}</span>`).join('');
    stylesTable += `<tr data-search="${esc(s.fontFamily)} ${s.fontSize}px ${s.typical_uses.join(' ')}">
      <td>${i+1}</td>
      <td>${esc(s.fontFamily)}</td>
      <td class="mono"><strong>${s.fontSize}px</strong></td>
      <td class="mono">${s.fontWeight}</td>
      <td class="mono">${s.lineHeight}px</td>
      <td><strong>${s.count}</strong></td>
      <td>${s.pages}/12</td>
      <td>${uses}</td>
    </tr>`;
  }
  stylesTable += '</tbody></table>';

  // Suggested scale
  let suggested = '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">';
  for (const m of typo.suggested_scale.mapping) {
    const h = Math.max(30, m.size_px * 1.5);
    suggested += `<div style="text-align:center">
      <div style="width:60px;height:${h}px;background:var(--blue-400);border-radius:4px 4px 0 0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px">
        <span style="color:white;font-size:11px;font-weight:600">${m.count}</span>
      </div>
      <div style="font-size:13px;font-weight:700;margin-top:4px">${m.size_px}px</div>
      <div style="font-size:10px;color:var(--gray-400);max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.primary_use)}</div>
    </div>`;
  }
  suggested += '</div>';

  // ──── REM SCALE — clean list layout ────
  // Merge entries that round to the same pixel value
  var mergedByPx = {};
  for (var mi = 0; mi < remScale.scale.length; mi++) {
    var entry = remScale.scale[mi];
    var rounded = Math.round(entry.sizePx);
    if (!mergedByPx[rounded]) {
      mergedByPx[rounded] = { sizePx: rounded, weights: entry.weights.slice(), count: 0 };
    }
    mergedByPx[rounded].count += entry.count;
    // Keep heaviest weight from any entry
    for (var wi = 0; wi < entry.weights.length; wi++) {
      if (mergedByPx[rounded].weights.indexOf(entry.weights[wi]) === -1) {
        mergedByPx[rounded].weights.push(entry.weights[wi]);
      }
    }
  }
  var sortedScale = Object.values(mergedByPx).sort(function(a, b) { return a.sizePx - b.sizePx; });

  // Generate semantic labels based on size range
  function getRemLabel(px) {
    if (px <= 10) return 'Texto muy pequeño';
    if (px <= 12) return 'Texto pequeño';
    if (px <= 13) return 'Texto base reducido';
    if (px <= 14) return 'Texto estándar pequeño';
    if (px <= 15) return 'Texto medio';
    if (px <= 16) return 'Texto base';
    if (px <= 18) return 'Subtítulo';
    if (px <= 20) return 'Título pequeño';
    if (px <= 24) return 'Título';
    if (px <= 26) return 'Título grande';
    if (px <= 29) return 'Destacado';
    if (px <= 30) return 'Display pequeño';
    if (px <= 34) return 'Display';
    if (px <= 38) return 'Display grande';
    if (px <= 42) return 'Hero';
    return 'Hero grande';
  }

  var remRows = '';
  for (var ri = 0; ri < sortedScale.length; ri++) {
    var rs = sortedScale[ri];
    var pxRound = Math.round(rs.sizePx);
    var label = getRemLabel(pxRound);
    var displaySize = Math.min(pxRound, 48);

    remRows += '<div class="rem-row-clean" data-search="' + rs.remLabel + ' ' + pxRound + 'px ' + label + '">' +
      '<div class="rem-badge">rem(' + pxRound + ')</div>' +
      '<div class="rem-label" style="font-size:' + displaySize + 'px;font-weight:' + rs.weights[0] + ';line-height:1.3">' +
        esc(label) + ' — ' + pxRound + 'px' +
      '</div>' +
    '</div>';
  }

  var remSection = '<div class="rem-scale-clean">' + remRows + '</div>';

  var typoSubNav = buildSubNav([
    { id: 'sec-families', label: 'Familias', icon: 'Aa' },
    { id: 'sec-rem', label: 'Escala rem()' },
    { id: 'sec-typo-scale', label: 'Escala tipográfica' },
    { id: 'sec-top-styles', label: 'Top estilos' },
  ]);

  return `
    <h2 class="section-title">Tipografía</h2>
    <p class="section-desc">${typo.total_nodes_analyzed} nodos tipográficos analizados en ${typo.pages_analyzed} páginas</p>
    ${typoSubNav}

    <div id="sec-families" class="panel-card"><h3>Familias detectadas</h3>${fams}</div>
    <div id="sec-rem" class="panel-card">
      <h3>Escala rem() usada en componentes <span style="font-size:12px;color:var(--gray-400);font-weight:400">base: 16px · ${sortedScale.length} tamaños</span></h3>
      ${remSection}
    </div>
    <div id="sec-typo-scale" class="panel-card"><h3>Escala tipográfica</h3>${scaleCards}</div>
    <div id="sec-top-styles" class="panel-card"><h3>Top 20 estilos tipográficos</h3>${stylesTable}</div>
  `;
}

// ══════════════════════════════════════════════════════════════
//  TAB 3 — ICONS
// ══════════════════════════════════════════════════════════════
function buildIconsTab() {
  const types = [...new Set(icons.icons.map(i => i.type))];

  // Filters
  let filters = '<div class="icon-filters">';
  filters += '<button class="filter-btn active" data-filter="all">Todos (' + icons.total_unique_icons + ')</button>';
  for (const t of types) {
    const count = icons.icons.filter(i => i.type === t).length;
    filters += `<button class="filter-btn" data-filter="${t}">${t} (${count})</button>`;
  }
  filters += '</div>';

  // Grid
  let grid = '<div class="icon-grid">';
  for (const ic of icons.icons) {
    const label = ic.titleText || ic.ariaLabel || ic.src?.split('/').pop()?.substring(0, 20) || ic.className?.substring(0, 20) || ic.icon_id;
    const imgSrc = ic.asset_path_png || '';
    const pages = Object.keys(ic.pages_breakdown).length;
    grid += `<div class="icon-item" data-type="${ic.type}" data-search="${esc(ic.icon_id)} ${esc(label)} ${ic.type} ${esc(ic.className||'')}">
      ${imgSrc ? `<img src="${imgSrc}" alt="${esc(label)}" loading="lazy">` : '<div style="width:48px;height:48px;background:var(--gray-100);border-radius:4px;margin:0 auto 8px"></div>'}
      <div class="icon-count">×${ic.occurrences_total}</div>
      <div class="icon-label">${esc(label)}</div>
      <div><span class="icon-type-badge">${ic.type}</span></div>
      <div class="icon-label">${ic.size.w}×${ic.size.h} · ${pages}pg</div>
    </div>`;
  }
  grid += '</div>';

  // Ranking table
  let ranking = `<table class="data-table"><thead><tr>
    <th>#</th><th></th><th>ID</th><th>Tipo</th><th>Usos</th><th>Páginas</th><th>Tamaño</th><th>Contexto</th>
  </tr></thead><tbody>`;
  for (let i = 0; i < Math.min(20, icons.icons.length); i++) {
    const ic = icons.icons[i];
    const imgSrc = ic.asset_path_png || '';
    const ctx = ic.sample_locations?.[0]?.context || '';
    ranking += `<tr data-search="${esc(ic.icon_id)} ${ic.type}">
      <td>${i+1}</td>
      <td>${imgSrc ? `<img src="${imgSrc}" style="max-width:32px;max-height:32px" loading="lazy">` : ''}</td>
      <td class="mono">${ic.icon_id}</td>
      <td><span class="pill pill-gray">${ic.type}</span></td>
      <td><strong>${ic.occurrences_total}</strong></td>
      <td>${Object.keys(ic.pages_breakdown).length}/12</td>
      <td class="mono">${ic.size.w}×${ic.size.h}</td>
      <td>${esc(ctx)}</td>
    </tr>`;
  }
  ranking += '</tbody></table>';

  var iconsSubNav = buildSubNav([
    { id: 'sec-icon-ranking', label: 'Top 20', icon: '🏆' },
    { id: 'sec-icon-grid', label: 'Grid de iconos' },
  ]);

  return `
    <h2 class="section-title">Iconos</h2>
    <p class="section-desc">${icons.total_unique_icons} iconos únicos, ${icons.total_occurrences} ocurrencias totales</p>
    ${iconsSubNav}

    <div id="sec-icon-ranking" class="panel-card"><h3>Top 20 por frecuencia</h3>${ranking}</div>
    <div id="sec-icon-grid" class="panel-card"><h3>Grid de iconos</h3>${filters}${grid}</div>
  `;
}

// ══════════════════════════════════════════════════════════════
//  TAB 4 — COMPONENTS
// ══════════════════════════════════════════════════════════════
function buildComponentsTab() {
  // Group by category
  const categories = {};
  for (const c of comps.components) {
    if (!categories[c.category]) categories[c.category] = [];
    categories[c.category].push(c);
  }

  // Order categories by total occurrences
  const catOrder = Object.entries(categories)
    .map(([cat, items]) => ({ cat, items, total: items.reduce((s,i) => s + i.occurrences, 0) }))
    .sort((a,b) => b.total - a.total);

  let sections = '';
  for (const { cat, items, total } of catOrder) {
    let cards = '<div class="comp-grid">';
    for (const c of items.slice(0, 12)) {
      const imgSrc = c.asset_path_png || '';
      const pages = c.pages_list?.join(', ') || '';
      const variant = c.variant ? ` <span class="pill pill-blue">${esc(c.variant)}</span>` : '';
      cards += `<div class="comp-card" data-search="${esc(cat)} ${esc(c.selector)} ${esc(c.variant||'')} ${pages}">
        ${imgSrc ? `<img class="comp-screenshot" src="${imgSrc}" alt="${esc(c.selector)}" loading="lazy">` :
          '<div style="height:100px;background:var(--gray-100);border-bottom:1px solid var(--gray-200)"></div>'}
        <div class="comp-info">
          <div class="comp-occur">×${c.occurrences}</div>
          <h4>${esc(c.selector.substring(0, 60))}${variant}</h4>
          <div class="comp-pages">${c.pages_count} páginas: ${esc(pages)}</div>
        </div>
      </div>`;
    }
    cards += '</div>';

    sections += `<div id="sec-comp-${cat}" class="comp-category">
      <div class="comp-category-title">${esc(cat)} <span class="pill pill-count">${items.length} únicos · ${total} usos</span></div>
      ${cards}
    </div>`;
  }

  // Summary table
  let summary = `<table class="data-table"><thead><tr>
    <th>Categoría</th><th>Únicos</th><th>Usos</th><th>Variantes</th>
  </tr></thead><tbody>`;
  for (const [cat, data] of Object.entries(comps.by_category).sort((a,b) => b[1].total - a[1].total)) {
    const vars = Object.keys(data.variants).length > 0
      ? Object.entries(data.variants).map(([k,v]) => `${k}: ${v}`).join(', ') : '—';
    summary += `<tr data-search="${esc(cat)}">
      <td><strong>${esc(cat)}</strong></td>
      <td>${data.unique}</td>
      <td><strong>${data.total}</strong></td>
      <td style="font-size:12px">${esc(vars)}</td>
    </tr>`;
  }
  summary += '</tbody></table>';

  // Build sub-nav with one entry per category
  var compNavItems = [{ id: 'sec-comp-summary', label: 'Resumen', icon: '📊' }];
  var sortedCatKeys = Object.keys(categories).sort(function(a, b) {
    return categories[b].length - categories[a].length;
  });
  for (var ci3 = 0; ci3 < sortedCatKeys.length; ci3++) {
    var catKey = sortedCatKeys[ci3];
    compNavItems.push({ id: 'sec-comp-' + catKey, label: catKey + ' (' + categories[catKey].length + ')' });
  }
  var compSubNav = buildSubNav(compNavItems);

  return `
    <h2 class="section-title">Componentes UI</h2>
    <p class="section-desc">${comps.total_unique_components} componentes únicos, ${comps.total_occurrences} ocurrencias en ${comps.pages_analyzed} páginas</p>
    ${compSubNav}

    <div id="sec-comp-summary" class="panel-card"><h3>Resumen por categoría</h3>${summary}</div>
    ${sections}
  `;
}

// ══════════════════════════════════════════════════════════════
//  TAB 5 — SHOWCASE
// ══════════════════════════════════════════════════════════════
function buildShowcaseTab() {
  // ── Exclude non-UI / broken components ──
  var excludeSelectors = [
    'leaflet-marker-icon',
    'leaflet-control-zoom',
    'slick-prev',
    'slick-next',
    'cky-btn-revisit',
    'btn-bold.btn-sm',
    'slick-dots',
  ];
  // For tabs category: only keep the full nav bar, exclude sub-parts
  var tabsKeepOnly = ['ul.wp-block-getwid-tabs__nav-links'];
  var rawAll = comps.components || [];
  var rawItems = rawAll.filter(function(rc) {
    var sel = rc.selector || '';
    for (var ei = 0; ei < excludeSelectors.length; ei++) {
      if (sel.indexOf(excludeSelectors[ei]) !== -1) return false;
    }
    // Exclude items with no screenshot and very small size (likely invisible/broken)
    if (!rc.asset_path_png && rc.size && rc.size.w < 50 && rc.size.h < 50) return false;
    // For tabs: only keep the full nav bar component
    if (rc.category === 'tabs') {
      var keep = false;
      for (var ti = 0; ti < tabsKeepOnly.length; ti++) {
        if (sel.indexOf(tabsKeepOnly[ti]) !== -1) keep = true;
      }
      if (!keep) return false;
    }
    return true;
  });

  // ── Deduplicate components: merge items with same structure ──
  var dedupGroups = {};
  for (var di = 0; di < rawItems.length; di++) {
    var rc = rawItems[di];
    // Normalize selector: strip dynamic IDs (post-id-XXXXX, mark-XXXXX, numeric suffixes)
    var selNorm = rc.selector
      .replace(/[\.\#][\w-]*(?:id-?\d+|post-\d+|mark-\d+)[\w-]*/g, '')
      .replace(/\[data-comp-mark[^\]]*\]/g, '')
      .replace(/\s+/g, ' ').trim();
    var dedupKey = rc.category + '|' + (rc.variant || '') + '|' + selNorm;
    if (!dedupGroups[dedupKey]) {
      dedupGroups[dedupKey] = {
        representative: rc,
        totalOccurrences: 0,
        allPages: {},
        allPagesList: [],
        count: 0
      };
    }
    var g = dedupGroups[dedupKey];
    g.totalOccurrences += rc.occurrences;
    g.count++;
    // Merge pages
    if (rc.pages) {
      for (var pk in rc.pages) {
        if (!g.allPages[pk]) g.allPages[pk] = 0;
        g.allPages[pk] += rc.pages[pk];
      }
    }
    // Keep the representative with the best screenshot (has image + most occurrences)
    if (rc.occurrences > g.representative.occurrences && rc.asset_path_png) {
      g.representative = rc;
    } else if (!g.representative.asset_path_png && rc.asset_path_png) {
      g.representative = rc;
    }
  }

  // Build deduplicated list
  var allItems = [];
  var dedupKeys = Object.keys(dedupGroups);
  for (var dk = 0; dk < dedupKeys.length; dk++) {
    var grp = dedupGroups[dedupKeys[dk]];
    var rep = grp.representative;
    // Create a merged copy
    var merged = {
      component_id: rep.component_id,
      category: rep.category,
      variant: rep.variant,
      occurrences: grp.totalOccurrences,
      pages_count: Object.keys(grp.allPages).length,
      pages_list: Object.keys(grp.allPages),
      size: rep.size,
      selector: rep.selector,
      asset_path_png: rep.asset_path_png,
      _instances: grp.count
    };
    allItems.push(merged);
  }

  // Group by category
  var cats = {};
  for (var i = 0; i < allItems.length; i++) {
    var c = allItems[i];
    if (!cats[c.category]) cats[c.category] = [];
    cats[c.category].push(c);
  }
  // Sort categories by total occurrences desc
  var catKeys = Object.keys(cats).sort(function(a, b) {
    var ta = 0, tb = 0;
    cats[a].forEach(function(x) { ta += x.occurrences; });
    cats[b].forEach(function(x) { tb += x.occurrences; });
    return tb - ta;
  });

  // Category labels/icons
  var catMeta = {
    'button': { label: 'Botones', icon: '🔘' },
    'card': { label: 'Cards', icon: '🃏' },
    'accordion': { label: 'Acordeones', icon: '🪗' },
    'tabs': { label: 'Tabs', icon: '📑' },
    'form': { label: 'Formularios', icon: '📝' },
    'form-element': { label: 'Inputs / Campos', icon: '✏️' },
    'header': { label: 'Header', icon: '🏠' },
    'footer': { label: 'Footer', icon: '📎' },
    'navigation': { label: 'Navegación', icon: '🧭' },
    'breadcrumb': { label: 'Breadcrumbs', icon: '🥖' },
    'search-bar': { label: 'Barra de búsqueda', icon: '🔍' },
    'modal': { label: 'Modales', icon: '🪟' },
    'list': { label: 'Listas', icon: '📋' },
    'chip-tag': { label: 'Chips / Tags', icon: '🏷️' },
    'pagination': { label: 'Paginación', icon: '📄' },
  };

  // Build filter buttons — single row
  var filterBtns = '<button class="showcase-filter-btn active" data-showcase-filter="all">Todos <span class="showcase-filter-count">' + allItems.length + '</span></button>';
  for (var fi = 0; fi < catKeys.length; fi++) {
    var ck = catKeys[fi];
    var meta = catMeta[ck] || { label: ck, icon: '' };
    filterBtns += '<button class="showcase-filter-btn" data-showcase-filter="' + esc(ck) + '">' +
      meta.icon + ' ' + esc(meta.label) + ' <span class="showcase-filter-count">' + cats[ck].length + '</span></button>';
  }

  // Build all showcase cards sorted by occurrences desc
  var cards = '';
  var sorted = allItems.slice().sort(function(a, b) { return b.occurrences - a.occurrences; });

  for (var si = 0; si < sorted.length; si++) {
    var comp = sorted[si];
    var hasImg = comp.asset_path_png && comp.asset_path_png !== null;
    var imgHtml = hasImg
      ? '<img src="' + esc(comp.asset_path_png) + '" alt="' + esc(comp.category) + '" class="showcase-img" loading="lazy">'
      : '<div class="showcase-no-img">Sin preview</div>';

    var variantPill = comp.variant
      ? '<span class="showcase-variant">' + esc(comp.variant) + '</span>'
      : '';

    var instancesBadge = (comp._instances && comp._instances > 1)
      ? '<span class="showcase-instances">' + comp._instances + ' variantes</span>'
      : '';

    var metaInfo = catMeta[comp.category] || { label: comp.category, icon: '' };

    // Normalize selector for display: strip dynamic IDs
    var displaySel = comp.selector
      .replace(/\.post-id-\d+/g, '')
      .replace(/\.comp-mark-\d+/g, '')
      .replace(/\s+/g, ' ').trim();

    var pagesPills = '';
    if (comp.pages_list && comp.pages_list.length > 0) {
      for (var pi = 0; pi < Math.min(comp.pages_list.length, 4); pi++) {
        pagesPills += '<span class="showcase-page-pill">' + esc(comp.pages_list[pi]) + '</span>';
      }
      if (comp.pages_list.length > 4) {
        pagesPills += '<span class="showcase-page-pill">+' + (comp.pages_list.length - 4) + '</span>';
      }
    }

    cards += '<div class="showcase-card" data-showcase-cat="' + esc(comp.category) + '" data-search="' + esc(comp.category + ' ' + displaySel + ' ' + (comp.variant || '')) + '">' +
      '<div class="showcase-card-img">' + imgHtml + '</div>' +
      '<div class="showcase-card-body">' +
        '<div class="showcase-card-top">' +
          '<span class="showcase-cat-badge">' + metaInfo.icon + ' ' + esc(metaInfo.label) + '</span>' +
          variantPill + instancesBadge +
        '</div>' +
        '<div class="showcase-selector" title="' + esc(displaySel) + '">' + esc(displaySel) + '</div>' +
        '<div class="showcase-stats">' +
          '<span class="showcase-stat">' + comp.occurrences + ' usos</span>' +
          '<span class="showcase-stat">' + comp.pages_count + ' pág.</span>' +
          (comp.size ? '<span class="showcase-stat">' + comp.size.w + '×' + comp.size.h + '</span>' : '') +
        '</div>' +
        '<div class="showcase-pages">' + pagesPills + '</div>' +
      '</div>' +
    '</div>';
  }

  // Active filter counter (updated via JS)
  var counterHtml = '<span class="showcase-active-count" id="showcaseCount">Mostrando ' + allItems.length + ' de ' + allItems.length + ' componentes</span>';

  return '\n' +
    '<h2 class="section-title">Showcase de Componentes UI</h2>\n' +
    '<p class="section-desc">' + allItems.length + ' componentes únicos detectados en ' + comps.pages_analyzed + ' páginas, organizados por tipología</p>\n' +
    '<div class="showcase-frame">\n' +
      '<div class="showcase-filters-bar">' + filterBtns + '</div>\n' +
      '<div class="showcase-counter">' + counterHtml + '</div>\n' +
      '<div class="showcase-grid showcase-grid-all">' + cards + '</div>\n' +
    '</div>\n' +
  '';
}

// ══════════════════════════════════════════════════════════════
//  TAB 6 — ACCESSIBILITY
// ══════════════════════════════════════════════════════════════
function buildA11yTab() {
  var c = a11y.contrast;
  var iss = a11y.issues;
  var recs = a11y.recommendations;
  var score = c.pass_rate;
  var scoreColor = score >= 95 ? '#2e7d32' : score >= 85 ? '#f57f17' : '#c62828';

  var html = '';

  // KPI cards
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">';
  html += '<div class="panel-card" style="text-align:center;padding:20px"><div style="font-size:48px;font-weight:800;color:' + scoreColor + '">' + score + '%</div><div style="font-size:13px;color:var(--gray-600)">Contraste correcto</div><div style="font-size:12px;color:var(--gray-400)">' + c.total_pass + ' de ' + c.total_pairs_checked + ' pares</div></div>';
  html += '<div class="panel-card" style="text-align:center;padding:20px"><div style="font-size:48px;font-weight:800;color:#c62828">' + c.unique_fail + '</div><div style="font-size:13px;color:var(--gray-600)">Fallos de contraste</div><div style="font-size:12px;color:var(--gray-400)">combinaciones únicas</div></div>';
  html += '<div class="panel-card" style="text-align:center;padding:20px"><div style="font-size:48px;font-weight:800;color:#c62828">' + iss.errors + '</div><div style="font-size:13px;color:var(--gray-600)">Errores A11y</div><div style="font-size:12px;color:var(--gray-400)">en 12 páginas</div></div>';
  html += '<div class="panel-card" style="text-align:center;padding:20px"><div style="font-size:48px;font-weight:800;color:#f57f17">' + iss.warnings + '</div><div style="font-size:13px;color:var(--gray-600)">Advertencias</div><div style="font-size:12px;color:var(--gray-400)">en 12 páginas</div></div>';
  html += '</div>';

  // Page summary table
  html += '<div id="sec-a11y-pages" class="panel-card"><h3>Resumen por página</h3><table class="data-table"><thead><tr><th>Página</th><th>Pares</th><th>Pass</th><th>Fail</th><th>% OK</th><th>Errores</th><th>Warnings</th><th>lang</th></tr></thead><tbody>';
  for (var ps of a11y.page_summaries) {
    var rate = ps.pairs_total > 0 ? Math.round(ps.pairs_pass / ps.pairs_total * 100) : 100;
    var rateColor = rate >= 95 ? '#2e7d32' : rate >= 85 ? '#f57f17' : '#c62828';
    html += '<tr data-search="' + esc(ps.page_id) + '">';
    html += '<td><strong>' + esc(ps.page_id) + '</strong></td>';
    html += '<td>' + ps.pairs_total + '</td>';
    html += '<td>' + ps.pairs_pass + '</td>';
    html += '<td style="color:' + (ps.pairs_fail > 0 ? '#c62828' : 'inherit') + ';font-weight:' + (ps.pairs_fail > 0 ? '700' : '400') + '">' + ps.pairs_fail + '</td>';
    html += '<td style="color:' + rateColor + ';font-weight:700">' + rate + '%</td>';
    html += '<td style="color:' + (ps.issues_error > 0 ? '#c62828' : 'inherit') + '">' + ps.issues_error + '</td>';
    html += '<td>' + ps.issues_warning + '</td>';
    html += '<td class="mono" style="font-size:12px">' + esc(ps.htmlLang || '—') + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table></div>';

  // Contrast failures table
  var fails = c.pairs.filter(function(p) { return p.level === 'FAIL'; });
  if (fails.length > 0) {
    html += '<div class="panel-card"><h3 style="color:#c62828">Fallos de contraste WCAG AA (' + fails.length + ' combinaciones)</h3>';
    html += '<table class="data-table"><thead><tr><th>Texto</th><th>Fondo</th><th>Ratio</th><th>Mínimo</th><th>Usos</th><th>Páginas</th><th>Contextos</th><th>Ejemplo</th></tr></thead><tbody>';
    for (var fp of fails) {
      var minReq = fp.isLarge ? '3:1' : '4.5:1';
      var samp = fp.samples[0];
      html += '<tr data-search="' + fp.fg_hex + ' ' + fp.bg_hex + '">';
      html += '<td><span class="color-dot" style="background:' + fp.fg_hex + '"></span><span class="mono">' + fp.fg_hex + '</span></td>';
      html += '<td><span class="color-dot" style="background:' + fp.bg_hex + ';' + (fp.bg_hex === '#ffffff' ? 'border:1px solid #ccc' : '') + '"></span><span class="mono">' + fp.bg_hex + '</span></td>';
      html += '<td style="color:#c62828;font-weight:700">' + fp.ratio + ':1</td>';
      html += '<td>' + minReq + '</td><td>' + fp.count + '</td><td>' + fp.pages_count + '/12</td>';
      html += '<td>' + fp.contexts.map(function(cx) { return '<span class="pill pill-gray">' + esc(cx) + '</span>'; }).join('') + '</td>';
      html += '<td style="font-size:12px">' + (samp ? esc(samp.tag + ': ' + (samp.text || '').substring(0, 25)) : '') + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';
  }

  // Visual contrast map
  html += '<div id="sec-a11y-contrast" class="panel-card"><h3>Mapa visual de contraste — Todas las combinaciones (' + c.unique_combinations + ')</h3>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';
  for (var pair of c.pairs) {
    var isFail = pair.level === 'FAIL';
    var isAAA = pair.level === 'AAA';
    var borderClr = isFail ? '#c62828' : isAAA ? '#2e7d32' : '#2e7d32';
    var badgeBg = isFail ? '#c62828' : isAAA ? '#1b5e20' : '#2e7d32';
    var sizeLabel = pair.isLarge ? 'Grande' : 'Normal';
    var samp2 = pair.samples[0];
    var sampleText = samp2 ? esc(samp2.text || samp2.tag) : 'Aa Bb Cc';
    if (!sampleText || sampleText.length < 2) sampleText = 'Aa Bb Cc';

    html += '<div class="contrast-pair" data-search="' + pair.fg_hex + ' ' + pair.bg_hex + ' ' + pair.level + ' ' + pair.contexts.join(' ') + '" style="border:2px solid ' + borderClr + ';border-radius:var(--radius);overflow:hidden">';
    // Preview row
    html += '<div style="display:flex;height:56px">';
    html += '<div style="flex:1;background:' + pair.bg_hex + ';display:flex;align-items:center;justify-content:center;padding:8px;' + (pair.bg_hex === '#ffffff' ? 'border:1px solid #ebeff2;' : '') + '">';
    html += '<span style="color:' + pair.fg_hex + ';font-size:16px;font-weight:600">' + sampleText.substring(0, 20) + '</span></div>';
    html += '<div style="width:80px;background:' + badgeBg + ';display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff">';
    html += '<span style="font-size:18px;font-weight:800">' + pair.ratio + '</span><span style="font-size:10px">:1</span></div></div>';
    // Meta row
    html += '<div style="padding:8px 10px;background:var(--white);font-size:11px;color:var(--gray-600);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">';
    html += '<div><span class="mono">' + pair.fg_hex + '</span> / <span class="mono">' + pair.bg_hex + '</span></div>';
    html += '<div><span class="pill" style="background:' + badgeBg + ';color:#fff">' + pair.level + '</span> ';
    html += '<span class="pill pill-gray">' + sizeLabel + '</span> ';
    html += '<span class="pill pill-gray">&times;' + pair.count + '</span></div>';
    html += '</div></div>';
  }
  html += '</div></div>';

  // Issues table
  html += '<div id="sec-a11y-issues" class="panel-card"><h3>Issues de accesibilidad (' + iss.unique.length + ' tipos)</h3>';
  html += '<table class="data-table"><thead><tr><th></th><th>Criterio</th><th>Tipo</th><th>Detalle</th><th>Ocurrencias</th><th>Páginas</th></tr></thead><tbody>';
  for (var issue of iss.unique) {
    var sevIcon = issue.severity === 'error' ? '&#128308;' : '&#128993;';
    html += '<tr data-search="' + esc(issue.type) + ' ' + esc(issue.criterion || '') + ' ' + esc(issue.detail || '') + '">';
    html += '<td>' + sevIcon + '</td>';
    html += '<td class="mono" style="font-size:12px">' + esc(issue.criterion || '') + '</td>';
    html += '<td><strong>' + esc(issue.type) + '</strong></td>';
    html += '<td style="font-size:13px">' + esc(issue.detail || '') + '</td>';
    html += '<td style="text-align:center"><strong>' + issue.count + '</strong></td>';
    html += '<td style="font-size:12px">' + (issue.pages ? issue.pages.length + '/12' : '') + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table></div>';

  // Recommendations
  html += '<h3 id="sec-a11y-recs" style="font-size:18px;font-weight:600;color:var(--blue-500);margin:32px 0 16px">Propuestas de mejora</h3>';
  for (var rec of recs) {
    var sevColor = rec.severity === 'error' ? '#c62828' : '#f57f17';
    var sevLabel = rec.severity === 'error' ? 'Error' : 'Advertencia';
    html += '<div class="panel-card" style="border-left:4px solid ' + sevColor + '" data-search="' + esc(rec.criterion) + ' ' + esc(rec.title) + '">';
    html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">';
    html += '<span class="pill" style="background:' + sevColor + ';color:#fff">' + sevLabel + '</span>';
    html += '<span class="mono" style="font-size:12px;color:var(--gray-400)">' + esc(rec.criterion) + '</span></div>';
    html += '<h3 style="border:none;padding:0;margin-bottom:8px">' + esc(rec.title) + '</h3>';
    html += '<p style="font-size:14px;color:var(--gray-600);margin-bottom:12px">' + esc(rec.detail) + '</p>';
    html += '<div style="background:var(--blue-50);padding:12px 16px;border-radius:6px;margin-bottom:8px">';
    html += '<strong style="font-size:13px;color:var(--blue-500)">Recomendaci&oacute;n:</strong>';
    html += '<p style="font-size:13px;margin-top:4px">' + esc(rec.action) + '</p></div>';
    if (rec.affected && rec.affected.length > 0) {
      html += '<div style="font-size:12px;color:var(--gray-400);margin-top:8px">Ejemplos: ';
      html += rec.affected.map(function(a) { return '<code style="background:var(--gray-100);padding:1px 6px;border-radius:3px;font-size:11px">' + esc(a) + '</code>'; }).join(' ');
      html += '</div>';
    }
    html += '</div>';
  }

  var a11ySubNav = buildSubNav([
    { id: 'sec-a11y-pages', label: 'Por página', icon: '📄' },
    { id: 'sec-a11y-contrast', label: 'Mapa de contraste' },
    { id: 'sec-a11y-issues', label: 'Issues' },
    { id: 'sec-a11y-recs', label: 'Propuestas de mejora' },
  ]);

  return '<h2 class="section-title">Accesibilidad WCAG AA</h2>' +
    '<p class="section-desc">' + c.total_pairs_checked + ' pares de contraste verificados, ' + iss.total + ' issues detectados en ' + a11y.pages_analyzed + ' p&aacute;ginas</p>' +
    a11ySubNav +
    html;
}

// ══════════════════════════════════════════════════════════════
//  ASSEMBLE HTML
// ══════════════════════════════════════════════════════════════
const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ibermutua UI Audit</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>

<!-- ── HEADER ──────────────────────────────────────────── -->
<div class="audit-header">
  <h1>Ibermutua <span>UI Audit</span></h1>
  <input type="text" class="global-search" placeholder="Buscar colores, iconos, componentes…" id="globalSearch">
  <div class="header-meta">12 páginas · ${new Date().toLocaleDateString('es-ES')}</div>
</div>

<!-- ── TABS NAV ────────────────────────────────────────── -->
<div class="tabs-nav">
  <button class="tab-btn active" data-tab="colors">Colores</button>
  <button class="tab-btn" data-tab="typography">Tipografía</button>
  <button class="tab-btn" data-tab="icons">Iconos</button>
  <button class="tab-btn" data-tab="showcase">Componentes</button>
  <button class="tab-btn" data-tab="a11y">Accesibilidad</button>
</div>

<!-- ── TAB PANELS ──────────────────────────────────────── -->
<div class="tab-panel active" id="tab-colors">
  ${buildColorsTab()}
</div>

<div class="tab-panel" id="tab-typography">
  ${buildTypoTab()}
</div>

<div class="tab-panel" id="tab-icons">
  ${buildIconsTab()}
</div>

<div class="tab-panel" id="tab-showcase">
  ${buildShowcaseTab()}
</div>

<div class="tab-panel" id="tab-a11y">
  ${buildA11yTab()}
</div>

<!-- ── INLINE JS ───────────────────────────────────────── -->
<script>
(function() {
  // Tab switching
  const btns = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // Palette sub-tabs
  const pBtns = document.querySelectorAll('.palette-tab-btn');
  pBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pBtns.forEach(b => b.classList.remove('palette-tab-active'));
      document.querySelectorAll('.palette-tab-panel').forEach(p => p.style.display = 'none');
      btn.classList.add('palette-tab-active');
      document.getElementById('palette-panel-' + btn.dataset.paletteTab).style.display = '';
    });
  });

  // Icon type filter
  document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('.icon-item').forEach(item => {
        if (filter === 'all' || item.dataset.type === filter) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  // Showcase filter
  const totalComps = document.querySelectorAll('.showcase-grid-all .showcase-card').length;
  document.querySelectorAll('.showcase-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.showcase-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.showcaseFilter;
      let visible = 0;
      document.querySelectorAll('.showcase-grid-all .showcase-card').forEach(card => {
        if (cat === 'all' || card.dataset.showcaseCat === cat) {
          card.style.display = '';
          visible++;
        } else {
          card.style.display = 'none';
        }
      });
      const counter = document.getElementById('showcaseCount');
      if (counter) counter.textContent = 'Mostrando ' + visible + ' de ' + totalComps + ' componentes';
    });
  });

  // Global search
  let timer;
  document.getElementById('globalSearch').addEventListener('input', function() {
    clearTimeout(timer);
    const q = this.value.toLowerCase().trim();
    timer = setTimeout(() => {
      const searchable = document.querySelectorAll('[data-search]');
      searchable.forEach(el => {
        if (!q || el.dataset.search.toLowerCase().includes(q)) {
          el.classList.remove('search-hidden');
        } else {
          el.classList.add('search-hidden');
        }
      });
    }, 200);
  });
})();
</script>

</body>
</html>`;

const outPath = path.join(OUT, 'audit.html');
fs.writeFileSync(outPath, html);
console.log('Informe generado: ' + outPath);
console.log('Tamaño: ' + (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB');
