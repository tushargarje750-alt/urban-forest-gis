/**
 * Reads only the header of a GeoTIFF in the browser (no full download into
 * memory) and checks it against what app/sharanga.py needs, so obvious
 * mistakes surface before a long upload.
 */
import { fromBlob } from 'geotiff';
import { MAX_FILE_BYTES } from '../config.js';
import { bytes } from './format.js';

const GEOGRAPHIC = 2;
const METRE = 9001;

export async function inspectTiff(file) {
  const info = { name: file.name, size: file.size };
  const tiff = await fromBlob(file);
  const image = await tiff.getImage();
  info.width = image.getWidth();
  info.height = image.getHeight();
  info.bands = image.getSamplesPerPixel();
  info.bits = image.getBitsPerSample?.(0) ?? image.fileDirectory.BitsPerSample?.[0];
  const fmt = image.fileDirectory.SampleFormat?.[0] ?? 1;
  info.type = fmt === 3 ? `${info.bits}-bit float` : `${info.bits}-bit ${fmt === 2 ? 'signed ' : ''}integer`;
  info.noData = image.getGDALNoData();

  const keys = image.getGeoKeys();
  info.epsg = keys?.ProjectedCSTypeGeoKey ?? keys?.GeographicTypeGeoKey ?? null;
  if (info.epsg === 32767) info.epsg = null; // user-defined
  info.geographic = keys?.GTModelTypeGeoKey === GEOGRAPHIC;
  info.crsName = keys?.GTCitationGeoKey || keys?.GeogCitationGeoKey || (info.epsg ? `EPSG:${info.epsg}` : null);
  try {
    info.bbox = image.getBoundingBox();
    const [rx] = image.getResolution();
    const lat = (info.bbox[1] + info.bbox[3]) / 2;
    if (info.geographic) {
      info.pixelMetres = Math.abs(rx) * 111320 * Math.cos((lat * Math.PI) / 180);
    } else if (!keys?.ProjLinearUnitsGeoKey || keys.ProjLinearUnitsGeoKey === METRE) {
      info.pixelMetres = Math.abs(rx);
    }
  } catch {
    info.bbox = null;
  }
  info.georeferenced = Boolean(info.bbox && keys);
  return info;
}

const issue = (level, text) => ({ level, text });

/** Checks for a single file of the given role ('ortho' | 'dem' | 'dtm'). */
export function checkFile(role, file, info, parseError) {
  const out = [];
  if (!/\.(tif|tiff)$/i.test(file.name)) {
    out.push(issue('error', 'The backend only accepts files ending in .tif or .tiff; other files are silently skipped.'));
  }
  if (file.size > MAX_FILE_BYTES) {
    out.push(issue('error', `File is ${bytes(file.size)}; the limit is ${bytes(MAX_FILE_BYTES)}.`));
  }
  if (parseError) {
    out.push(issue('error', 'This does not look like a valid TIFF file.'));
    return out;
  }
  if (!info.georeferenced) {
    out.push(issue('error', 'No map coordinates found. The pipeline needs a GeoTIFF with a coordinate reference system.'));
  }
  if (role === 'ortho') {
    if (info.bands < 3) {
      out.push(issue('error', `The orthophoto needs red, green and blue bands; this file has ${info.bands}.`));
    } else if (info.bands > 3) {
      const extra = info.bands - 3;
      out.push(issue('info', `Bands 1–3 are used as red, green and blue; ${extra === 1 ? 'band 4 is' : `the other ${extra} bands are`} ignored.`));
    }
    if (info.bits !== 8) {
      out.push(issue('warning', `This is ${info.type} imagery. The pipeline writes the masked ortho as 8-bit, so colours can come out wrong. An 8-bit RGB export is safest.`));
    }
  } else {
    if (info.bands > 1) {
      out.push(issue('info', `Only band 1 is used; this file has ${info.bands} bands.`));
    }
  }
  return out;
}

/** Checks across files (needs all inspected infos). */
export function checkSet({ ortho, dem, dtm }) {
  const out = [];
  if (dem && dtm) {
    if (dem.width !== dtm.width || dem.height !== dtm.height) {
      out.push(issue('error', `DEM (${dem.width} × ${dem.height} px) and DTM (${dtm.width} × ${dtm.height} px) must be the same size: tree height is computed pixel by pixel as DEM − DTM.`));
    } else if (dem.bbox && dtm.bbox && dem.epsg === dtm.epsg) {
      const tol = Math.abs((dem.bbox[2] - dem.bbox[0]) / dem.width);
      const off = dem.bbox.some((v, i) => Math.abs(v - dtm.bbox[i]) > tol);
      if (off) out.push(issue('warning', 'DEM and DTM have the same size but cover slightly different areas, so heights may be shifted.'));
    }
    if (dem.epsg && dtm.epsg && dem.epsg !== dtm.epsg) {
      out.push(issue('error', `DEM (EPSG:${dem.epsg}) and DTM (EPSG:${dtm.epsg}) use different coordinate systems.`));
    }
  }
  if (ortho?.bbox && dem?.bbox && ortho.epsg && ortho.epsg === dem.epsg) {
    const [a, b] = [ortho.bbox, dem.bbox];
    const overlap = a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    if (!overlap) out.push(issue('error', 'The orthophoto and the DEM do not overlap, so no trees can be found.'));
  }
  return out;
}
