/**
 * Builds the bundled demo project (public/demo/) from a project that the
 * backend has already processed.
 *
 *   node scripts/make-demo-data.mjs [projectName]      (default: tt)
 *
 * Inputs (produced by app/sharanga.py, read-only here):
 *   app/tif_files/<p>_filteredchm.tif   CHM after Otsu filtering (EPSG:4326)
 *   app/tif_files/<p>_chm.tif           raw CHM (for the height legend range)
 *   app/tif_files/<p>_ortho.tif         orthophoto (EPSG:4326)
 *   app/tif_files/<p>_colored.tif       height layer   (GeoServer "<p>_colored")
 *   app/tif_files/<p>_mgrvi.tif         health layer   (GeoServer "<p>_mgrvi")
 *   runs/detect/predict/labels/<p>_maskedchm.txt   YOLOv8 boxes
 *
 * The per-tree steps after YOLO (seed points, slope-based region growing,
 * girth, height, MGRVI, polygons) are a JavaScript port of app/sharanga.py so
 * the demo works without Python, PostGIS or GeoServer. Numbers can differ
 * slightly from the Python backend (float precision, contour tracing).
 * For the paper's exact numbers, export GeoJSON from a real project in the
 * app and save it as public/demo/trees.json instead.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromFile } from 'geotiff';
import jpeg from 'jpeg-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.resolve(HERE, '../public/demo');
const project = process.argv[2] ?? 'tt';
const tif = (kind) => path.join(ROOT, 'app/tif_files', `${project}_${kind}.tif`);
const labelsFile = path.join(ROOT, 'runs/detect/predict/labels', `${project}_maskedchm.txt`);
const MAX_PREVIEW_WIDTH = 1600;

const open = async (kind) => (await fromFile(tif(kind))).getImage();

// ---------------------------------------------------------------- inputs
const chmImg = await open('filteredchm');
const W = chmImg.getWidth();
const H = chmImg.getHeight();
const [chm] = await chmImg.readRasters();
const [originX, originY] = chmImg.getOrigin();
const [resX, resY] = chmImg.getResolution();
const chmBox = chmImg.getBoundingBox();

const orthoImg = await open('ortho');
const OW = orthoImg.getWidth();
const OH = orthoImg.getHeight();

// pixel_to_meter, as in sharanga.py: longitude-degree pixel width scaled by cos(lat)
const avgLat = (chmBox[1] + chmBox[3]) / 2;
const pixelToMeter = resX * ((2 * Math.PI * 6371000) / 360) * Math.cos((avgLat * Math.PI) / 180);

// ---------------------------------------------------------------- YOLO boxes -> CHM pixels
const boxes = (await fs.readFile(labelsFile, 'utf8'))
  .trim()
  .split('\n')
  .map((line) => line.trim().split(/\s+/).slice(1, 5).map(Number))
  .map(([cx, cy, w, h]) => {
    const wpx = w * OW;
    const hpx = h * OH;
    const xMin = cx * OW - wpx / 2;
    const yMin = cy * OH - hpx / 2;
    const sx = W / OW;
    const sy = H / OH;
    return [xMin * sx, yMin * sy, wpx * sx, hpx * sy];
  });

// Seed = CHM maximum inside each box (first occurrence, row-major)
const seeds = boxes.map(([bx, by, bw, bh]) => {
  const x0 = Math.max(0, Math.trunc(bx));
  const y0 = Math.max(0, Math.trunc(by));
  const x1 = Math.min(W, Math.trunc(bx) + Math.trunc(bw));
  const y1 = Math.min(H, Math.trunc(by) + Math.trunc(bh));
  let best = -Infinity;
  let at = [y0, x0];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const v = chm[y * W + x];
      if (v > best) {
        best = v;
        at = [y, x];
      }
    }
  }
  return at;
});

// ---------------------------------------------------------------- region growing
// Same rule as grow_region / should_continue_growing: the first 10 pixels of a
// path may not rise more than 0.1 m above the seed; after that the least-squares
// slope of height along the BFS path from the seed must stay <= 0.1.
const labels = new Int32Array(W * H);
const MAX_REGION = 40000 * 10;
const MIN_PATH = 10;
const SLOPE_TOL = 0.1;
const DY = [-1, -1, -1, 0, 0, 1, 1, 1];
const DX = [-1, 0, 1, -1, 1, -1, 0, 1];

function grow(seedIdx, label) {
  const seedH = chm[seedIdx];
  // per queued pixel: path length n, sum of heights, sum of (index * height)
  const qIdx = [seedIdx];
  const qN = [1];
  const qSy = [seedH];
  const qSxy = [0];
  let head = 0;
  let size = 0;
  while (head < qIdx.length && size < MAX_REGION) {
    const cur = qIdx[head];
    const n = qN[head];
    const sy = qSy[head];
    const sxy = qSxy[head];
    head++;
    const cy = Math.floor(cur / W);
    const cx = cur - cy * W;
    for (let k = 0; k < 8; k++) {
      const ny = cy + DY[k];
      const nx = cx + DX[k];
      if (ny < 0 || ny >= H || nx < 0 || nx >= W) continue;
      const ni = ny * W + nx;
      const h = chm[ni];
      if (labels[ni] !== 0 || !(h > 0)) continue;
      const L = n + 1; // len(new_path)
      const Sy = sy + h;
      const Sxy = sxy + (L - 1) * h;
      let ok;
      if (L <= MIN_PATH) {
        ok = seedH - h >= -SLOPE_TOL;
      } else {
        const Sx = (L * (L - 1)) / 2;
        const Sxx = ((L - 1) * L * (2 * L - 1)) / 6;
        const den = L * Sxx - Sx * Sx;
        ok = den !== 0 && (L * Sxy - Sx * Sy) / den <= SLOPE_TOL;
      }
      if (ok) {
        labels[ni] = label;
        qIdx.push(ni);
        qN.push(L);
        qSy.push(Sy);
        qSxy.push(Sxy);
        size++;
      }
    }
  }
}

let nextLabel = 1;
for (const [y, x] of seeds) {
  const i = y * W + x;
  if (labels[i] === 0 && chm[i] !== 0) {
    labels[i] = nextLabel;
    grow(i, nextLabel);
    nextLabel++;
  }
}

// ---------------------------------------------------------------- per-tree metrics
const regions = new Map(); // label -> {height, minX, minY, maxX, maxY}
for (let i = 0; i < labels.length; i++) {
  const l = labels[i];
  if (!l) continue;
  const y = Math.floor(i / W);
  const x = i - y * W;
  let r = regions.get(l);
  if (!r) {
    r = { height: -Infinity, minX: x, minY: y, maxX: x, maxY: y, start: i, sumMgrvi: 0, nMgrvi: 0 };
    regions.set(l, r);
  }
  if (chm[i] > r.height) r.height = chm[i];
  if (x < r.minX) r.minX = x;
  if (x > r.maxX) r.maxX = x;
  if (y > r.maxY) r.maxY = y;
}

// MGRVI = (G^2 - R^2) / (G^2 + R^2), averaged over ortho pixels under each crown
{
  const [red, green] = await orthoImg.readRasters({ samples: [0, 1] });
  for (let r = 0; r < OH; r++) {
    const cr = Math.min(H - 1, Math.floor(((r + 0.5) * H) / OH));
    for (let c = 0; c < OW; c++) {
      const cc = Math.min(W - 1, Math.floor(((c + 0.5) * W) / OW));
      const l = labels[cr * W + cc];
      if (!l) continue;
      const R = red[r * OW + c];
      const G = green[r * OW + c];
      const reg = regions.get(l);
      reg.sumMgrvi += (G * G - R * R) / (G * G + R * R + 1e-10);
      reg.nMgrvi++;
    }
  }
}

// Moore-neighbour boundary trace (clockwise, y down), starting at the region's first pixel
const MOORE = [
  [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1],
]; // [dx, dy]: W, NW, N, NE, E, SE, S, SW
function trace(label, startIdx) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && labels[y * W + x] === label;
  const sy = Math.floor(startIdx / W);
  const sx = startIdx - sy * W;
  const pts = [[sx, sy]];
  let px = sx;
  let py = sy;
  let back = 0; // entered from the west
  let first = null;
  for (let guard = 0; guard < 4 * W * H; guard++) {
    let found = -1;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      if (inside(px + MOORE[d][0], py + MOORE[d][1])) {
        found = d;
        break;
      }
    }
    if (found < 0) return pts; // single pixel
    const nx = px + MOORE[found][0];
    const ny = py + MOORE[found][1];
    if (first === null) first = [nx, ny];
    else if (px === sx && py === sy && nx === first[0] && ny === first[1]) break;
    // backtrack = the neighbour examined just before `found`, seen from the new pixel
    const bx = px + MOORE[(found + 7) % 8][0] - nx;
    const by = py + MOORE[(found + 7) % 8][1] - ny;
    back = MOORE.findIndex(([dx, dy]) => dx === bx && dy === by);
    px = nx;
    py = ny;
    pts.push([px, py]);
  }
  if (pts.length > 1) pts.pop(); // last point repeats the start
  return pts;
}

function hullDiameter(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop();
    upper.push(q);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  let best = 0;
  for (let i = 0; i < hull.length; i++) {
    for (let j = i + 1; j < hull.length; j++) {
      best = Math.max(best, Math.hypot(hull[i][0] - hull[j][0], hull[i][1] - hull[j][1]));
    }
  }
  return best;
}

function simplify(points, eps) {
  // Douglas-Peucker on an open polyline
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points.at(-1);
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let worst = -1;
  let at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const d = Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / len;
    if (d > worst) {
      worst = d;
      at = i;
    }
  }
  if (worst <= eps) return [points[0], points.at(-1)];
  return simplify(points.slice(0, at + 1), eps).slice(0, -1).concat(simplify(points.slice(at), eps));
}

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const toGeo = ([x, y]) => [round(originX + resX * x, 9), round(originY + resY * y, 9)];

const features = [];
let treeId = 0;
for (const label of [...regions.keys()].sort((a, b) => a - b)) {
  const reg = regions.get(label);
  treeId++; // tree ids follow np.unique(labels), like the backend
  const ring = trace(label, reg.start);
  if (ring.length < 4) continue; // backend skips contours with < 4 points
  const girth = hullDiameter(ring) * pixelToMeter;
  const mgrvi = reg.nMgrvi ? reg.sumMgrvi / reg.nMgrvi : null;
  const health =
    mgrvi === null ? 'Unknown' : mgrvi < 0 ? 'Poor' : mgrvi < 0.25 ? 'Moderately Healthy' : 'Healthy';
  // split the closed ring in two so Douglas-Peucker keeps both halves
  const mid = Math.floor(ring.length / 2);
  const simple = simplify(ring.slice(0, mid + 1), 0.75)
    .slice(0, -1)
    .concat(simplify(ring.slice(mid).concat([ring[0]]), 0.75));
  features.push({
    type: 'Feature',
    properties: {
      TreeID: treeId,
      Girth: round(girth, 2),
      Height: round(reg.height, 2),
      Health: health,
      MGRVI: mgrvi === null ? null : round(mgrvi, 2),
    },
    geometry: { type: 'Polygon', coordinates: [simple.map(toGeo)] },
  });
}

let ext = [Infinity, Infinity, -Infinity, -Infinity];
for (const f of features) {
  for (const [x, y] of f.geometry.coordinates[0]) {
    ext = [Math.min(ext[0], x), Math.min(ext[1], y), Math.max(ext[2], x), Math.max(ext[3], y)];
  }
}

// ---------------------------------------------------------------- legend ranges
const [rawChm] = await (await open('chm')).readRasters();
const chmNoData = (await open('chm')).getGDALNoData();
let chmMin = Infinity;
let chmMax = -Infinity;
for (const v of rawChm) {
  if (v === chmNoData || Number.isNaN(v)) continue;
  if (v < chmMin) chmMin = v;
  if (v > chmMax) chmMax = v;
}

// ---------------------------------------------------------------- raster previews
await fs.mkdir(OUT, { recursive: true });
const pw = Math.min(MAX_PREVIEW_WIDTH, OW);
const ph = Math.round((pw * OH) / OW);
const orthoBands = await orthoImg.readRasters({ width: pw, height: ph, resampleMethod: 'bilinear' });

async function writeJpeg(name, bands) {
  const data = Buffer.alloc(pw * ph * 4);
  for (let i = 0; i < pw * ph; i++) {
    data[i * 4] = bands[0][i];
    data[i * 4 + 1] = bands[1][i];
    data[i * 4 + 2] = bands[2][i];
    data[i * 4 + 3] = 255;
  }
  await fs.writeFile(path.join(OUT, name), jpeg.encode({ data, width: pw, height: ph }, 82).data);
}
await writeJpeg('ortho.jpg', orthoBands);
await writeJpeg('height.jpg', await (await open('colored')).readRasters({ width: pw, height: ph }));
await writeJpeg('health.jpg', await (await open('mgrvi')).readRasters({ width: pw, height: ph }));

await fs.writeFile(
  path.join(OUT, 'trees.json'),
  JSON.stringify({ type: 'FeatureCollection', features, extent: ext }),
);
await fs.writeFile(
  path.join(OUT, 'meta.json'),
  JSON.stringify(
    {
      project,
      imageExtent: orthoImg.getBoundingBox(),
      heightRange: [round(chmMin, 2), round(chmMax, 2)],
      generated: new Date().toISOString().slice(0, 10),
    },
    null,
    2,
  ),
);

console.log(`Seeds: ${seeds.length}  regions: ${regions.size}  trees written: ${features.length}`);
console.log(`Pixel size: ${(pixelToMeter * 100).toFixed(2)} cm  CHM range: ${chmMin.toFixed(2)}..${chmMax.toFixed(2)} m`);
for (const f of features) console.log(' ', JSON.stringify(f.properties), 'vertices', f.geometry.coordinates[0].length);
