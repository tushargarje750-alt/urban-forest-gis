import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { HEALTH_BY_KEY } from '../lib/trees.js';

const VARIANTS = {
  primary: 'bg-accent text-accent-ink hover:bg-accent/90 border border-transparent',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2 border border-transparent',
  danger: 'bg-surface text-bad-ink border border-line hover:bg-bad/10',
};

export function Button({ variant = 'secondary', size = 'md', icon, iconRight, className = '', children, as, ...props }) {
  const Tag = as ?? (props.href ? 'a' : 'button');
  const sizes = size === 'sm' ? 'h-8 px-3 text-sm gap-1.5' : size === 'lg' ? 'h-11 px-5 text-base gap-2' : 'h-9 px-4 text-sm gap-2';
  return (
    <Tag
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap ${sizes} ${VARIANTS[variant]} ${className}`}
      {...(Tag === 'button' && !props.type ? { type: 'button' } : {})}
      {...props}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 18 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'lg' ? 18 : 16} />}
    </Tag>
  );
}

export function Card({ className = '', children, ...props }) {
  return (
    <section className={`bg-surface border border-line rounded-xl shadow-card ${className}`} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-3 px-4 pt-4 ${className}`}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

const ALERT = {
  error: { icon: 'alert', cls: 'border-bad/30 bg-bad/5', iconCls: 'text-bad-ink' },
  warning: { icon: 'alert', cls: 'border-warn/50 bg-warn/10', iconCls: 'text-ink' },
  info: { icon: 'info', cls: 'border-line bg-surface-2', iconCls: 'text-ink-2' },
  success: { icon: 'check', cls: 'border-good/30 bg-good/5', iconCls: 'text-good-ink' },
};

export function Alert({ level = 'info', title, children, action, className = '' }) {
  const a = ALERT[level];
  return (
    <div className={`flex gap-3 rounded-lg border px-3 py-2.5 text-sm ${a.cls} ${className}`} role={level === 'error' ? 'alert' : 'status'}>
      <Icon name={a.icon} size={16} className={`mt-0.5 ${a.iconCls}`} />
      <div className="min-w-0 flex-1 text-ink-2">
        {title && <p className="font-medium text-ink">{title}</p>}
        {children}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function HealthBadge({ health, size = 'md' }) {
  const h = HEALTH_BY_KEY[health] ?? HEALTH_BY_KEY.Unknown;
  const s = size === 'sm' ? 'text-xs px-1.5 py-0.5 gap-1' : 'text-xs px-2 py-1 gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${s}`} style={{ background: h.color, color: h.text }}>
      <Icon name={h.icon} size={12} strokeWidth={2.5} />
      {h.label}
    </span>
  );
}

export function HealthDot({ health, size = 10 }) {
  const h = HEALTH_BY_KEY[health] ?? HEALTH_BY_KEY.Unknown;
  return <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, background: h.color }} aria-hidden="true" />;
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-bad-ink">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputCls =
  'w-full h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent';

export function InfoTip({ text, className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        className="text-muted hover:text-ink rounded-full"
        aria-label={text}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Icon name="info" size={14} />
      </button>
      {open && (
        <span className="absolute z-30 left-1/2 -translate-x-1/2 top-6 w-64 rounded-lg bg-ink text-bg text-xs leading-relaxed px-3 py-2 shadow-pop pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}

/** Measures an element's content width (for crisp, responsive SVG charts). */
export function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
