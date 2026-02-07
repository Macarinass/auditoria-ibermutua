# Ibermutua UI Audit

> Ejercicio académico del curso **[shift.r](https://shiftr.es/)** — Auditoría visual automatizada del sitio [ibermutua.es](https://www.ibermutua.es/) mediante Playwright y Node.js.

---

## Descripción

Este proyecto realiza una **auditoría completa de la interfaz de usuario** de la web corporativa de Ibermutua, extrayendo y catalogando de forma automatizada:

| Categoría | Qué analiza |
|-----------|------------|
| **Colores** | Paleta completa, distribución por rol semántico (texto, fondo, borde, enlace, botón), gradientes |
| **Tipografía** | Familias tipográficas, escala rem(), escala tipográfica y top estilos por frecuencia |
| **Iconos** | Inventario de iconos SVG/IMG/font con miniaturas, deduplicación y ranking |
| **Componentes** | Showcase visual de componentes UI (cards, botones, formularios, tabs, etc.) con filtros por tipo |
| **Accesibilidad** | Contraste WCAG AA, issues detectados y propuestas de mejora |

El resultado es un **informe HTML estático** (`output/audit.html`) navegable con pestañas, filtros y búsqueda global, sin dependencias de frameworks.

---

## Vista previa del informe

<p align="center">
  <img src="output/preview-final-tabs.png" alt="Pestaña Colores" width="700">
</p>

<p align="center">
  <img src="output/preview-showcase-v4-btn.png" alt="Showcase Componentes" width="700">
</p>

---

## Estructura del proyecto

```
mcp-ibermutua/
├── audit-home.js            # Abre la home, acepta cookies, captura info básica
├── audit-links.js           # Extrae enlaces internos del header/footer/secciones
├── audit-pages.js           # Visita 12 URLs representativas, captura screenshots y HTML
├── audit-colors.js          # Extrae colores computados y los categoriza por rol
├── audit-typography.js      # Extrae estilos tipográficos y genera escala
├── audit-icons.js           # Detecta iconos (SVG/IMG/font), deduplica y captura miniaturas
├── audit-components.js      # Identifica componentes UI por heurística
├── audit-accessibility.js   # Verifica contraste WCAG AA y detecta issues
├── enrich-colors.js         # Enriquece datos de color con roles semánticos
├── extract-rem-scale.js     # Extrae escala rem() por componente
├── verify-colors.js         # Verifica colores reales vs definidos en CSS
├── generate-report.js       # Ensambla el informe HTML final con todos los datos
├── output/
│   ├── audit.html           # ← Informe final (abrir en navegador)
│   ├── styles.css           # Estilos del informe
│   ├── *.json               # Datos intermedios de cada fase
│   ├── assets/
│   │   ├── icons/           # Miniaturas PNG de iconos
│   │   └── components/      # Screenshots de componentes UI
│   └── pages/               # Screenshots y HTML de las 12 páginas auditadas
└── README.md
```

---

## Requisitos previos

- **Node.js** >= 18
- **Playwright** (se instala automáticamente)

---

## Instalación y ejecución

```bash
# 1. Clonar el repositorio
git clone https://github.com/<tu-usuario>/mcp-ibermutua.git
cd mcp-ibermutua

# 2. Instalar Playwright y el navegador Chromium
npm init -y
npm install playwright
npx playwright install chromium

# 3. Ejecutar los scripts de auditoría en orden
node audit-home.js
node audit-links.js
node audit-pages.js
node audit-colors.js
node enrich-colors.js
node audit-typography.js
node extract-rem-scale.js
node audit-icons.js
node audit-components.js
node audit-accessibility.js

# 4. Generar el informe HTML
node generate-report.js

# 5. Abrir el informe en el navegador
open output/audit.html
```

> **Nota:** Los scripts se ejecutan secuencialmente porque cada fase depende de los datos generados por la anterior.

---

## Cómo ver el informe

Simplemente abre `output/audit.html` en cualquier navegador moderno. No requiere servidor — es HTML/CSS/JS estático.

### Pestañas del informe

1. **Colores** — Paleta del sistema de diseño, top 15 por uso, distribución por tipo, gradientes
2. **Tipografía** — Familias detectadas, escala rem(), escala tipográfica, top estilos
3. **Iconos** — Grid con filtro por tipo (SVG/IMG/font), ranking top 20
4. **Componentes** — Showcase visual con filtros por categoría (botones, cards, formularios, etc.)
5. **Accesibilidad** — KPIs de contraste, mapa visual, issues WCAG AA, propuestas de mejora

---

## Tecnologías utilizadas

| Tecnología | Uso |
|-----------|-----|
| **Node.js** | Runtime para los scripts de auditoría |
| **Playwright** | Automatización del navegador (Chromium headless) |
| **HTML/CSS** | Informe estático sin frameworks |
| **JavaScript** | Lógica mínima inline para pestañas, filtros y búsqueda |

---

## Contexto académico

Este proyecto es un ejercicio práctico del curso **shift.r**, enfocado en:

- Automatización de auditorías de UI con herramientas de navegador headless
- Extracción y análisis de design tokens (colores, tipografía, espaciado)
- Inventario y catalogación de componentes UI
- Evaluación de accesibilidad web (WCAG AA)
- Generación de informes visuales a partir de datos estructurados

---

## Licencia

Proyecto académico — uso exclusivamente educativo.
