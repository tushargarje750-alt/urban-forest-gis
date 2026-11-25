import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView from '../components/MapView.jsx';
import TreeTable from '../components/TreeTable.jsx';
import { Histogram, Scatter, HealthBars, ChartLegend } from '../components/charts.jsx';
import { FilterBar, KpiStrip, LayerPanel, TreeDetails } from '../components/dashboard.jsx';
import { Alert, Button, Card, CardHeader, Spinner } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { Link, navigate } from '../lib/router.jsx';
import { useAuth } from '../lib/auth.jsx';
import * as api from '../lib/api.js';
import {
  EMPTY_FILTERS, HEALTH, HEALTH_BY_KEY, applyFilters, buildTrees, extentOf, filtersActive, healthFromMgrvi, histogram, summarize,
} from '../lib/trees.js';
import { exportCsv, exportGeoJson } from '../lib/export.js';
import { DEMO_ID, MGRVI_HEALTHY_FROM, MGRVI_POOR_BELOW } from '../config.js';

const DEFAULT_LAYERS = {
  basemap: true,
  ortho: { on: true, opacity: 1 },
  height: { on: false, opacity: 0.85 },
  health: { on: false, opacity: 0.85 },
  crowns: { on: true, opacity: 0.9 },
};

export default function Results({ projectId }) {
  const isDemo = projectId === DEMO_ID;
  const { user, backend } = useAuth();
  const [load, setLoad] = useState({ state: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  const needsSignIn = !isDemo && !user;
  useEffect(() => {
    if (needsSignIn) return undefined;
    let cancelled = false;
    setLoad({ state: 'loading' });
    (async () => {
      try {
        if (isDemo) {
          const demo = await api.getDemo();
          if (!cancelled) setLoad({ state: 'ready', fc: demo.trees, meta: demo.meta, images: demo.images });
        } else {
          const fc = await api.getTrees(projectId);
          if (!cancelled) setLoad({ state: 'ready', fc });
        }
      } catch (err) {
        if (!cancelled) setLoad({ state: 'error', message: err.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, isDemo, reloadKey, needsSignIn]);

  if (needsSignIn) {
    return (
      <Centered>
        <Alert level="info" title="Sign in to view project results">
          <p className="mt-1">
            Project results come from the analysis server. <Link to={`/login?next=/results/${encodeURIComponent(projectId)}`} className="text-accent font-medium">Sign in</Link> or{' '}
            <Link to={`/results/${DEMO_ID}`} className="text-accent font-medium">open the demo</Link>.
          </p>
        </Alert>
      </Centered>
    );
  }
  if (load.state === 'loading') {
    return (
      <Centered>
        <div className="flex items-center gap-3 text-ink-2">
          <Spinner size={20} /> Loading {isDemo ? 'the demo project' : `“${projectId}”`}…
        </div>
      </Centered>
    );
  }
  if (load.state === 'error') {
    return (
      <Centered>
        <Alert
          level="error"
          title="Couldn't load the results"
          action={
            <Button size="sm" icon="refresh" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </Button>
          }
        >
          <p className="mt-1">{load.message}</p>
          {backend === 'offline' && !isDemo && (
            <p className="mt-1">
              Meanwhile you can <Link to={`/results/${DEMO_ID}`} className="text-accent font-medium">explore the demo project</Link>.
            </p>
          )}
        </Alert>
      </Centered>
    );
  }
  return <Dashboard key={projectId} projectId={projectId} isDemo={isDemo} data={load} />;
}

function Centered({ children }) {
  return <div className="max-w-xl mx-auto px-4 py-24">{children}</div>;
}

function Dashboard({ projectId, isDemo, data }) {
  const mapRef = useRef(null);
  const { trees, extent4326 } = useMemo(() => buildTrees(data.fc), [data.fc]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [colorBy, setColorBy] = useState('health');
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [rasterErrors, setRasterErrors] = useState({});

  const filtered = useMemo(() => applyFilters(trees, filters), [trees, filters]);
  const visibleIds = useMemo(() => new Set(filtered.map((t) => t.id)), [filtered]);
  const stats = useMemo(() => summarize(filtered, extent4326), [filtered, extent4326]);
  const allStats = useMemo(() => summarize(trees, extent4326), [trees, extent4326]);
  const heightDomain = useMemo(() => extentOf(trees.map((t) => t.height)) ?? [0, 1], [trees]);
  const selected = selectedId !== null ? trees.find((t) => t.id === selectedId) : null;
  const active = filtersActive(filters);
  const label = isDemo ? 'Demo project' : projectId;

  useEffect(() => {
    if (selectedId !== null && !visibleIds.has(selectedId)) setSelectedId(null);
  }, [visibleIds, selectedId]);

  const source = useMemo(
    () =>
      isDemo
        ? { kind: 'static', images: data.images, extent4326: data.meta?.imageExtent }
        : { kind: 'wms', project: projectId },
    [isDemo, data, projectId],
  );

  const selectAndZoom = useCallback((id) => {
    setSelectedId(id);
    requestAnimationFrame(() => mapRef.current?.zoomToTree(id));
  }, []);

  const step = (dir) => {
    if (!filtered.length) return;
    const i = filtered.findIndex((t) => t.id === selectedId);
    const next = filtered[(i + dir + filtered.length) % filtered.length];
    selectAndZoom(next.id);
  };

  const toggleHealth = (key) =>
    setFilters((f) => ({ ...f, health: f.health.includes(key) ? f.health.filter((h) => h !== key) : [...f.health, key] }));

  const heightBins = useMemo(() => histogram(filtered.map((t) => t.height)), [filtered]);
  const girthBins = useMemo(() => histogram(filtered.map((t) => t.girth)), [filtered]);
  const mgrviBins = useMemo(() => histogram(filtered.map((t) => t.mgrvi), { step: 0.05 }), [filtered]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="print-only mb-2">
        <h1 className="text-2xl font-semibold">Tree analysis report: {label}</h1>
        <p className="text-sm">Generated {new Date().toLocaleString()} {active ? '· filters applied' : ''}</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div className="min-w-0">
          <Link to="/projects" className="text-xs text-ink-2 hover:text-ink inline-flex items-center gap-1">
            <Icon name="arrowLeft" size={12} /> All projects
          </Link>
          <h1 className="text-2xl font-semibold text-ink mt-1 flex items-center gap-2 flex-wrap">
            {label}
            {isDemo && <span className="text-xs font-medium rounded-full bg-accent-soft text-accent px-2 py-0.5">Sample data</span>}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon="download" onClick={() => exportCsv(isDemo ? 'demo' : projectId, filtered)} disabled={!filtered.length}>
            CSV
          </Button>
          <Button size="sm" icon="download" onClick={() => exportGeoJson(isDemo ? 'demo' : projectId, filtered, extent4326)} disabled={!filtered.length}>
            GeoJSON
          </Button>
          <Button size="sm" icon="printer" onClick={() => window.print()}>
            Print report
          </Button>
        </div>
      </div>

      {isDemo && (
        <Alert level="info" className="no-print">
          This demo uses the sample site “{data.meta?.project}” bundled with the app. Its tree outlines and measurements were recomputed
          by a JavaScript port of the pipeline's later steps, from the backend's own CHM, orthophoto and YOLO detections for this site, so
          values can differ slightly from the Python backend.
        </Alert>
      )}
      {!trees.length && (
        <Alert level="warning" title="No trees in this project">
          The backend returned no tree crowns. Processing may have failed or found nothing; check the Flask console log.
        </Alert>
      )}

      <KpiStrip stats={stats} totalCount={trees.length} filtered={active} />

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        stats={allStats}
        shown={filtered.length}
        total={trees.length}
        active={active}
        onReset={() => setFilters(EMPTY_FILTERS)}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="relative overflow-hidden h-[420px] sm:h-[520px] lg:h-[600px] print-avoid">
          <MapView
            ref={mapRef}
            trees={trees}
            visibleIds={visibleIds}
            selectedId={selectedId}
            hoverId={hoverId}
            onSelect={setSelectedId}
            onHover={setHoverId}
            colorBy={colorBy}
            heightDomain={heightDomain}
            layers={layers}
            source={source}
            extent4326={extent4326}
            onRasterError={(kind) => setRasterErrors((e) => ({ ...e, [kind]: true }))}
          />
          <button
            type="button"
            onClick={() => mapRef.current?.fitAll()}
            className="absolute left-3 top-[84px] z-10 w-8 h-8 inline-flex items-center justify-center rounded-lg bg-surface border border-line text-ink hover:bg-surface-2 shadow-card no-print"
            title="Fit all trees"
            aria-label="Fit all trees"
          >
            <Icon name="expand" size={14} />
          </button>
          <LayerPanel
            layers={layers}
            setLayers={setLayers}
            colorBy={colorBy}
            setColorBy={setColorBy}
            heightDomain={heightDomain}
            heightRange={data.meta?.heightRange}
            rasterErrors={rasterErrors}
          />
          {Object.keys(rasterErrors).length > 0 && (
            <div className="absolute left-3 right-14 bottom-10 sm:right-auto sm:max-w-md z-10 no-print">
              <Alert level="warning">Some map layers couldn't be loaded from GeoServer. Tree crowns and all numbers still work.</Alert>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {selected ? (
            <TreeDetails tree={selected} trees={filtered} onClose={() => setSelectedId(null)} onZoom={() => mapRef.current?.zoomToTree(selected.id)} onStep={step} />
          ) : (
            <Card className="p-4 no-print">
              <div className="flex gap-3 text-sm text-ink-2">
                <Icon name="crosshair" size={18} className="text-accent mt-0.5" />
                <p>Click a crown on the map, a dot in the scatter plot or a row in the table to see that tree's details.</p>
              </div>
            </Card>
          )}
          <Card className="print-avoid">
            <CardHeader title="Health breakdown" subtitle="Click a class to filter" />
            <div className="p-4 pt-3">
              <HealthBars counts={stats.health} total={stats.count} active={filters.health} onToggle={toggleHealth} />
              <p className="text-xs text-muted mt-3">
                From mean crown MGRVI: below {MGRVI_POOR_BELOW} poor, {MGRVI_POOR_BELOW}–{MGRVI_HEALTHY_FROM} moderately healthy, {MGRVI_HEALTHY_FROM}+ healthy.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="print-avoid">
          <CardHeader title="Height distribution" subtitle="Tallest point of each crown, metres" />
          <div className="p-4 pt-2">
            <Histogram bins={heightBins} total={filtered.length} unit="m" ariaLabel="Histogram of tree heights" />
          </div>
        </Card>
        <Card className="print-avoid">
          <CardHeader title="Canopy girth distribution" subtitle="Longest distance across each crown, metres" />
          <div className="p-4 pt-2">
            <Histogram bins={girthBins} total={filtered.length} unit="m" ariaLabel="Histogram of canopy girth" />
          </div>
        </Card>
        <Card className="print-avoid">
          <CardHeader title="Vegetation index (MGRVI)" subtitle="Mean per crown; dashed lines are the health class limits" actions={<ChartLegend items={HEALTH.slice(0, 3).map((h) => ({ label: h.label, color: h.color }))} />} />
          <div className="p-4 pt-2">
            <Histogram
              bins={mgrviBins}
              total={filtered.length}
              digits={2}
              colorFor={(b) => HEALTH_BY_KEY[healthFromMgrvi((b.x0 + b.x1) / 2)].color}
              markers={[
                { x: MGRVI_POOR_BELOW, label: String(MGRVI_POOR_BELOW) },
                { x: MGRVI_HEALTHY_FROM, label: String(MGRVI_HEALTHY_FROM) },
              ]}
              ariaLabel="Histogram of MGRVI values"
            />
          </div>
        </Card>
        <Card className="print-avoid">
          <CardHeader title="Height vs canopy girth" subtitle="One dot per tree; click to select" actions={<ChartLegend items={HEALTH.slice(0, 3).map((h) => ({ label: h.label, color: h.color }))} />} />
          <div className="p-4 pt-2">
            <Scatter trees={filtered} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </Card>
      </div>

      <Card className="print-break">
        <CardHeader title="All trees" subtitle={`${filtered.length} ${filtered.length === 1 ? 'tree' : 'trees'} · select a row to zoom to it`} />
        <div className="mt-2">
          <TreeTable trees={filtered} selectedId={selectedId} onSelect={selectAndZoom} />
        </div>
      </Card>
      {!isDemo && (
        <p className="text-xs text-muted no-print">
          Not the project you wanted?{' '}
          <button type="button" className="text-accent" onClick={() => navigate('/projects')}>
            Pick another
          </button>
          .
        </p>
      )}
    </div>
  );
}
