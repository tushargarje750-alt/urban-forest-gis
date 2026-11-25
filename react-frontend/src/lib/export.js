import GeoJSON from 'ol/format/GeoJSON.js';

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const round = (v, d) => (v === null || v === undefined || Number.isNaN(v) ? '' : Number(v.toFixed(d)));

export function exportCsv(projectName, trees) {
  const header = ['TreeID', 'Health', 'Height_m', 'CanopyGirth_m', 'CrownArea_m2', 'MGRVI', 'Longitude', 'Latitude'];
  const rows = trees.map((t) => [
    t.id,
    t.health,
    round(t.height, 2),
    round(t.girth, 2),
    round(t.crownArea, 2),
    round(t.mgrvi, 2),
    t.lonLat ? round(t.lonLat[0], 7) : '',
    t.lonLat ? round(t.lonLat[1], 7) : '',
  ]);
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  download(`${projectName}_trees.csv`, `${csv}\n`, 'text/csv;charset=utf-8');
}

/** Same shape the backend returns from /get_tree_data, so it can be re-used as demo data. */
export function exportGeoJson(projectName, trees, extent4326) {
  const format = new GeoJSON({ dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
  const fc = format.writeFeaturesObject(
    trees.map((t) => t.feature),
    { decimals: 9 },
  );
  fc.features.forEach((f, i) => {
    const t = trees[i];
    f.properties = { TreeID: t.id, Girth: t.girth, Height: t.height, Health: t.health, MGRVI: t.mgrvi };
    delete f.id;
  });
  download(
    `${projectName}_trees.geojson`,
    JSON.stringify({ ...fc, extent: extent4326 ?? undefined }),
    'application/geo+json',
  );
}
