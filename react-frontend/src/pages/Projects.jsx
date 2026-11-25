import { useEffect, useState } from 'react';
import { Alert, Button, Card, Spinner } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { Link, navigate } from '../lib/router.jsx';
import { useAuth } from '../lib/auth.jsx';
import * as api from '../lib/api.js';
import { BACKEND_ENABLED, DEMO_ID } from '../config.js';

export default function Projects() {
  const { user, backend } = useAuth();
  const [state, setState] = useState({ status: 'idle', projects: [] });
  const [query, setQuery] = useState('');

  const load = async () => {
    setState({ status: 'loading', projects: [] });
    try {
      const projects = await api.listProjects();
      setState({ status: 'ready', projects: [...projects].sort((a, b) => a.localeCompare(b)) });
    } catch (err) {
      setState({ status: 'error', projects: [], message: err.message });
    }
  };

  useEffect(() => {
    if (BACKEND_ENABLED && user) load();
  }, [user]);

  const shown = state.projects.filter((p) => p.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Projects</h1>
          <p className="text-ink-2 mt-1">Each project is one surveyed site.</p>
        </div>
        {BACKEND_ENABLED && user && (
          <Button variant="primary" icon="upload" onClick={() => navigate('/upload')}>
            New analysis
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-3">
        <ProjectRow
          to={`/results/${DEMO_ID}`}
          title="Demo project"
          subtitle="Sample site bundled with the app · works without the server"
          badge="Sample data"
        />
      </div>

      {BACKEND_ENABLED && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Your server's projects</h2>
            {user && state.projects.length > 6 && (
              <label className="relative">
                <span className="sr-only">Search projects</span>
                <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="h-8 w-48 rounded-lg border border-line bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </label>
            )}
          </div>
          <div className="mt-3">
            {!user ? (
              <Alert level="info">
                <Link to="/login?next=/projects" className="text-accent font-medium">
                  Sign in
                </Link>{' '}
                to see the projects stored on the analysis server.
              </Alert>
            ) : state.status === 'loading' ? (
              <p className="flex items-center gap-2 text-sm text-ink-2 py-6">
                <Spinner /> Loading projects…
              </p>
            ) : state.status === 'error' ? (
              <Alert
                level={backend === 'offline' ? 'warning' : 'error'}
                title="Couldn't load projects"
                action={
                  <Button size="sm" icon="refresh" onClick={load}>
                    Retry
                  </Button>
                }
              >
                {state.message}
              </Alert>
            ) : state.projects.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-ink-2">No projects yet.</p>
                <Button className="mt-4" variant="primary" icon="upload" onClick={() => navigate('/upload')}>
                  Analyse your first site
                </Button>
              </Card>
            ) : (
              <div className="grid gap-3">
                {shown.map((p) => (
                  <ProjectRow key={p} to={`/results/${encodeURIComponent(p)}`} title={p} subtitle="Open results" />
                ))}
                {!shown.length && <p className="text-sm text-ink-2 py-4">No project matches “{query}”.</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectRow({ to, title, subtitle, badge }) {
  return (
    <Link to={to} className="group block">
      <Card className="px-4 py-3.5 flex items-center gap-4 group-hover:border-ink/20 transition-colors">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-accent-soft text-accent">
          <Icon name="tree" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink truncate flex items-center gap-2">
            {title}
            {badge && <span className="text-[11px] font-medium rounded-full bg-surface-2 text-ink-2 px-2 py-0.5">{badge}</span>}
          </p>
          <p className="text-sm text-ink-2 truncate">{subtitle}</p>
        </div>
        <Icon name="arrowRight" size={18} className="text-muted group-hover:text-ink transition-colors" />
      </Card>
    </Link>
  );
}
