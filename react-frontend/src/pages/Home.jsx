import { Button, Card } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { navigate } from '../lib/router.jsx';
import { useAuth } from '../lib/auth.jsx';
import { BACKEND_ENABLED, DEMO_ID, REPO_URL } from '../config.js';

const STEPS = [
  { icon: 'upload', title: 'Upload', text: 'An RGB orthophoto plus the DEM and DTM of the same site, as GeoTIFFs from your UAV survey.' },
  { icon: 'tree', title: 'Detect', text: 'YOLOv8 finds tree crowns; region growing on the canopy height model traces each crown outline.' },
  { icon: 'ruler', title: 'Measure', text: 'Each tree gets a height, a canopy girth and a health class from its MGRVI vegetation index.' },
  { icon: 'map', title: 'Explore', text: 'Browse crowns on the map, filter by height or health, compare charts and export the data.' },
];

const OUTPUTS = [
  ['Tree count', 'Every detected crown, with its outline on the map'],
  ['Tree height', 'Tallest point of each crown above the ground (m)'],
  ['Canopy girth', 'Longest distance across each crown (m)'],
  ['Health', 'Healthy, moderately healthy or poor, from mean MGRVI'],
  ['Map layers', 'Orthophoto, colour-coded height map and health map'],
  ['Site summary', 'Canopy cover, tree density, distributions; CSV and GeoJSON export'],
];

export default function Home() {
  const { user } = useAuth();
  return (
    <div>
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-14 pb-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-accent bg-accent-soft rounded-full px-2.5 py-1">
            <Icon name="leaf" size={12} /> GIS tool for urban forest management
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight text-ink leading-[1.1]">
            Count, measure and check the health of urban trees from drone imagery
          </h1>
          <p className="mt-5 text-lg text-ink-2 max-w-xl">
            Upload a UAV survey and get every tree's location, height, canopy girth and health on an interactive map, ready for planning
            decisions.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="primary" size="lg" iconRight="arrowRight" onClick={() => navigate(`/results/${DEMO_ID}`)}>
              Explore the demo
            </Button>
            {BACKEND_ENABLED ? (
              <Button size="lg" icon="upload" onClick={() => navigate(user ? '/upload' : '/login?next=/upload')}>
                Analyse your own data
              </Button>
            ) : (
              REPO_URL && (
                <Button size="lg" icon="code" href={REPO_URL} target="_blank" rel="noreferrer">
                  View the source code
                </Button>
              )
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            {BACKEND_ENABLED
              ? 'The demo needs no account and runs entirely in your browser.'
              : 'This online version shows a demo site and runs entirely in your browser. Analysing new surveys needs the processing server, which you can run from the source code.'}
          </p>
        </div>
        <HeroGraphic />
      </section>

      <section className="border-t border-line bg-surface">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-xl font-semibold text-ink">How it works</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Card className="p-5 h-full">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-accent-soft text-accent">
                      <Icon name={s.icon} size={18} />
                    </span>
                    <span className="text-xs font-medium text-muted">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-3 font-semibold text-ink">{s.title}</h3>
                  <p className="mt-1 text-sm text-ink-2">{s.text}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14">
        <h2 className="text-xl font-semibold text-ink">What you get for each site</h2>
        <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {OUTPUTS.map(([t, d]) => (
            <div key={t} className="flex gap-3">
              <Icon name="check" size={18} className="text-accent mt-0.5" strokeWidth={2.5} />
              <div>
                <dt className="font-medium text-ink">{t}</dt>
                <dd className="text-sm text-ink-2 mt-0.5">{d}</dd>
              </div>
            </div>
          ))}
        </dl>
        <button type="button" onClick={() => navigate('/about')} className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
          Read about the method <Icon name="arrowRight" size={14} />
        </button>
      </section>
    </div>
  );
}

/** Abstract illustration: crowns over a canopy height profile. Decorative. */
function HeroGraphic() {
  const crowns = [
    [70, 120, 38, '#0ca30c'],
    [150, 92, 46, '#0ca30c'],
    [238, 128, 34, '#fab219'],
    [300, 84, 40, '#0ca30c'],
    [372, 118, 30, '#d03b3b'],
    [118, 196, 32, '#0ca30c'],
    [206, 204, 40, '#0ca30c'],
    [290, 196, 28, '#fab219'],
    [356, 206, 34, '#0ca30c'],
  ];
  return (
    <div className="relative rounded-2xl border border-line bg-surface shadow-card overflow-hidden" aria-hidden="true">
      <svg viewBox="0 0 440 320" className="w-full h-auto block">
        <defs>
          <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0H0V22" fill="none" stroke="rgb(var(--line))" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="440" height="320" fill="rgb(var(--surface-2))" />
        <rect width="440" height="320" fill="url(#grid)" />
        {crowns.map(([x, y, r, c], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill={c} fillOpacity="0.28" stroke={c} strokeWidth="2.5" />
            <circle cx={x} cy={y} r="3" fill={c} />
          </g>
        ))}
        <rect x="134" y="54" width="88" height="88" fill="none" stroke="rgb(var(--ink))" strokeWidth="1.5" strokeDasharray="5 4" rx="3" />
        <g transform="translate(250 252)">
          <rect width="174" height="54" rx="10" fill="rgb(var(--surface))" stroke="rgb(var(--line))" />
          <text x="14" y="22" fontSize="11" fill="rgb(var(--muted))">Tree 1 · Healthy</text>
          <text x="14" y="42" fontSize="15" fontWeight="600" fill="rgb(var(--ink))">
            6.3 m · girth 8.0 m
          </text>
        </g>
      </svg>
    </div>
  );
}
