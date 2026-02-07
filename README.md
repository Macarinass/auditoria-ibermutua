# Ibermutua UI Audit

> Ejercicio académico del curso **[shift.r](https://shiftr.es/)** — Auditoría visual automatizada del sitio [ibermutua.es](https://www.ibermutua.es/) mediante Playwright y Node.js.

---

## Descripción

Auditoría completa de la interfaz de usuario de la web corporativa de Ibermutua, extrayendo y catalogando de forma automatizada:

| Categoría | Qué analiza |
|-----------|------------|
| **Colores** | Paleta completa, distribución por rol semántico, gradientes |
| **Tipografía** | Familias tipográficas, escala rem(), escala tipográfica, top estilos |
| **Iconos** | Inventario SVG/IMG/font con miniaturas y ranking |
| **Componentes** | Showcase visual con filtros por tipo (cards, botones, formularios, tabs…) |
| **Accesibilidad** | Contraste WCAG AA, issues detectados y propuestas de mejora |

El resultado es un **informe HTML estático** navegable con pestañas, filtros y búsqueda global.

---

## Estructura

```
auditoria-ibermutua/
├── index.html          ← Informe final (abrir en navegador)
├── styles.css          ← Estilos del informe
├── mdc-rules           ← Reglas y convenciones del proyecto
├── README.md
├── assets/
│   ├── icons/          ← Miniaturas PNG de iconos
│   └── components/     ← Screenshots de componentes UI
├── scripts/            ← Scripts de auditoría (Playwright + Node.js)
└── data/               ← Datos intermedios JSON + capturas de páginas
```

---

## Cómo ver el informe

Abre `index.html` en cualquier navegador. No requiere servidor — es HTML/CSS/JS estático.

---

## Cómo reproducir la auditoría

```bash
git clone https://github.com/Macarinass/auditoria-ibermutua.git
cd auditoria-ibermutua

npm init -y
npm install playwright
npx playwright install chromium

# Ejecutar scripts en orden
node scripts/audit-home.js
node scripts/audit-links.js
node scripts/audit-pages.js
node scripts/audit-colors.js
node scripts/enrich-colors.js
node scripts/audit-typography.js
node scripts/extract-rem-scale.js
node scripts/audit-icons.js
node scripts/audit-components.js
node scripts/audit-accessibility.js
node scripts/generate-report.js
```

---

## Tecnologías

| Tecnología | Uso |
|-----------|-----|
| **Node.js** | Runtime para los scripts de auditoría |
| **Playwright** | Automatización de Chromium headless |
| **HTML/CSS/JS** | Informe estático sin frameworks |

---

## Contexto académico

Ejercicio práctico del curso **shift.r** enfocado en automatización de auditorías UI, extracción de design tokens, inventario de componentes y evaluación de accesibilidad WCAG AA.

---

## Licencia

Proyecto académico — uso exclusivamente educativo.
