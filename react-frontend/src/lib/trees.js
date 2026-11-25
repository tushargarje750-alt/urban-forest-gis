import GeoJSON from 'ol/format/GeoJSON.js';
import { getArea } from 'ol/sphere.js';
import { fromExtent } from 'ol/geom/Polygon.js';
import { transformExtent, toLonLat } from 'ol/proj.js';
import { getCenter } from 'ol/extent.js';
import { MGRVI_HEALTHY_FROM, MGRVI_POOR_BELOW } from '../config.js';

/* ---------------- health classes ---------------- */

// Status colours: fixed, always shown with an icon and a label.
export const HEALTH = [
  { key: 'Healthy', label: 'Healthy', color: '#0ca30c', text: '#ffffff', icon: 'check' },
  { key: 'Moderately Healthy', label: 'Moderately healthy', color: '#fab219', text: '#0b0b0b', icon: 'minus' },
  { key: 'Poor', label: 'Poor', color: '#d03b3b', text: '#ffffff', icon: 'alert' },
  { key: 'Unknown', label: 'Unknown', color: '#898781', text: '#ffffff', icon: 'question' },
];
export const HEALTH_BY_KEY = Object.fromEntries(HEALTH.map((h) => [h.key, h]));

export function healthKey(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'healthy') return 'Healthy';
  if (s === 'moderately healthy') return 'Moderately Healthy';
  if (s === 'poor') return 'Poor';
  return 'Unknown';
}

export function healthFromMgrvi(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'Unknown';
  if (v < MGRVI_POOR_BELOW) return 'Poor';
  if (v < MGRVI_HEALTHY_FROM) return 'Moderately Healthy';
  return 'Healthy';
}

/* ---------------- sequential ramp for height (one hue, light -> dark) ---------------- */

export const HEIGHT_RAMP = [
  '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5',
  '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b',
];

export function rampColor(t) {
  const i = Math.round(Math.min(1, Math.max(0, t)) * (HEIGHT_RAMP.length - 1));
  return HEIGHT_RAMP[i];
}

/* ---------------- loading ---------------- */

const toNum = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/**
 * Turns the backend's FeatureCollection into OL features (map projection
 * EPSG:3857) and plain tree records used by charts, stats and the table.
 */
export function buildTrees(fc) {
  const format = new GeoJSON({ dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
  const features = format.readFeatures({ type: 'FeatureCollection', features: fc?.features ?? [] });
  const trees = features.map((feature, i) => {
    const p = feature.getProperties();
    const geom = feature.getGeometry();
    const id = toNum(p.TreeID) ?? i + 1;
    feature.setId(id);
    const center = geom ? getCenter(geom.getExtent()) : null;
    return {
      id,
      height: toNum(p.Height),
      girth: toNum(p.Girth),
      mgrvi: toNum(p.MGRVI),
      health: healthKey(p.Health),
      crownArea: geom ? getArea(geom, { projection: 'EPSG:3857' }) : null,
      lonLat: center ? toLonLat(center) : null,
      feature,
    };
  });
  trees.sort((a, b) => a.id - b.id);

  let extent4326 = Array.isArray(fc?.extent) && fc.extent.length === 4 ? fc.extent : null;
  if (!extent4326 && features.length) {
    const src = format.writeFeaturesObject(features);
    extent4326 = bboxOf(src);
  }
  return { trees, extent4326 };
}

function bboxOf(fc) {
  let e = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (c) => {
    if (typeof c[0] === 'number') e = [Math.min(e[0], c[0]), Math.min(e[1], c[1]), Math.max(e[2], c[0]), Math.max(e[3], c[1])];
    else c.forEach(visit);
  };
  fc.features.forEach((f) => f.geometry && visit(f.geometry.coordinates));
  return Number.isFinite(e[0]) ? e : null;
}

/* ---------------- filters ---------------- */

export const EMPTY_FILTERS = {
  minHeight: '',
  maxHeight: '',
  minGirth: '',
  maxGirth: '',
  health: [],
  query: '',
};

export function filtersActive(f) {
  return Boolean(f.minHeight !== '' || f.maxHeight !== '' || f.minGirth !== '' || f.maxGirth !== '' || f.health.length || f.query.trim());
}

export function applyFilters(trees, f) {
  const n = (v) => (v === '' ? null : Number(v));
  const [hMin, hMax, gMin, gMax] = [n(f.minHeight), n(f.maxHeight), n(f.minGirth), n(f.maxGirth)];
  const ids = f.query
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return trees.filter((t) => {
    if (hMin !== null && !(t.height >= hMin)) return false;
    if (hMax !== null && !(t.height <= hMax)) return false;
    if (gMin !== null && !(t.girth >= gMin)) return false;
    if (gMax !== null && !(t.girth <= gMax)) return false;
    if (f.health.length && !f.health.includes(t.health)) return false;
    if (ids.length && !ids.includes(String(t.id))) return false;
    return true;
  });
}

/* ---------------- statistics ---------------- */

const valid = (arr) => arr.filter((v) => v !== null && Number.isFinite(v));
export const mean = (arr) => {
  const v = valid(arr);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
export const median = (arr) => {
  const v = valid(arr).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
export const extentOf = (arr) => {
  const v = valid(arr);
  return v.length ? [Math.min(...v), Math.max(...v)] : null;
};

/** Geodesic area (m²) of the [minX, minY, maxX, maxY] EPSG:4326 box. */
export function extentArea(extent4326) {
  if (!extent4326) return null;
  const e = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');
  return getArea(fromExtent(e), { projection: 'EPSG:3857' });
}

export function summarize(trees, extent4326) {
  const heights = trees.map((t) => t.height);
  const girths = trees.map((t) => t.girth);
  const counts = Object.fromEntries(HEALTH.map((h) => [h.key, 0]));
  trees.forEach((t) => {
    counts[t.health] += 1;
  });
  const crown = valid(trees.map((t) => t.crownArea)).reduce((a, b) => a + b, 0);
  const area = extentArea(extent4326);
  return {
    count: trees.length,
    meanHeight: mean(heights),
    medianHeight: median(heights),
    heightRange: extentOf(heights),
    meanGirth: mean(girths),
    girthRange: extentOf(girths),
    meanMgrvi: mean(trees.map((t) => t.mgrvi)),
    health: counts,
    healthyShare: trees.length ? counts.Healthy / trees.length : null,
    crownArea: crown,
    meanCrownArea: trees.length ? crown / trees.length : null,
    extentArea: area,
    canopyCover: area ? crown / area : null,
    densityPerHa: area ? trees.length / (area / 10000) : null,
  };
}

/* ---------------- histogram bins ---------------- */

const NICE = [0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50];

export function niceStep(range, target = 8) {
  const raw = range / target;
  return NICE.find((s) => s >= raw) ?? Math.pow(10, Math.ceil(Math.log10(raw)));
}

/** Equal-width bins aligned to multiples of `step`. */
export function histogram(values, { step, min, max } = {}) {
  const v = valid(values);
  if (!v.length) return [];
  const lo0 = min ?? Math.min(...v);
  const hi0 = max ?? Math.max(...v);
  const s = step ?? niceStep(Math.max(hi0 - lo0, 1e-6));
  const lo = Math.floor(lo0 / s + 1e-9) * s;
  let hi = Math.ceil(hi0 / s - 1e-9) * s;
  if (hi <= lo) hi = lo + s;
  const n = Math.max(1, Math.round((hi - lo) / s));
  const bins = Array.from({ length: n }, (_, i) => ({ x0: lo + i * s, x1: lo + (i + 1) * s, count: 0 }));
  for (const x of v) {
    let i = Math.floor((x - lo) / s + 1e-9);
    if (i >= n) i = n - 1;
    if (i < 0) i = 0;
    bins[i].count++;
  }
  return bins;
}
