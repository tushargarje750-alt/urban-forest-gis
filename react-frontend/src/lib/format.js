const nf = (digits) =>
  new Intl.NumberFormat(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function num(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return nf(digits).format(value);
}

export function compact(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  if (Math.abs(value) < 10000) return nf(0).format(value);
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function pct(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return `${nf(digits).format(value * 100)}%`;
}

export function bytes(n) {
  if (!n && n !== 0) return '–';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const f = new Intl.NumberFormat(undefined, { maximumFractionDigits: i === 0 ? 0 : 1 });
  return `${f.format(v)} ${units[i]}`;
}

export function duration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m} min ${String(r).padStart(2, '0')} s` : `${r} s`;
}

export function area(m2) {
  if (m2 === null || m2 === undefined || Number.isNaN(m2)) return '–';
  if (m2 >= 10000) return `${num(m2 / 10000, 2)} ha`;
  return `${num(m2, m2 < 100 ? 1 : 0)} m²`;
}
