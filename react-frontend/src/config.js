const env = import.meta.env;

/** Flask backend. An explicitly empty VITE_API_BASE builds a demo-only site. */
export const API_BASE = (env.VITE_API_BASE ?? 'http://localhost:5000').replace(/\/+$/, '');
export const BACKEND_ENABLED = API_BASE !== '';

/** GeoServer WMS for the workspace geoserver.py publishes into. */
export const GEOSERVER_WMS = env.VITE_GEOSERVER_WMS ?? 'http://localhost:8080/geoserver/Sharanga/wms';
/** Workspace name hard-coded in app/geoserver.py. Internal only (never shown); must match the backend. */
export const GEOSERVER_WORKSPACE = 'Sharanga';

/** Source code link shown on the site (set in .env.demo for the public demo). */
export const REPO_URL = env.VITE_REPO_URL ?? '';

/** Name shown in the header, browser tab and sign-in pages. */
export const APP_NAME = 'Urban Forest GIS';

/** The old upload page enforced this limit; the backend defines the same constant. */
export const MAX_FILE_BYTES = 350 * 1024 * 1024;

/** MGRVI health classes, exactly as app/sharanga.py classifies them. */
export const MGRVI_POOR_BELOW = 0;
export const MGRVI_HEALTHY_FROM = 0.25;

/** Route id used for the bundled demo project. */
export const DEMO_ID = 'demo';

/**
 * Paper reference shown on the About page. Fill in the empty fields;
 * empty fields are simply not shown.
 */
export const PAPER = {
  title: 'GIS Based Automated Tool for Urban Forest Management using UAV Data',
  authors: '',
  venue: '',
  year: '',
  url: '',
};
