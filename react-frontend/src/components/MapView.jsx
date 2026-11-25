import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import ImageLayer from 'ol/layer/Image.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import OSM from 'ol/source/OSM.js';
import TileWMS from 'ol/source/TileWMS.js';
import ImageStatic from 'ol/source/ImageStatic.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import { defaults as defaultControls, ScaleLine, OverviewMap } from 'ol/control.js';
import { transformExtent } from 'ol/proj.js';
import { GEOSERVER_WMS, GEOSERVER_WORKSPACE } from '../config.js';
import { HEALTH_BY_KEY, rampColor } from '../lib/trees.js';

const RASTERS = ['ortho', 'height', 'health'];
const WMS_SUFFIX = { ortho: 'ortho', height: 'colored', health: 'mgrvi' };

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * OpenLayers map. Rasters come either from GeoServer WMS (live projects) or
 * from static images (demo). Crowns are styled by health or by height.
 *
 * props:
 *  trees, visibleIds:Set, selectedId, hoverId, onSelect(id|null), onHover(id|null)
 *  colorBy: 'health' | 'height', heightDomain: [min,max]
 *  layers: { basemap:bool, ortho, height, health, crowns: {on, opacity} }
 *  source: { kind:'wms', project } | { kind:'static', images, extent4326 }
 *  extent4326, onRasterError(kind)
 */
const MapView = forwardRef(function MapView(props, ref) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const propsRef = useRef(props);
  propsRef.current = props;

  // ---- create the map once
  useEffect(() => {
    const crowns = new VectorLayer({
      source: new VectorSource(),
      style: (feature) => crownStyle(feature, propsRef.current),
      zIndex: 10,
    });
    const basemap = new TileLayer({ source: new OSM(), zIndex: 0 });
    const map = new Map({
      target: el.current,
      layers: [basemap, crowns],
      view: new View({ center: [0, 0], zoom: 2, maxZoom: 26 }),
      controls: defaultControls({ rotate: false, attributionOptions: { collapsible: false } }).extend([
        new ScaleLine({ units: 'metric' }),
        new OverviewMap({
          layers: [new TileLayer({ source: new OSM() })],
          collapsed: true,
          tipLabel: 'Overview map',
          label: '◰',
          collapseLabel: '×',
        }),
      ]),
    });
    layersRef.current = { basemap, crowns };
    mapRef.current = map;

    const hit = (pixel) => map.forEachFeatureAtPixel(pixel, (f) => f, { layerFilter: (l) => l === crowns, hitTolerance: 2 });
    map.on('singleclick', (e) => {
      const f = hit(e.pixel);
      const vis = propsRef.current.visibleIds;
      propsRef.current.onSelect?.(f && (!vis || vis.has(f.getId())) ? f.getId() : null);
    });
    map.on('pointermove', (e) => {
      if (e.dragging) return;
      const f = hit(e.pixel);
      const vis = propsRef.current.visibleIds;
      const id = f && (!vis || vis.has(f.getId())) ? f.getId() : null;
      map.getTargetElement().style.cursor = id !== null ? 'pointer' : '';
      if (id !== (propsRef.current.hoverId ?? null)) propsRef.current.onHover?.(id);
    });

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  // ---- raster layers follow the data source
  const sourceKey = props.source ? JSON.stringify(props.source) : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const added = [];
    const src = propsRef.current.source;
    RASTERS.forEach((kind, i) => {
      let layer = null;
      if (src?.kind === 'wms') {
        const source = new TileWMS({
          url: GEOSERVER_WMS,
          params: { LAYERS: `${GEOSERVER_WORKSPACE}:${src.project}_${WMS_SUFFIX[kind]}`, FORMAT: 'image/png', TRANSPARENT: true, VERSION: '1.1.1' },
          serverType: 'geoserver',
          transition: 0,
        });
        let reported = false;
        source.on('tileloaderror', () => {
          if (!reported) {
            reported = true;
            propsRef.current.onRasterError?.(kind);
          }
        });
        layer = new TileLayer({ source, zIndex: 1 + i });
      } else if (src?.kind === 'static' && src.images?.[kind] && src.extent4326) {
        layer = new ImageLayer({
          source: new ImageStatic({ url: src.images[kind], imageExtent: src.extent4326, projection: 'EPSG:4326', interpolate: true }),
          zIndex: 1 + i,
        });
      }
      if (layer) {
        map.addLayer(layer);
        layersRef.current[kind] = layer;
        added.push(layer);
      }
    });
    applyLayerState();
    return () => {
      added.forEach((l) => map.removeLayer(l));
      RASTERS.forEach((k) => delete layersRef.current[k]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  // ---- crown features
  useEffect(() => {
    const src = layersRef.current.crowns?.getSource();
    if (!src) return;
    src.clear(true);
    src.addFeatures(props.trees.map((t) => t.feature));
  }, [props.trees]);

  // ---- restyle on interaction state
  useEffect(() => {
    layersRef.current.crowns?.changed();
  }, [props.visibleIds, props.selectedId, props.hoverId, props.colorBy, props.heightDomain]);

  // ---- layer visibility / opacity
  function applyLayerState() {
    const L = layersRef.current;
    const s = propsRef.current.layers;
    if (!s) return;
    L.basemap?.setVisible(s.basemap);
    RASTERS.forEach((k) => {
      L[k]?.setVisible(Boolean(s[k]?.on));
      L[k]?.setOpacity(s[k]?.opacity ?? 1);
    });
    L.crowns?.setVisible(s.crowns.on);
    L.crowns?.setOpacity(s.crowns.opacity);
  }
  useEffect(applyLayerState, [props.layers]);

  // ---- fit to data when the extent changes
  const extentKey = props.extent4326?.join(',') ?? '';
  useEffect(() => {
    if (props.extent4326) fitExtent(props.extent4326, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extentKey]);

  function fitExtent(e4326, animate = true) {
    const map = mapRef.current;
    if (!map || !e4326) return;
    const size = map.getSize();
    if (!size || !size[0] || !size[1]) {
      // not laid out yet: fit once the map knows its size
      map.once('change:size', () => fitExtent(e4326, false));
      return;
    }
    // keep crowns clear of the layer panel on wide maps
    const right = size[0] >= 700 ? 290 : 40;
    map.getView().fit(transformExtent(e4326, 'EPSG:4326', 'EPSG:3857'), {
      padding: [40, right, 40, 56],
      maxZoom: 24,
      duration: animate ? 400 : 0,
    });
  }

  useImperativeHandle(ref, () => ({
    fitAll: () => fitExtent(propsRef.current.extent4326),
    zoomToTree(id) {
      const map = mapRef.current;
      const f = layersRef.current.crowns?.getSource().getFeatureById(id);
      if (!map || !f) return;
      map.getView().fit(f.getGeometry().getExtent(), { padding: [80, 80, 80, 80], maxZoom: 25, duration: 450 });
    },
    updateSize: () => mapRef.current?.updateSize(),
  }));

  return <div ref={el} className="absolute inset-0" role="application" aria-label="Map of detected tree crowns" />;
});

export default MapView;

function crownStyle(feature, p) {
  const id = feature.getId();
  if (p.visibleIds && !p.visibleIds.has(id)) return null;
  const selected = id === p.selectedId;
  const hovered = id === p.hoverId;
  let color;
  if (p.colorBy === 'height') {
    const [lo, hi] = p.heightDomain ?? [0, 1];
    const h = feature.get('Height');
    color = rampColor(hi > lo ? (Number(h) - lo) / (hi - lo) : 0.5);
  } else {
    const key = feature.get('__health') ?? healthOfFeature(feature);
    color = (HEALTH_BY_KEY[key] ?? HEALTH_BY_KEY.Unknown).color;
  }
  const styles = [
    new Style({
      fill: new Fill({ color: hexToRgba(color, selected ? 0.55 : hovered ? 0.5 : 0.35) }),
      stroke: new Stroke({ color: hexToRgba(color, 1), width: selected ? 3 : 2 }),
      zIndex: selected ? 3 : hovered ? 2 : 1,
    }),
  ];
  if (selected || hovered) {
    styles.unshift(new Style({ stroke: new Stroke({ color: 'rgba(255,255,255,0.95)', width: selected ? 6 : 4 }), zIndex: selected ? 3 : 2 }));
  }
  return styles;
}

function healthOfFeature(f) {
  const s = String(f.get('Health') ?? '').trim().toLowerCase();
  const key = s === 'healthy' ? 'Healthy' : s === 'moderately healthy' ? 'Moderately Healthy' : s === 'poor' ? 'Poor' : 'Unknown';
  f.set('__health', key, true);
  return key;
}
