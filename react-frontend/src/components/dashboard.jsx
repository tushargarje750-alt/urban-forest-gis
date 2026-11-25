import { useState } from 'react';
import { Icon } from './icons.jsx';
import { Button, Card, HealthBadge, InfoTip, Segmented, inputCls } from './ui.jsx';
import { HEALTH, HEALTH_BY_KEY, HEIGHT_RAMP } from '../lib/trees.js';
import { area, num, pct } from '../lib/format.js';
import { MGRVI_HEALTHY_FROM, MGRVI_POOR_BELOW } from '../config.js';

/* ---------------- KPI strip ---------------- */

function Stat({ label, value, unit, sub, tip, hero = false }) {
  return (
    <div className="bg-surface border border-line rounded-xl px-4 py-3 shadow-card min-w-0 print-avoid">
      <div className="flex items-center gap-1 text-xs text-ink-2">
        <span className="truncate">{label}</span>
        {tip && <InfoTip text={tip} />}
      </div>
      <div className={`mt-1 font-semibold text-ink leading-none ${hero ? 'text-5xl' : 'text-2xl'}`}>
        {value}
        {unit && <span className="text-sm font-medium text-ink-2 ml-1">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-xs text-muted truncate">{sub}</div>}
    </div>
  );
}

export function KpiStrip({ stats, totalCount, filtered }) {
  const s = stats;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <Stat hero label="Trees detected" value={s.count} sub={filtered ? `of ${totalCount} before filters` : 'YOLOv8 + region growing'} />
      <Stat label="Mean height" value={num(s.meanHeight, 1)} unit="m" sub={s.heightRange ? `Tallest ${num(s.heightRange[1], 1)} m · median ${num(s.medianHeight, 1)} m` : null} />
      <Stat
        label="Mean canopy girth"
        value={num(s.meanGirth, 1)}
        unit="m"
        tip="The longest distance across each tree's crown outline, as computed by the backend. It describes the canopy, not the trunk."
        sub={s.girthRange ? `Range ${num(s.girthRange[0], 1)}–${num(s.girthRange[1], 1)} m` : null}
      />
      <Stat
        label="Healthy"
        value={pct(s.healthyShare)}
        sub={`${s.health['Moderately Healthy']} moderate · ${s.health.Poor} poor`}
        tip={`Health comes from each crown's mean MGRVI: below ${MGRVI_POOR_BELOW} is poor, ${MGRVI_POOR_BELOW}–${MGRVI_HEALTHY_FROM} moderately healthy, ${MGRVI_HEALTHY_FROM} and above healthy.`}
      />
      <Stat
        label="Canopy cover"
        value={pct(s.canopyCover, 0)}
        sub={`${area(s.crownArea)} of crowns`}
        tip="Total crown area divided by the area of the box around all detected trees. Calculated in the browser from the crown outlines."
      />
      <Stat
        label="Tree density"
        value={num(s.densityPerHa, 0)}
        unit="/ha"
        sub={s.extentArea ? `Over ${area(s.extentArea)}` : null}
        tip="Trees per hectare within the box around all detected trees (not the full image)."
      />
    </div>
  );
}

/* ---------------- filter bar ---------------- */

function RangeInputs({ label, min, max, onMin, onMax, placeholder }) {
  return (
    <fieldset className="flex items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      <span className="text-xs font-medium text-ink-2 mr-1">{label}</span>
      <input type="number" inputMode="decimal" step="0.1" value={min} onChange={(e) => onMin(e.target.value)} placeholder={placeholder?.[0]} aria-label={`${label} minimum`} className={`${inputCls} !h-8 !w-20 !px-2`} />
      <span className="text-muted text-xs">–</span>
      <input type="number" inputMode="decimal" step="0.1" value={max} onChange={(e) => onMax(e.target.value)} placeholder={placeholder?.[1]} aria-label={`${label} maximum`} className={`${inputCls} !h-8 !w-20 !px-2`} />
      <span className="text-xs text-muted">m</span>
    </fieldset>
  );
}

export function FilterBar({ filters, setFilters, stats, shown, total, onReset, active }) {
  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));
  const toggleHealth = (key) =>
    setFilters((f) => ({ ...f, health: f.health.includes(key) ? f.health.filter((h) => h !== key) : [...f.health, key] }));
  const hr = stats.heightRange;
  const gr = stats.girthRange;
  return (
    <Card className="px-4 py-3 no-print">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon name="sliders" size={16} /> Filters
        </span>
        <RangeInputs label="Height" min={filters.minHeight} max={filters.maxHeight} onMin={set('minHeight')} onMax={set('maxHeight')} placeholder={hr ? [num(hr[0], 1), num(hr[1], 1)] : null} />
        <RangeInputs label="Girth" min={filters.minGirth} max={filters.maxGirth} onMin={set('minGirth')} onMax={set('maxGirth')} placeholder={gr ? [num(gr[0], 1), num(gr[1], 1)] : null} />
        <div className="flex items-center gap-1.5" role="group" aria-label="Health">
          <span className="text-xs font-medium text-ink-2 mr-1">Health</span>
          {HEALTH.filter((h) => h.key !== 'Unknown' || stats.health.Unknown).map((h) => {
            const on = filters.health.includes(h.key);
            return (
              <button
                key={h.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleHealth(h.key)}
                className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border text-xs font-medium transition-colors ${on ? 'border-ink/40 bg-surface-2 text-ink' : 'border-line text-ink-2 hover:bg-surface-2'}`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: h.color }} aria-hidden="true" />
                {h.label}
                {on && <Icon name="check" size={12} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
        <label className="relative flex items-center">
          <span className="sr-only">Find tree by ID</span>
          <Icon name="search" size={14} className="absolute left-2.5 text-muted" />
          <input value={filters.query} onChange={(e) => set('query')(e.target.value)} placeholder="Tree ID(s)" className={`${inputCls} !h-8 !w-32 !pl-8`} />
        </label>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs text-ink-2 tabular" aria-live="polite">
            Showing <span className="font-semibold text-ink">{shown}</span> of {total}
          </span>
          {active && (
            <Button size="sm" variant="ghost" icon="x" onClick={onReset}>
              Reset
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ---------------- layer panel & legends ---------------- */

const INFERNO = 'linear-gradient(90deg,#000004,#420a68,#932667,#dd513a,#fca50a,#fcffa4)';
const RDYLGN = 'linear-gradient(90deg,#a50026,#f46d43,#fee08b,#d9ef8b,#66bd63,#006837)';
const BLUES = `linear-gradient(90deg,${HEIGHT_RAMP.join(',')})`;

function GradientLegend({ gradient, left, right }) {
  return (
    <div className="mt-1.5">
      <div className="h-2 rounded-full" style={{ background: gradient }} />
      <div className="flex justify-between text-[10px] text-muted mt-0.5 tabular">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function LayerRow({ label, state, onChange, children, disabled, note }) {
  return (
    <div className={`py-2 border-t border-line first:border-t-0 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        <input
          id={`layer-${label}`}
          type="checkbox"
          checked={state.on}
          disabled={disabled}
          onChange={(e) => onChange({ ...state, on: e.target.checked })}
          className="w-4 h-4 accent-[rgb(var(--accent))]"
        />
        <label htmlFor={`layer-${label}`} className="text-xs font-medium text-ink flex-1">
          {label}
        </label>
        {state.opacity !== undefined && (
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={state.opacity}
            disabled={disabled || !state.on}
            onChange={(e) => onChange({ ...state, opacity: Number(e.target.value) })}
            aria-label={`${label} opacity`}
            className="w-20 accent-[rgb(var(--accent))]"
          />
        )}
      </div>
      {note && <p className="text-[10px] text-muted mt-1 ml-6">{note}</p>}
      {state.on && children && <div className="ml-6">{children}</div>}
    </div>
  );
}

export function LayerPanel({ layers, setLayers, colorBy, setColorBy, heightDomain, heightRange, rasterErrors }) {
  const [open, setOpen] = useState(() => window.innerWidth >= 1100);
  const set = (k) => (v) => setLayers((l) => ({ ...l, [k]: v }));
  return (
    <div className="absolute top-3 right-3 z-10 w-64 max-w-[calc(100%-4.5rem)] no-print">
      <div className="bg-surface/95 backdrop-blur border border-line rounded-xl shadow-pop">
        <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-3 h-10 text-sm font-semibold text-ink" aria-expanded={open}>
          <span className="inline-flex items-center gap-2">
            <Icon name="layers" size={16} /> Layers
          </span>
          <Icon name={open ? 'minus' : 'expand'} size={14} className="text-muted" />
        </button>
        {open && (
          <div className="px-3 pb-2 max-h-[440px] overflow-auto">
            <LayerRow label="Tree crowns" state={layers.crowns} onChange={set('crowns')}>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-muted">Colour by</span>
                <Segmented
                  label="Colour crowns by"
                  value={colorBy}
                  onChange={setColorBy}
                  options={[
                    { value: 'health', label: 'Health' },
                    { value: 'height', label: 'Height' },
                  ]}
                />
              </div>
              {colorBy === 'health' ? (
                <ul className="mt-2 grid grid-cols-1 gap-1">
                  {HEALTH.filter((h) => h.key !== 'Unknown').map((h) => (
                    <li key={h.key} className="flex items-center gap-1.5 text-[11px] text-ink-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: h.color }} /> {h.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <GradientLegend gradient={BLUES} left={`${num(heightDomain?.[0], 1)} m`} right={`${num(heightDomain?.[1], 1)} m`} />
              )}
            </LayerRow>
            <LayerRow label="Orthophoto" state={layers.ortho} onChange={set('ortho')} note={rasterErrors.ortho ? 'Could not load from GeoServer' : null} />
            <LayerRow label="Height map (CHM)" state={layers.height} onChange={set('height')} note={rasterErrors.height ? 'Could not load from GeoServer' : null}>
              <GradientLegend gradient={INFERNO} left={heightRange ? `${num(heightRange[0], 1)} m` : 'Low'} right={heightRange ? `${num(heightRange[1], 1)} m` : 'High'} />
            </LayerRow>
            <LayerRow label="Health map (MGRVI)" state={layers.health} onChange={set('health')} note={rasterErrors.health ? 'Could not load from GeoServer' : null}>
              <GradientLegend gradient={RDYLGN} left="Lower MGRVI" right="Higher" />
              <p className="text-[10px] text-muted">Colours are stretched to this image's own range.</p>
            </LayerRow>
            <LayerRow label="Street basemap" state={{ on: layers.basemap }} onChange={(s) => setLayers((l) => ({ ...l, basemap: s.on }))} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- tree details ---------------- */

export function MgrviScale({ value }) {
  const pos = (v) => ((Math.max(-1, Math.min(1, v)) + 1) / 2) * 100;
  const zones = [
    { from: -1, to: MGRVI_POOR_BELOW, key: 'Poor' },
    { from: MGRVI_POOR_BELOW, to: MGRVI_HEALTHY_FROM, key: 'Moderately Healthy' },
    { from: MGRVI_HEALTHY_FROM, to: 1, key: 'Healthy' },
  ];
  const ticks = [-1, 0, 0.25, 1];
  return (
    <div className="pt-6" role="img" aria-label={`MGRVI ${num(value, 2)} on a scale from -1 to 1`}>
      <div className="relative">
        <div className="h-2.5 flex rounded-full overflow-hidden gap-[2px] bg-surface">
          {zones.map((z) => (
            <div key={z.key} style={{ width: `${pos(z.to) - pos(z.from)}%`, background: HEALTH_BY_KEY[z.key].color, opacity: 0.35 }} />
          ))}
        </div>
        {Number.isFinite(value) && (
          <div className="absolute -top-5 -translate-x-1/2 flex flex-col items-center" style={{ left: `${pos(value)}%` }}>
            <span className="text-[10px] font-semibold text-ink tabular leading-3 mb-0.5">{num(value, 2)}</span>
            <span className="w-0.5 h-4 bg-ink rounded-full" />
          </div>
        )}
      </div>
      <div className="relative h-4 mt-1.5 text-[10px] text-muted tabular">
        {ticks.map((t, i) => (
          <span
            key={t}
            className={`absolute ${i === 0 ? '' : i === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`}
            style={{ left: `${pos(t)}%` }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function Row({ label, tip, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-t border-line first:border-t-0">
      <dt className="text-xs text-ink-2 inline-flex items-center gap-1">
        {label}
        {tip && <InfoTip text={tip} />}
      </dt>
      <dd className="text-sm font-semibold text-ink tabular text-right">{children}</dd>
    </div>
  );
}

export function TreeDetails({ tree, trees, onClose, onZoom, onStep }) {
  const [copied, setCopied] = useState(false);
  const rank = (key) => {
    const vals = trees.map((t) => t[key]).filter(Number.isFinite);
    if (!vals.length || !Number.isFinite(tree[key])) return null;
    return vals.filter((v) => v < tree[key]).length / vals.length;
  };
  const hr = rank('height');
  const coords = tree.lonLat ? `${tree.lonLat[1].toFixed(7)}, ${tree.lonLat[0].toFixed(7)}` : null;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted">Selected tree</p>
          <h3 className="text-xl font-semibold text-ink">Tree {tree.id}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" aria-label="Previous tree" onClick={() => onStep(-1)} className="!px-2">
            <Icon name="arrowLeft" size={14} />
          </Button>
          <Button size="sm" variant="ghost" aria-label="Next tree" onClick={() => onStep(1)} className="!px-2">
            <Icon name="arrowRight" size={14} />
          </Button>
          <Button size="sm" variant="ghost" aria-label="Close tree details" onClick={onClose} className="!px-2">
            <Icon name="x" size={14} />
          </Button>
        </div>
      </div>
      <div className="mt-2">
        <HealthBadge health={tree.health} />
      </div>
      <dl className="mt-3">
        <Row label="Height">{num(tree.height, 2)} m</Row>
        <Row label="Canopy girth" tip="Longest distance across the crown outline (backend 'Girth').">
          {num(tree.girth, 2)} m
        </Row>
        <Row label="Crown area" tip="Area of the crown outline, calculated in the browser.">
          {area(tree.crownArea)}
        </Row>
        <Row label="Mean MGRVI" tip="Modified Green Red Vegetation Index: (G² − R²) / (G² + R²), averaged over the crown.">
          {num(tree.mgrvi, 2)}
        </Row>
      </dl>
      <MgrviScale value={tree.mgrvi} />
      {hr !== null && <p className="text-xs text-ink-2 mt-2">Taller than {pct(hr)} of the trees shown.</p>}
      {coords && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
          <span className="text-xs text-ink-2 tabular truncate" title="Latitude, longitude (WGS84)">
            {coords}
          </span>
          <button
            type="button"
            className="text-xs text-accent font-medium inline-flex items-center gap-1"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(coords);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                // clipboard blocked; the text stays selectable
              }
            }}
          >
            <Icon name={copied ? 'check' : 'copy'} size={12} />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      <Button className="w-full mt-3" icon="crosshair" onClick={onZoom}>
        Zoom to tree
      </Button>
    </Card>
  );
}
