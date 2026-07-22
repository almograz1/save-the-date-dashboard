# UI Upgrade Notes

## What changed

- Added a new feature-first structure under `src/features/`.
- Added `src/layout/` for the app shell, sidebar/mobile navigation, hero header, and selected-farm context bar.
- Moved routing/page metadata into `src/app/routes.js` and route reading into `src/app/useHashRoute.js`.
- Reworked the visual system with CSS tokens in `src/index.css`.
- Upgraded panels, KPI cards, farm selector cards, alerts, trends, map controls, forecast cards, and advisor cards.
- Kept the existing analytics, kriging forecast, pixel-grid generation, and recommendation logic intact.

## New top-level source layout

```text
src/
├── app/
├── layout/
├── features/
├── data/
├── lib/
├── main.jsx
└── index.css
```

## Verification performed in the sandbox

- Checked relative import paths across all JS/JSX files.
- Checked plain JS files with `node --check`.
- Parsed all JS/JSX files with the TypeScript parser.

`npm run build` could not be completed in the sandbox because the uploaded archive contained platform-specific/missing `node_modules` binaries and the sandbox did not have the npm cache needed to reinstall dependencies offline. On a normal development machine, run:

```bash
npm install
npm run build
```
