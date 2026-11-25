import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Field, Spinner, inputCls } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { Link, navigate } from '../lib/router.jsx';
import { useAuth } from '../lib/auth.jsx';
import * as api from '../lib/api.js';
import { checkFile, checkSet, inspectTiff } from '../lib/tiff.js';
import { bytes, duration, num } from '../lib/format.js';
import { DEMO_ID, MAX_FILE_BYTES } from '../config.js';

const SLOTS = [
  { role: 'ortho', title: 'Orthophoto', hint: 'Colour (RGB) image of the site, ideally 8-bit.' },
  { role: 'dem', title: 'DEM (surface model)', hint: 'Elevation of the top surface: tree canopy, roofs, ground.' },
  { role: 'dtm', title: 'DTM (terrain model)', hint: 'Elevation of the bare ground only.' },
];

const PIPELINE = [
  'Canopy height model (DEM − DTM) and Otsu filtering',
  'Masking the orthophoto to vegetation',
  'YOLOv8 tree detection',
  'Region growing from crown tops',
  'Height, canopy girth and MGRVI health per tree',
  'Saving to PostGIS and publishing map layers to GeoServer',
];

function validateName(name, existing) {
  const n = name.trim();
  if (!n) return { error: 'Enter a project name.' };
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(n)) {
    return { error: 'Use letters, numbers and underscores only, starting with a letter. No spaces or dashes.' };
  }
  if (n.length > 40) return { error: 'Keep the name to 40 characters or fewer.' };
  if (n.toLowerCase() === DEMO_ID) return { error: `“${DEMO_ID}” is reserved for the sample project.` };
  if (existing.includes(n)) return { warning: `A project called “${n}” already exists. Its results will be replaced.` };
  return {};
}

export default function Upload() {
  const { backend, checkBackend } = useAuth();
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [existing, setExisting] = useState([]);
  const [slots, setSlots] = useState({ ortho: null, dem: null, dtm: null });
  const [run, setRun] = useState(null); // {phase, ...}
  const [busyWarning, setBusyWarning] = useState(false);
  const uploadRef = useRef(null);

  useEffect(() => {
    api.listProjects().then(setExisting).catch(() => {});
  }, []);

  const nameCheck = validateName(name, existing);

  async function choose(role, file) {
    if (!file) {
      setSlots((s) => ({ ...s, [role]: null }));
      return;
    }
    setSlots((s) => ({ ...s, [role]: { file, inspecting: true } }));
    let info = null;
    let parseError = false;
    try {
      info = await inspectTiff(file);
    } catch {
      parseError = true;
    }
    setSlots((s) => (s[role]?.file === file ? { ...s, [role]: { file, info, issues: checkFile(role, file, info, parseError) } } : s));
  }

  const setIssues = useMemo(
    () => checkSet({ ortho: slots.ortho?.info, dem: slots.dem?.info, dtm: slots.dtm?.info }),
    [slots],
  );
  const allIssues = [...SLOTS.flatMap((s) => slots[s.role]?.issues ?? []), ...setIssues];
  const hasErrors = allIssues.some((i) => i.level === 'error');
  const inspecting = SLOTS.some((s) => slots[s.role]?.inspecting);
  const missing = SLOTS.filter((s) => !slots[s.role]).map((s) => s.title);
  const ready = !nameCheck.error && !missing.length && !hasErrors && !inspecting;
  const totalBytes = SLOTS.reduce((n, s) => n + (slots[s.role]?.file.size ?? 0), 0);

  async function start(force = false) {
    setTouched(true);
    if (!ready) return;
    const projectName = name.trim();
    if (!force) {
      try {
        if ((await api.getStatus()) === 'processing') {
          setBusyWarning(true);
          return;
        }
      } catch (err) {
        setRun({ phase: 'error', message: err.message });
        return;
      }
    }
    setBusyWarning(false);
    setRun({ phase: 'creating', projectName });
    try {
      await api.addProject(projectName);
    } catch (err) {
      setRun({ phase: 'error', projectName, message: `Couldn't create the project: ${err.message}` });
      return;
    }
    const startedAt = Date.now();
    let uploaded = false;
    setRun({ phase: 'uploading', projectName, loaded: 0, total: totalBytes, startedAt });
    const { promise, abort } = api.uploadProject(
      { projectName, ortho: slots.ortho.file, dem: slots.dem.file, dtm: slots.dtm.file },
      {
        onUploadProgress: (loaded, total) => setRun((r) => (r?.phase === 'uploading' ? { ...r, loaded, total } : r)),
        onUploaded: () => {
          uploaded = true;
          setRun((r) => ({ ...r, phase: 'processing', processingSince: Date.now() }));
        },
      },
    );
    uploadRef.current = abort;
    let requestFailed = null;
    try {
      await promise;
    } catch (err) {
      requestFailed = err;
    }
    uploadRef.current = null;
    if (requestFailed?.status === -1) {
      setRun(null);
      return;
    }
    if (requestFailed && !uploaded) {
      // The backend flags itself "processing" as soon as the request starts and
      // never resets it if the upload breaks, so don't wait on /status here.
      setRun((r) => ({ ...r, phase: 'error', message: requestFailed.message }));
      return;
    }
    // The request may drop while the server keeps processing; fall back to polling /status.
    await finish(projectName, requestFailed);
  }

  async function finish(projectName, requestFailed) {
    for (let attempt = 0; attempt < 720; attempt++) {
      let status;
      try {
        status = await api.getStatus();
      } catch (err) {
        setRun((r) => ({ ...r, phase: 'error', message: err.message }));
        return;
      }
      if (status === 'done') {
        setRun((r) => ({ ...r, phase: 'done', finishedAt: Date.now() }));
        return;
      }
      if (status === 'error') {
        setRun((r) => ({ ...r, phase: 'error', message: 'Processing failed on the server.', serverError: true }));
        return;
      }
      if (status === 'idle' && requestFailed) {
        setRun((r) => ({ ...r, phase: 'error', message: requestFailed.message }));
        return;
      }
      await new Promise((res) => setTimeout(res, 5000));
    }
    setRun((r) => ({ ...r, phase: 'error', message: 'Timed out waiting for the server to finish.' }));
  }

  if (backend === 'offline') {
    return (
      <Page>
        <Alert
          level="warning"
          title="The analysis server isn't reachable"
          action={
            <Button size="sm" icon="refresh" onClick={checkBackend}>
              Retry
            </Button>
          }
        >
          <p className="mt-1">
            Start the Flask backend (and PostgreSQL / GeoServer), then retry. You can still{' '}
            <Link to={`/results/${DEMO_ID}`} className="text-accent font-medium">
              explore the demo project
            </Link>
            .
          </p>
        </Alert>
      </Page>
    );
  }

  if (run) {
    return (
      <Page>
        <Progress run={run} onCancel={() => uploadRef.current?.()} onReset={() => setRun(null)} />
      </Page>
    );
  }

  return (
    <Page>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(busyWarning);
        }}
        className="space-y-6"
        noValidate
      >
        <Card className="p-5">
          <Field
            label="Project name"
            htmlFor="projectName"
            hint="Letters, numbers and underscores, starting with a letter. It names the results table and map layers."
            error={touched || name ? nameCheck.error : null}
          >
            <input
              id="projectName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="e.g. campus_north_2024"
              className={inputCls}
              autoComplete="off"
              spellCheck="false"
              aria-invalid={Boolean(touched && nameCheck.error)}
            />
          </Field>
          {nameCheck.warning && (
            <Alert level="warning" className="mt-3">
              {nameCheck.warning}
            </Alert>
          )}
        </Card>

        <div>
          <h2 className="text-sm font-semibold text-ink">GeoTIFF files</h2>
          <p className="text-sm text-ink-2 mt-0.5">
            All three cover the same site. Up to {bytes(MAX_FILE_BYTES)} each. Files are checked in your browser before upload.
          </p>
          <div className="grid gap-4 md:grid-cols-3 mt-3">
            {SLOTS.map((s) => (
              <FileSlot key={s.role} slot={s} state={slots[s.role]} onChoose={(f) => choose(s.role, f)} />
            ))}
          </div>
          {setIssues.length > 0 && (
            <div className="mt-4 space-y-2">
              {setIssues.map((i) => (
                <Alert key={i.text} level={i.level}>
                  {i.text}
                </Alert>
              ))}
            </div>
          )}
        </div>

        {busyWarning && (
          <Alert level="warning" title="The server is already processing">
            The server reports another analysis in progress (or a previous one that never finished). Running two at once can make
            both fail. Wait for it, or start anyway.
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant="primary" size="lg" icon="upload" disabled={touched && !ready}>
            {busyWarning ? 'Start anyway' : 'Start analysis'}
          </Button>
          <p className="text-sm text-ink-2">
            {inspecting
              ? 'Checking files…'
              : missing.length
                ? `Still needed: ${missing.join(', ')}.`
                : hasErrors
                  ? 'Fix the problems above to continue.'
                  : `${bytes(totalBytes)} to upload. Processing can take several minutes.`}
          </p>
        </div>
      </form>
    </Page>
  );
}

function Page({ children }) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-semibold text-ink">New analysis</h1>
      <p className="text-ink-2 mt-1 mb-6 max-w-2xl">
        Upload an orthophoto with its DEM and DTM. The server detects every tree and measures its height, canopy girth and health.
      </p>
      {children}
    </div>
  );
}

const LEVEL_ICON = { error: 'alert', warning: 'alert', info: 'info' };
const LEVEL_CLS = { error: 'text-bad-ink', warning: 'text-ink', info: 'text-ink-2' };

function FileSlot({ slot, state, onChoose }) {
  const [drag, setDrag] = useState(false);
  const inputId = `file-${slot.role}`;
  const info = state?.info;
  const errors = state?.issues?.filter((i) => i.level === 'error').length ?? 0;
  return (
    <Card className={`p-4 flex flex-col ${errors ? 'border-bad/50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">{slot.title}</h3>
          <p className="text-xs text-ink-2 mt-0.5">{slot.hint}</p>
        </div>
        {state && !state.inspecting && (
          errors ? <Icon name="alert" size={18} className="text-bad-ink" title="Has problems" /> : <Icon name="check" size={18} className="text-good-ink" title="Looks good" />
        )}
      </div>

      {!state ? (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onChoose(e.dataTransfer.files?.[0]);
          }}
          className={`mt-3 flex-1 min-h-[132px] flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer text-center px-3 transition-colors ${drag ? 'border-accent bg-accent-soft' : 'border-line hover:border-ink/30 hover:bg-surface-2'}`}
        >
          <Icon name="upload" size={20} className="text-ink-2" />
          <span className="text-sm text-ink">
            <span className="font-medium text-accent">Choose a file</span> or drop it here
          </span>
          <span className="text-xs text-muted">.tif or .tiff</span>
        </label>
      ) : (
        <div className="mt-3 flex-1 space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
            <Icon name="file" size={16} className="text-ink-2" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink truncate" title={state.file.name}>
                {state.file.name}
              </p>
              <p className="text-xs text-muted">{bytes(state.file.size)}</p>
            </div>
            <button type="button" onClick={() => onChoose(null)} className="text-muted hover:text-ink" aria-label={`Remove ${slot.title}`}>
              <Icon name="x" size={16} />
            </button>
          </div>
          {state.inspecting ? (
            <p className="text-xs text-ink-2 flex items-center gap-2">
              <Spinner size={12} /> Reading file header…
            </p>
          ) : (
            <>
              {info && (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted">Size</dt>
                  <dd className="text-ink-2 tabular text-right">
                    {info.width.toLocaleString()} × {info.height.toLocaleString()} px
                  </dd>
                  <dt className="text-muted">Bands</dt>
                  <dd className="text-ink-2 tabular text-right">
                    {info.bands} · {info.type}
                  </dd>
                  <dt className="text-muted">Coordinates</dt>
                  <dd className="text-ink-2 text-right truncate" title={info.crsName ?? ''}>
                    {info.epsg ? `EPSG:${info.epsg}` : info.georeferenced ? 'Custom CRS' : 'None'}
                  </dd>
                  {info.pixelMetres && (
                    <>
                      <dt className="text-muted">Pixel size</dt>
                      <dd className="text-ink-2 tabular text-right">
                        {info.pixelMetres < 1 ? `${num(info.pixelMetres * 100, 1)} cm` : `${num(info.pixelMetres, 2)} m`}
                      </dd>
                    </>
                  )}
                </dl>
              )}
              {state.issues?.length > 0 && (
                <ul className="space-y-1.5 pt-1">
                  {state.issues.map((i) => (
                    <li key={i.text} className={`flex gap-1.5 text-xs ${LEVEL_CLS[i.level]}`}>
                      <Icon name={LEVEL_ICON[i.level]} size={13} className="mt-px" />
                      <span>{i.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
      <input id={inputId} type="file" accept=".tif,.tiff,image/tiff" className="sr-only" onChange={(e) => onChoose(e.target.files?.[0])} />
    </Card>
  );
}

function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function StepRow({ state, title, children }) {
  const icon =
    state === 'done' ? (
      <span className="w-6 h-6 rounded-full bg-good text-white inline-flex items-center justify-center">
        <Icon name="check" size={14} strokeWidth={3} />
      </span>
    ) : state === 'active' ? (
      <span className="w-6 h-6 rounded-full bg-accent-soft text-accent inline-flex items-center justify-center">
        <Spinner size={14} />
      </span>
    ) : state === 'failed' ? (
      <span className="w-6 h-6 rounded-full bg-bad text-white inline-flex items-center justify-center">
        <Icon name="x" size={14} strokeWidth={3} />
      </span>
    ) : (
      <span className="block w-6 h-6 rounded-full border-2 border-line" />
    );
  return (
    <li className="flex gap-3">
      <div className="pt-0.5">{icon}</div>
      <div className="flex-1 min-w-0 pb-5">
        <p className={`text-sm font-medium ${state === 'pending' ? 'text-muted' : 'text-ink'}`}>{title}</p>
        {children}
      </div>
    </li>
  );
}

function Progress({ run, onCancel, onReset }) {
  const now = useNow(run.phase === 'uploading' || run.phase === 'processing');
  const order = ['creating', 'uploading', 'processing', 'done'];
  const failedAt = run.phase === 'error' ? (run.processingSince ? 'processing' : run.startedAt ? 'uploading' : 'creating') : null;
  const idx = order.indexOf(failedAt ?? run.phase);
  const st = (p) => {
    const i = order.indexOf(p);
    if (failedAt === p) return 'failed';
    if (i < idx || run.phase === 'done') return 'done';
    if (i === idx) return 'active';
    return 'pending';
  };
  const frac = run.total ? run.loaded / run.total : 0;
  const elapsed = run.startedAt ? now - run.startedAt : 0;
  const speed = elapsed > 1000 ? run.loaded / (elapsed / 1000) : 0;
  const eta = speed > 0 ? ((run.total - run.loaded) / speed) * 1000 : null;

  return (
    <Card className="p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-ink mb-5">
        {run.phase === 'done' ? 'Analysis complete' : run.phase === 'error' ? 'Analysis failed' : `Analysing “${run.projectName}”`}
      </h2>
      <ol>
        <StepRow state={st('creating')} title="Create project" />
        <StepRow state={st('uploading')} title="Upload files">
          {run.phase === 'uploading' && (
            <div className="mt-2">
              <div className="h-2 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={Math.round(frac * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-accent rounded-full transition-[width]" style={{ width: `${frac * 100}%` }} />
              </div>
              <p className="text-xs text-ink-2 mt-1.5 tabular">
                {Math.round(frac * 100)}% · {bytes(run.loaded)} of {bytes(run.total)}
                {speed > 0 && ` · ${bytes(speed)}/s`}
                {eta !== null && ` · about ${duration(eta)} left`}
              </p>
            </div>
          )}
        </StepRow>
        <StepRow state={st('processing')} title="Process on the server">
          {run.phase === 'processing' && (
            <div className="mt-1">
              <p className="text-xs text-ink-2 tabular">Running for {duration(now - run.processingSince)}. Keep this tab open.</p>
              <ul className="mt-2 space-y-1 text-xs text-muted list-disc pl-4">
                {PIPELINE.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </StepRow>
        <StepRow state={st('done')} title="Results ready" />
      </ol>

      {run.phase === 'uploading' && (
        <Button variant="danger" icon="x" onClick={onCancel}>
          Cancel upload
        </Button>
      )}
      {run.phase === 'done' && (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" iconRight="arrowRight" onClick={() => navigate(`/results/${encodeURIComponent(run.projectName)}`)}>
            View results
          </Button>
          <Button onClick={onReset}>Analyse another site</Button>
        </div>
      )}
      {run.phase === 'error' && (
        <div className="space-y-4">
          <Alert level="error" title={run.message}>
            {run.serverError && (
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                <li>The Python traceback is in the Flask server console.</li>
                <li>Common causes: DEM and DTM that don't line up, no trees detected, or PostgreSQL / GeoServer not running.</li>
              </ul>
            )}
          </Alert>
          <Button icon="arrowLeft" onClick={onReset}>
            Back to the form
          </Button>
        </div>
      )}
    </Card>
  );
}
