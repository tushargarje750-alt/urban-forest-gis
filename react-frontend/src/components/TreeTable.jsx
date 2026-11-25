import { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { HealthBadge } from './ui.jsx';
import { HEALTH } from '../lib/trees.js';
import { num } from '../lib/format.js';

const COLS = [
  { key: 'id', label: 'Tree ID', align: 'left' },
  { key: 'health', label: 'Health', align: 'left' },
  { key: 'height', label: 'Height (m)', digits: 2 },
  { key: 'girth', label: 'Canopy girth (m)', digits: 2 },
  { key: 'crownArea', label: 'Crown area (m²)', digits: 1 },
  { key: 'mgrvi', label: 'MGRVI', digits: 2 },
];
const HEALTH_ORDER = Object.fromEntries(HEALTH.map((h, i) => [h.key, i]));
const PAGE = 25;

export default function TreeTable({ trees, selectedId, onSelect, printAll = true }) {
  const [sort, setSort] = useState({ key: 'id', dir: 1 });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const val = (t) => (sort.key === 'health' ? HEALTH_ORDER[t.health] : t[sort.key]);
    return [...trees].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va === vb) return a.id - b.id;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return va < vb ? -sort.dir : sort.dir;
    });
  }, [trees, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  useEffect(() => {
    if (page >= pages) setPage(0);
  }, [page, pages]);

  // When a tree is picked elsewhere (map, chart), show the page it is on.
  useEffect(() => {
    if (selectedId === null || selectedId === undefined) return;
    const i = rows.findIndex((t) => t.id === selectedId);
    if (i >= 0) setPage(Math.floor(i / PAGE));
  }, [selectedId, rows]);

  if (!trees.length) {
    return <p className="px-4 py-10 text-center text-sm text-ink-2">No trees match the current filters.</p>;
  }

  const head = (c) => {
    const active = sort.key === c.key;
    return (
      <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={`px-3 py-2 font-medium text-xs text-ink-2 ${c.align === 'left' ? 'text-left' : 'text-right'}`}>
        <button
          type="button"
          className={`inline-flex items-center gap-1 hover:text-ink ${active ? 'text-ink' : ''}`}
          onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : c.key === 'id' || c.key === 'health' ? 1 : -1 }))}
        >
          {c.label}
          <Icon name={sort.dir === 1 ? 'arrowLeft' : 'arrowRight'} size={10} className={`rotate-90 ${active ? '' : 'opacity-0'}`} />
        </button>
      </th>
    );
  };

  const renderRow = (t) => {
    const sel = t.id === selectedId;
    return (
      <tr
        key={t.id}
        onClick={() => onSelect(t.id)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(t.id))}
        tabIndex={0}
        aria-selected={sel}
        className={`cursor-pointer border-t border-line hover:bg-surface-2 focus:bg-surface-2 outline-none ${sel ? 'bg-accent-soft hover:bg-accent-soft' : ''}`}
      >
        {COLS.map((c) => (
          <td key={c.key} className={`px-3 py-2 text-sm tabular ${c.align === 'left' ? 'text-left' : 'text-right'} ${c.key === 'id' ? 'font-medium text-ink' : 'text-ink-2'}`}>
            {c.key === 'health' ? <HealthBadge health={t.health} size="sm" /> : c.digits !== undefined ? num(t[c.key], c.digits) : t[c.key]}
          </td>
        ))}
      </tr>
    );
  };

  const visible = rows.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <caption className="sr-only">Detected trees. Select a row to show it on the map.</caption>
          <thead>
            <tr>{COLS.map(head)}</tr>
          </thead>
          <tbody className="no-print">{visible.map(renderRow)}</tbody>
          {printAll && <tbody className="print-only">{rows.map(renderRow)}</tbody>}
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-line text-xs text-ink-2 no-print">
          <span className="tabular">
            {page * PAGE + 1}–{Math.min(rows.length, (page + 1) * PAGE)} of {rows.length}
          </span>
          <div className="flex gap-1">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="h-7 px-2 rounded-md border border-line disabled:opacity-40 hover:bg-surface-2">
              Previous
            </button>
            <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="h-7 px-2 rounded-md border border-line disabled:opacity-40 hover:bg-surface-2">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
