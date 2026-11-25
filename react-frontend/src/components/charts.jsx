import { useMemo, useState } from 'react';
import { useWidth } from './ui.jsx';
import { Icon } from './icons.jsx';
import { HEALTH, HEALTH_BY_KEY } from '../lib/trees.js';
import { num, pct } from '../lib/format.js';

const M = { top: 14, right: 12, bottom: 30, left: 36 };
const FONT = 11;

function niceTicks(max, target = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const s = Math.max(1, step); // counts are integers
  const ticks = [];
  for (let v = 0; v <= max + 1e-9; v += s) ticks.push(v);
  if (ticks.at(-1) < max) ticks.push(ticks.at(-1) + s);
  return ticks;
}

/** Column with 4px rounded top, square at the baseline. */
function columnPath(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function Tooltip({ x, y, width, children }) {
  if (x === null || x === undefined) return null;
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div
      className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full rounded-lg bg-surface border border-line shadow-pop px-2.5 py-1.5 text-xs text-ink whitespace-nowrap"
      style={{ left, top: y - 8 }}
      role="status"
    >
      {children}
    </div>
  );
}

export function ChartLegend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: it.color }} aria-hidden="true" />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Histogram. bins: [{x0, x1, count}]. colorFor(bin) -> hex (default series-1).
 * markers: [{x, label}] vertical reference lines.
 */
export function Histogram({ bins, total, unit = '', digits = 1, height = 190, colorFor, markers = [], ariaLabel }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const maxCount = Math.max(1, ...bins.map((b) => b.count));
  const ticks = niceTicks(maxCount);
  const yMax = ticks.at(-1);
  const lo = bins[0]?.x0 ?? 0;
  const hi = bins.at(-1)?.x1 ?? 1;
  const sx = (v) => M.left + ((v - lo) / (hi - lo || 1)) * innerW;
  const sy = (v) => M.top + innerH - (v / yMax) * innerH;
  const band = bins.length ? innerW / bins.length : 0;
  const barW = Math.max(2, Math.min(24, band - 2));
  const peak = bins.reduce((best, b, i) => (b.count > (bins[best]?.count ?? -1) ? i : best), 0);
  const labelEvery = Math.ceil((bins.length + 1) / Math.max(1, Math.floor(innerW / 44)));

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="absolute inset-0">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'} strokeWidth="1" shapeRendering="crispEdges" />
              <text x={M.left - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={FONT} fill="var(--chart-muted)" className="tabular">
                {t}
              </text>
            </g>
          ))}
          {bins.map((b, i) => {
            const cx = M.left + band * i + band / 2;
            const h = innerH - (sy(b.count) - M.top);
            return (
              <path
                key={i}
                d={columnPath(cx - barW / 2, sy(b.count), barW, h)}
                fill={colorFor ? colorFor(b) : 'var(--series-1)'}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
            );
          })}
          {bins[peak]?.count > 0 && (
            <text
              x={M.left + band * peak + band / 2}
              y={sy(bins[peak].count) - 5}
              textAnchor="middle"
              fontSize={FONT}
              fill="var(--chart-text)"
              className="tabular"
            >
              {bins[peak].count}
            </text>
          )}
          {markers.filter((m) => m.x >= lo && m.x <= hi).map((m) => (
            <g key={m.label}>
              <line x1={sx(m.x)} x2={sx(m.x)} y1={M.top} y2={M.top + innerH} stroke="var(--chart-text)" strokeWidth="1" strokeDasharray="3 3" />
              <text x={sx(m.x) + 4} y={M.top + 2} dy="0.7em" fontSize={10} fill="var(--chart-text)">
                {m.label}
              </text>
            </g>
          ))}
          {bins.map((b, i) =>
            i % labelEvery === 0 ? (
              <text key={`t${i}`} x={M.left + band * i} y={height - M.bottom + 16} textAnchor="middle" fontSize={FONT} fill="var(--chart-muted)" className="tabular">
                {num(b.x0, digits)}
              </text>
            ) : null,
          )}
          {bins.length % labelEvery === 0 && (
            <text x={M.left + innerW} y={height - M.bottom + 16} textAnchor="middle" fontSize={FONT} fill="var(--chart-muted)" className="tabular">
              {num(hi, digits)}
            </text>
          )}
          {bins.map((b, i) => (
            <rect
              key={`h${i}`}
              x={M.left + band * i}
              y={M.top}
              width={band}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
      )}
      {hover !== null && bins[hover] && (
        <Tooltip x={M.left + band * hover + band / 2} y={sy(bins[hover].count)} width={width}>
          <span className="font-medium tabular">
            {num(bins[hover].x0, digits)}–{num(bins[hover].x1, digits)} {unit}
          </span>
          <span className="text-ink-2"> · {bins[hover].count} {bins[hover].count === 1 ? 'tree' : 'trees'}</span>
          {total ? <span className="text-muted"> ({pct(bins[hover].count / total)})</span> : null}
        </Tooltip>
      )}
    </div>
  );
}

/** Height vs canopy girth, one dot per tree, coloured by health. */
export function Scatter({ trees, selectedId, onSelect, height = 240 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pts = useMemo(() => trees.filter((t) => Number.isFinite(t.girth) && Number.isFinite(t.height)), [trees]);
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom - 6;
  const xMax = Math.max(1, ...pts.map((t) => t.girth)) * 1.05;
  const yMax = Math.max(1, ...pts.map((t) => t.height)) * 1.05;
  const xt = niceTicks(xMax, Math.max(2, Math.floor(innerW / 70)));
  const yt = niceTicks(yMax);
  const sx = (v) => M.left + (v / xt.at(-1)) * innerW;
  const sy = (v) => M.top + innerH - (v / yt.at(-1)) * innerH;

  function nearest(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let best = null;
    let bd = 18 * 18;
    for (const t of pts) {
      const d = (sx(t.girth) - mx) ** 2 + (sy(t.height) - my) ** 2;
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  const hovered = hover !== null ? pts.find((t) => t.id === hover) : null;
  const ordered = [...pts].sort((a, b) => (a.id === selectedId) - (b.id === selectedId));

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Scatter plot of tree height against canopy girth"
          onMouseMove={(e) => setHover(nearest(e)?.id ?? null)}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const t = nearest(e);
            if (t) onSelect?.(t.id);
          }}
          className={`absolute inset-0 ${hover !== null ? 'cursor-pointer' : ''}`}
        >
          {yt.map((t) => (
            <g key={`y${t}`}>
              <line x1={M.left} x2={width - M.right} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'} strokeWidth="1" shapeRendering="crispEdges" />
              <text x={M.left - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={FONT} fill="var(--chart-muted)" className="tabular">
                {t}
              </text>
            </g>
          ))}
          {xt.map((t) => (
            <text key={`x${t}`} x={sx(t)} y={M.top + innerH + 16} textAnchor="middle" fontSize={FONT} fill="var(--chart-muted)" className="tabular">
              {t}
            </text>
          ))}
          <text x={width - M.right} y={height - 2} textAnchor="end" fontSize={FONT} fill="var(--chart-text)">
            Canopy girth (m) →
          </text>
          <text x={4} y={M.top - 4} fontSize={FONT} fill="var(--chart-text)">
            Height (m)
          </text>
          {ordered.map((t) => {
            const sel = t.id === selectedId;
            const hov = t.id === hover;
            return (
              <circle
                key={t.id}
                cx={sx(t.girth)}
                cy={sy(t.height)}
                r={sel ? 7 : hov ? 6 : 4.5}
                fill={(HEALTH_BY_KEY[t.health] ?? HEALTH_BY_KEY.Unknown).color}
                stroke={sel ? 'var(--chart-text)' : 'var(--chart-surface)'}
                strokeWidth={2}
              />
            );
          })}
        </svg>
      )}
      {hovered && (
        <Tooltip x={sx(hovered.girth)} y={sy(hovered.height)} width={width}>
          <span className="font-medium">Tree {hovered.id}</span>
          <span className="text-ink-2"> · {HEALTH_BY_KEY[hovered.health]?.label}</span>
          <br />
          <span className="text-ink-2 tabular">
            {num(hovered.height, 2)} m tall · {num(hovered.girth, 2)} m girth
          </span>
        </Tooltip>
      )}
    </div>
  );
}

/** Horizontal bars, one per health class, value at the bar tip. */
export function HealthBars({ counts, total, active = [], onToggle }) {
  const rows = HEALTH.filter((h) => h.key !== 'Unknown' || counts.Unknown > 0);
  const max = Math.max(1, ...rows.map((h) => counts[h.key] ?? 0));
  return (
    <ul className="space-y-2.5">
      {rows.map((h) => {
        const c = counts[h.key] ?? 0;
        const on = !active.length || active.includes(h.key);
        return (
          <li key={h.key}>
            <button
              type="button"
              onClick={() => onToggle?.(h.key)}
              className={`w-full text-left group rounded-md -mx-1 px-1 py-0.5 hover:bg-surface-2 ${on ? '' : 'opacity-45'}`}
              aria-pressed={active.includes(h.key)}
              title={`Show only ${h.label.toLowerCase()} trees`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="inline-flex items-center gap-1.5 text-ink">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full" style={{ background: h.color, color: h.text }}>
                    <Icon name={h.icon} size={10} strokeWidth={3} />
                  </span>
                  {h.label}
                </span>
                <span className="tabular text-ink-2">
                  <span className="font-semibold text-ink">{c}</span> · {total ? pct(c / total) : '–'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(c / max) * 100}%`, background: h.color }} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
