# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install      # install dependencies
npm run dev      # start Vite dev server at http://localhost:5173
npm run build    # production build to dist/
npm run preview  # preview the production build
```

There is no test runner, linter, or backend. This is a pure client-side React + Vite app.

## Big-Picture Architecture

A single-page dashboard for monitoring date palm farm health from Sentinel-2 satellite indices (NDVI, NDMI, SAVI, BSI). Built as a university project (Ecological Models, Braude College). The target user is **Ziv**, a non-technical date farm manager — features should be actionable and jargon-free.

**There is no backend and no database.** All data is static JSON bundled into the build, and every "insight" is computed in the browser at render time. Understanding the app means understanding the data → analytics → component pipeline orchestrated by `src/app/App.jsx`.

### Data flow (all in `src/app/App.jsx`)

1. Four farm blocks are defined in `src/data/farms.json` (id, polygon, color, and synthetic-generation parameters like `ndviBase`, `ndviRange`, `ndmiRatio`).
2. Each farm has a time-series JSON keyed in the `TS_BY_ID` map: `ts_naama1/2/4.json` are synthetic; `naama3` maps to `timeseries.json`, which is the **only real Sentinel-2 data** (~76 observations, May 2025 – Apr 2026; fields `date`, `ndvi_mean/min/max/std`, `ndmi_mean/min/max`, `savi_mean`, `bsi_mean`, `cloud_cover`).
3. `extendToToday` (`src/lib/extendSeries.js`) is applied first to bridge the gap between the last GEE export and today with modelled observations.
4. `ensureIndices` (`src/lib/ensureIndices.js`) backfills `savi_mean` and `bsi_mean` on synthetic and modelled records that lack them.
5. `App.jsx` then runs the series through `src/lib/analytics.js` to derive every descriptive insight, calls `computeForecast` (`src/lib/forecast.js`) for the kriging-based irrigation/harvest predictions, and feeds all of it to `src/lib/recommendations.js` to produce the coaching text.
6. Results are passed down as props to pages in `src/features/`, with shared shell/navigation in `src/layout/`. Feature components are display-only; **all logic lives in `src/lib/`.**

### Key modules

- **`src/lib/analytics.js`** — the analytical core. Pure functions over the time series: `cleanData` (drops observations with `cloud_cover >= CLOUD_THRESHOLD`, currently 20), `detectStressZone`, `irrigationEffectiveness` (Pearson NDVI↔NDMI), `fieldUniformity`, `seasonalPattern`, `detectAnomalies`, `currentVsExpected`, `recentTrend`. Add new descriptive metrics here, not in components.
- **`src/lib/kriging.js`** — generic 1-D kriging engine (a JS re-implementation of the course notebook's pykrige examples): Ordinary Kriging (`drift:'none'`) and Universal Kriging with linear drift (`drift:'linear'`), plus `linearDist`/`cyclicDist`. Every prediction returns a mean **and** a kriging variance (variance floored at the fitted nugget so the confidence band never collapses to zero at sampled points).
- **`src/lib/forecast.js`** — `computeForecast(data)` drives the Forecasts panel statistically: the harvest peak is the argmax of an Ordinary-Kriging NDVI curve over the day-of-year cycle, and the next-irrigation date is a Universal-Kriging projection of recent NDMI to the stress threshold (NDMI = 0.0). Returns chart-ready `series`/`observed` plus `irrigation`/`harvest` objects whose field names match what `recommendations.js` and `ForecastPanel` already consume.
- **`src/lib/extendSeries.js`** — `extendToToday(data)` bridges the GEE data gap (the export stopped after 2026-04-29). It appends modelled 5-day observations up to today by sampling the seasonal kriging curve, each flagged `estimated: true` so the UI keeps them visually distinct (the `⚠ modelled since…` badge and the NDVIChart "modelled →" reference line). `App.jsx` applies it before any analysis.
- **`src/lib/ensureIndices.js`** — `ensureIndices(data)` backfills `savi_mean` and `bsi_mean` on any record that lacks them. Synthetic blocks and modelled extension points don't carry these fields; the function fills them deterministically from NDVI using relationships fitted to the real Naama 3 series (`SAVI ≈ 0.80·NDVI`, `BSI ≈ 0.411 − 1.40·NDVI`). Real fields, where present, are left untouched.
- **`src/lib/generatePixelGrid.js`** — generates the spatial heatmap. The per-pixel NDVI/SAVI/NDMI grid is **synthetic**: it rasterizes each farm's polygon into 10 m pixels (point-in-polygon ray casting) and fills values from a **seeded** Mulberry32 RNG, so the heatmap is reproducible per farm but is mock data, not a real export. `src/data/pixel_grid.json` is a leftover static mock; the live app uses the generator.
- **`src/lib/recommendations.js`** — turns analytics output into the farmer-facing advice shown in `CoachPanel`. Spatial stress uses an absolute date-palm concern threshold (`STRESS_NDVI = 0.18`) so the coaching matches the map. Recommendations are sorted by priority (`high → medium → low`) then by time horizon (`now → week → season → longterm`).

### UI organization

The app uses a feature-first structure. `src/layout/` owns the app shell, sidebar/mobile navigation, hero header, and selected-farm context bar. `src/features/` owns business modules:

- `features/farms` — `FarmSelector` for switching active blocks
- `features/overview` — `OverviewPage`, `AlertBanner`, `KPIRow`
- `features/field-map` — `MapPage`, `FieldMap` (uses **React-Leaflet / Leaflet**)
- `features/trends` — `TrendsPage`, `NDVIChart`, `StressZonePanel`, `SeasonalChart` (all charts use **Recharts**)
- `features/forecast` — `ForecastPage`, `ForecastPanel`
- `features/advisor` — `AdvisorPage`, `CoachPanel`, `InsightsPanel`

Navigation metadata lives in `src/app/routes.js`; hash routing is implemented in `src/app/useHashRoute.js`.

> **Legacy stubs:** `src/components/` and `src/pages/` contain an older flat structure that was superseded by the feature-first refactor. Those files are stale — do not edit them; apply all changes to `src/features/`, `src/layout/`, or `src/lib/`.

### Domain note

Date palms in this hot-arid climate show **inverted phenology**: NDVI peaks in winter (~December) and troughs in summer (~August), opposite to temperate crops. Analytics like `seasonalPattern` and `currentVsExpected` account for this — don't "fix" them to assume a summer growth peak.

Date palms also have **naturally low, sparse-canopy NDVI** (~0.17–0.40 across blocks here; a young block sits near 0.20). The `FieldMap` color ramps in `FieldMap.jsx` (`RAMPS`) and the stress thresholds (`NDVI_ATTENTION = 0.18`, `NDVI_HEALTHY = 0.30`) are deliberately calibrated to this arid date-palm range and kept **absolute/farm-wide so the four blocks stay comparable** — do not retune them to generic dense-crop values (that painted the young Naama 1 block "100% stressed") and do not switch the map to per-block relative coloring (that erases the real vigor differences between blocks).

## `gee_scripts/`

Both scripts run in the Google Earth Engine Code Editor (not in the React build). They are the upstream tools for refreshing the app's static data files — **there is no live satellite feed**.

- **`export_timeseries.js`** — the primary refresh tool. Pulls `COPERNICUS/S2_SR_HARMONIZED`, cloud-masks via QA60 (bits 10 & 11), scales reflectance to 0–1, computes NDVI/NDMI/SAVI/BSI per image, reduces each image over the Naama 3 polygon with mean/min/max/stdDev at 10 m, and exports a CSV to Google Drive. To refresh the dashboard data: re-run with an updated `END_DATE`, export the CSV, convert each row to a JSON object, and replace `src/data/timeseries.json`.
- **`export_pixel_grid.js`** — picks the single best-recent cloudless image, samples NDVI/NDMI/SAVI at every 10 m pixel, and exports GeoJSON. The output can replace `src/data/pixel_grid.json` to give the field map real data instead of the synthetic generator.

Both scripts are hardcoded to the Naama 3 polygon coordinates; swap the polygon to export another block.
