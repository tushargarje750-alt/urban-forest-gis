import { useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { Link, navigate, useRoute } from './lib/router.jsx';
import { Icon } from './components/icons.jsx';
import { Spinner } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import Projects from './pages/Projects.jsx';
import Results from './pages/Results.jsx';
import Upload from './pages/Upload.jsx';
import About from './pages/About.jsx';
import { Login, Register } from './pages/Auth.jsx';
import { APP_NAME, BACKEND_ENABLED, DEMO_ID, REPO_URL } from './config.js';

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const { path, params } = useRoute();
  const parts = path.split('/').filter(Boolean);

  let page;
  let title = '';
  if (parts.length === 0) {
    page = <Home />;
  } else if (parts[0] === 'projects') {
    page = <Projects />;
    title = 'Projects';
  } else if (parts[0] === 'results' && parts[1]) {
    const id = decodeURIComponent(parts[1]);
    page = <Results projectId={id} />;
    title = id === DEMO_ID ? 'Demo project' : id;
  } else if (parts[0] === 'upload' && BACKEND_ENABLED) {
    page = <RequireUser next="/upload"><Upload /></RequireUser>;
    title = 'New analysis';
  } else if (parts[0] === 'about') {
    page = <About />;
    title = 'About the method';
  } else if (parts[0] === 'login' && BACKEND_ENABLED) {
    page = <Login next={params.get('next')} />;
    title = 'Sign in';
  } else if (parts[0] === 'register' && BACKEND_ENABLED) {
    page = <Register />;
    title = 'Create account';
  } else {
    page = <NotFound />;
    title = 'Not found';
  }

  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header active={parts[0] ?? ''} />
      <main className="flex-1">{page}</main>
      <footer className="border-t border-line py-6 px-4 text-center text-xs text-muted no-print">
        {APP_NAME} · Tree detection, height and health from UAV data ·{' '}
        <Link to="/about" className="hover:text-ink">
          Method
        </Link>
        {REPO_URL && (
          <>
            {' · '}
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-ink">
              Source code
            </a>
          </>
        )}
      </footer>
    </div>
  );
}

function RequireUser({ next, children }) {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
  }, [user, next]);
  return user ? children : null;
}

function NavLink({ to, active, icon, children }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:text-ink hover:bg-surface-2'}`}
    >
      <Icon name={icon} size={16} />
      {children}
    </Link>
  );
}

function BackendStatus() {
  const { backend, checkBackend } = useAuth();
  if (backend === 'disabled') return null;
  const map = {
    checking: { dot: null, text: 'Connecting…' },
    online: { dot: 'bg-good', text: 'Server online' },
    offline: { dot: 'bg-muted', text: 'Server offline' },
  };
  const s = map[backend];
  return (
    <button
      type="button"
      onClick={checkBackend}
      title={backend === 'offline' ? 'The analysis server is not reachable. Click to retry. The demo still works.' : 'Analysis server status'}
      className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-line text-xs text-ink-2 hover:bg-surface-2"
    >
      {s.dot ? <span className={`w-2 h-2 rounded-full ${s.dot}`} /> : <Spinner size={12} />}
      {s.text}
    </button>
  );
}

function Header({ active }) {
  const { user, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-line no-print">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-auto min-h-14 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link to="/" className="inline-flex items-center gap-2 font-semibold text-ink mr-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-accent-ink">
            <Icon name="tree" size={18} strokeWidth={2.2} />
          </span>
          {APP_NAME}
        </Link>
        <nav className="flex items-center gap-1 order-3 sm:order-none w-full sm:w-auto overflow-x-auto" aria-label="Main">
          <NavLink to="/projects" icon="folder" active={active === 'projects' || active === 'results'}>
            Projects
          </NavLink>
          {BACKEND_ENABLED && (
            <NavLink to="/upload" icon="upload" active={active === 'upload'}>
              New analysis
            </NavLink>
          )}
          <NavLink to="/about" icon="info" active={active === 'about'}>
            Method
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <BackendStatus />
          {BACKEND_ENABLED &&
            (user ? (
              <div className="flex items-center gap-1">
                <span className="hidden md:inline-flex items-center gap-1.5 text-sm text-ink-2 px-2">
                  <Icon name="user" size={16} /> {user}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    navigate('/');
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm text-ink-2 hover:text-ink hover:bg-surface-2"
                >
                  <Icon name="logout" size={16} /> Sign out
                </button>
              </div>
            ) : (
              <Link to="/login" className="inline-flex items-center h-9 px-4 rounded-lg text-sm font-medium bg-accent text-accent-ink hover:bg-accent/90">
                Sign in
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}

function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="text-ink-2 mt-2">That page doesn't exist.</p>
      <Link to="/" className="inline-block mt-6 text-accent font-medium">
        Go to the home page
      </Link>
    </div>
  );
}
