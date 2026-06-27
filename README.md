# Date Farm Dashboard — Analytics-Driven Prototype

NDVI/NDMI dashboard for Naama Farm in the Jordan Valley. The app combines Sentinel-2 time-series analytics, field-level pixel heatmaps, kriging-based forecasts, and farmer-facing recommendations.

## UI Upgrade in This Version

The dashboard has been reorganized into a feature-first React structure and wrapped in a new application shell:

- Sidebar navigation on desktop, compact horizontal navigation on tablet/mobile
- Large contextual page header with the active module title and current NDVI status
- Responsive farm-block selector cards
- Current-condition metric strip above the detailed panels
- Reworked card, panel, alert, forecast, map, trend, and advisor styling
- Cleaner feature folders so each business area owns its page and components

## Stack

- Vite + React 18
- Recharts for time-series and forecast charts
- React-Leaflet for spatial heatmaps
- Client-side analytics in `src/lib`

## Project Structure

```text
date-farm-dashboard/
├── gee_scripts/
│   └── export_pixel_grid.js
├── src/
│   ├── app/
│   │   ├── App.jsx              # Data wiring, active route, page rendering
│   │   ├── App.css              # Shared dashboard panel/grid styles
│   │   ├── routes.js            # Navigation/page metadata
│   │   └── useHashRoute.js      # Dependency-free hash routing
│   ├── layout/
│   │   ├── AppShell.jsx         # Sidebar, hero header, summary metrics, main content
│   │   ├── AppShell.css
│   │   ├── NavBar.jsx           # Desktop/sidebar and mobile nav variants
│   │   ├── NavBar.css
│   │   ├── FarmContextBar.jsx
│   │   └── FarmContextBar.css
│   ├── features/
│   │   ├── farms/
│   │   │   └── components/FarmSelector.jsx
│   │   ├── overview/
│   │   │   ├── OverviewPage.jsx
│   │   │   └── components/      # Alert banner and KPI cards
│   │   ├── field-map/
│   │   │   ├── MapPage.jsx
│   │   │   └── components/FieldMap.jsx
│   │   ├── trends/
│   │   │   ├── TrendsPage.jsx
│   │   │   └── components/      # NDVI chart, stress analysis, seasonal chart
│   │   ├── forecast/
│   │   │   ├── ForecastPage.jsx
│   │   │   └── components/ForecastPanel.jsx
│   │   └── advisor/
│   │       ├── AdvisorPage.jsx
│   │       └── components/      # Field coach and key findings
│   ├── data/                    # Farm polygons and time-series data
│   ├── lib/                     # Analytics, forecast, kriging, recommendations
│   ├── main.jsx
│   └── index.css                # Global tokens and base styles
├── package.json
└── package-lock.json
```

## Setup

```bash
cd date-farm-dashboard
npm install
npm run dev
```

Open the Vite local URL shown in the terminal, usually `http://localhost:5173`.

## Build

```bash
npm run build
```

The source zip intentionally does not include `node_modules` or `dist`. Reinstall dependencies on your machine before running or building.

## Dashboard Modules

### Overview

At-a-glance operational health: alert threshold, current NDVI, recent trend, irrigation effectiveness, field uniformity, and persistent stress-zone status.

### Field Map

Leaflet-based heatmap for NDVI, SAVI, and NDMI across generated Sentinel-2-sized pixels. The selected block is shown with a comparable absolute color scale and walking-priority stress direction.

### Trends

NDVI and NDMI time-series view with date filtering and CSV export, plus stress-gap persistence and monthly seasonal-cycle analysis.

### Forecast

Kriging-derived NDVI/harvest peak forecast and irrigation-window projection with 95% confidence bands.

### Advisor

Prioritized farmer-facing recommendations, grouped by immediate actions and strategic planning, plus narrative key findings.

## Data Currency

The Sentinel-2 export stopped after **2026-04-29**. `src/lib/extendSeries.js` appends modeled observations to keep the interface current. Modeled observations are surfaced in the header/context bar and on the NDVI chart.

## Adding a New Feature

Create a new folder under `src/features/<feature-name>/`, add its page/component files there, and register the route metadata in `src/app/routes.js`. Render the new page from `src/app/App.jsx` using the existing hash-route pattern.
