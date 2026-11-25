# Urban Forest GIS: frontend

Web interface for the UAV urban-tree pipeline in this repository (`app.py`, `app/sharanga.py`).
The app name is set in `src/config.js` (`APP_NAME`).
It uploads an orthophoto + DEM + DTM, then shows every detected tree with its height,
canopy girth and MGRVI health on a map, with charts, a sortable table and CSV/GeoJSON export.

The backend is used exactly as published. This app only calls its existing endpoints.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

The bundled **demo project** works with no backend at all.

To use your own data, start the backend first (PostgreSQL + PostGIS, GeoServer on :8080,
then Flask from the repository root, because `app/sharanga.py` uses relative paths).

On macOS, port 5000 is taken by AirPlay Receiver. Run Flask on another port without
editing `app.py`:

```bash
cd .. && flask --app app run --port 5001
```

and point the frontend at it in `react-frontend/.env.local`:

```
VITE_API_BASE=http://localhost:5001
```

## Configuration (`.env.local`, see `.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE` | `http://localhost:5000` | Flask backend. Set it **empty** to build a demo-only site (no sign-in or upload). |
| `VITE_GEOSERVER_WMS` | `http://localhost:8080/geoserver/Sharanga/wms` | WMS for the ortho / height / health layers. `Sharanga` is the workspace name fixed in `app/geoserver.py`. |

The paper reference on the Method page is in `src/config.js` (`PAPER`).

## Build

```bash
npm run build        # static files in dist/, works from any sub-path
npm run build:demo   # demo-only site (settings in .env.demo): no sign-in or upload
```

The public demo at https://tushargarje750-alt.github.io/urban-forest-gis/ is built with
`build:demo` and published by `.github/workflows/deploy-demo.yml` on every push to `main`
that touches `react-frontend/`.

## Demo data

`public/demo/` is generated from a project the backend has already processed:

```bash
npm run demo-data -- tt
```

It reads `app/tif_files/<project>_*.tif` and the YOLO labels in `runs/detect/predict/labels/`,
then reruns the later pipeline steps (seeds, region growing, metrics) in JavaScript.
For the backend's exact numbers instead, open a real project in the app, click **GeoJSON**,
and save the file as `public/demo/trees.json`.

## How backend quirks are handled

- `POST /upload` runs the whole pipeline inside the request and replies `ok` even when it
  fails. The app reads the real outcome from `GET /status` afterwards.
- `/status` is one global flag, so the app warns before starting while another run is active.
- Project names become table and layer names, so the form only allows letters, digits and `_`.
- GeoTIFF headers are read in the browser before upload: band count, bit depth, CRS, and
  DEM/DTM size match (the CHM is computed pixel by pixel).
- If GeoServer is down, the map still shows crowns and all numbers, with a notice.
- Sign-in uses `/login_page` and `/register`. The backend doesn't enforce sessions, so sign-in
  only gates the upload and project screens in the browser.

## Layout

```
src/
  config.js            endpoints, limits, health thresholds, paper reference
  lib/api.js           backend client (+ demo loader)
  lib/trees.js         GeoJSON → trees, filters, stats, histogram bins
  lib/tiff.js          in-browser GeoTIFF header checks
  lib/export.js        CSV / GeoJSON export
  components/          map (OpenLayers), charts (SVG), dashboard pieces, table
  pages/               Home, Projects, Results, Upload, About, Auth
scripts/make-demo-data.mjs
```
