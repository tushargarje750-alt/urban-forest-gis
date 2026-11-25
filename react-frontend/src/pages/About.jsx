import { Card } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { HEALTH_BY_KEY } from '../lib/trees.js';
import { MGRVI_HEALTHY_FROM, MGRVI_POOR_BELOW, PAPER } from '../config.js';

const STAGES = [
  {
    title: 'Canopy height model',
    text: 'The terrain model (DTM) is subtracted from the surface model (DEM), giving the height of everything above ground. Otsu thresholding keeps only the tall vegetation.',
    formula: 'CHM = DEM − DTM',
  },
  {
    title: 'Vegetation mask',
    text: 'All three rasters are reprojected to WGS84 and the orthophoto is masked so only pixels above the CHM threshold remain.',
  },
  {
    title: 'Tree detection',
    text: 'A trained YOLOv8 model detects tree crowns in the masked orthophoto (confidence 0.05, IoU 0.5).',
  },
  {
    title: 'Crown delineation',
    text: 'The highest CHM point inside each detection becomes a seed. Region growing then expands outwards while height keeps falling away from the tree top (least-squares slope along the growth path).',
  },
  {
    title: 'Per-tree measurements',
    text: 'Height is the tallest CHM value in the crown. Canopy girth is the longest distance across the crown outline. Health is the mean MGRVI of the crown pixels.',
    formula: 'MGRVI = (G² − R²) / (G² + R²)',
  },
  {
    title: 'Publishing',
    text: 'Crown polygons and measurements are stored in PostGIS; the orthophoto, colour-coded height map and MGRVI health map are published as GeoServer WMS layers.',
  },
];

const CLASSES = [
  ['Poor', `MGRVI below ${MGRVI_POOR_BELOW}`],
  ['Moderately Healthy', `${MGRVI_POOR_BELOW} to ${MGRVI_HEALTHY_FROM}`],
  ['Healthy', `${MGRVI_HEALTHY_FROM} and above`],
];

export default function About() {
  const citation = [PAPER.authors, PAPER.year && `(${PAPER.year})`, PAPER.title, PAPER.venue].filter(Boolean).join('. ');
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-semibold text-ink">How the analysis works</h1>
      <p className="mt-3 text-ink-2 text-lg">
        The tool combines a YOLOv8 detector with a region-growing algorithm on a canopy height model, and uses the Modified Green Red
        Vegetation Index (MGRVI) to judge vegetation health.
      </p>

      <ol className="mt-10 relative border-l-2 border-line ml-3 space-y-8">
        {STAGES.map((s, i) => (
          <li key={s.title} className="pl-8 relative">
            <span className="absolute -left-[15px] top-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-accent-ink text-xs font-semibold">
              {i + 1}
            </span>
            <h2 className="font-semibold text-ink">{s.title}</h2>
            <p className="mt-1 text-ink-2">{s.text}</p>
            {s.formula && <p className="mt-2 inline-block rounded-md bg-surface-2 border border-line px-2.5 py-1 font-mono text-sm text-ink">{s.formula}</p>}
          </li>
        ))}
      </ol>

      <Card className="mt-12 p-5">
        <h2 className="font-semibold text-ink">Health classes</h2>
        <ul className="mt-3 space-y-2">
          {CLASSES.map(([key, range]) => {
            const h = HEALTH_BY_KEY[key];
            return (
              <li key={key} className="flex items-center gap-3 text-sm">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{ background: h.color, color: h.text }}>
                  <Icon name={h.icon} size={11} strokeWidth={3} />
                </span>
                <span className="font-medium text-ink w-40">{h.label}</span>
                <span className="text-ink-2 tabular">{range}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-semibold text-ink">Computed in the browser</h2>
        <p className="mt-2 text-sm text-ink-2">
          These summaries are derived by this website from the backend's crown outlines and do not change the published method:
        </p>
        <ul className="mt-2 text-sm text-ink-2 list-disc pl-5 space-y-1">
          <li>Crown area: the area of each crown polygon.</li>
          <li>Canopy cover: total crown area divided by the area of the box around all detected trees.</li>
          <li>Tree density: trees per hectare in that same box.</li>
          <li>Charts, filters and exports.</li>
        </ul>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-semibold text-ink">Reference</h2>
        <p className="mt-2 text-sm text-ink-2">{citation}</p>
        {PAPER.url && (
          <a href={PAPER.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent">
            Read the paper <Icon name="arrowRight" size={14} />
          </a>
        )}
      </Card>
    </div>
  );
}
