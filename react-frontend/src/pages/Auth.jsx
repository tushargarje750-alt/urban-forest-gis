import { useState } from 'react';
import { Alert, Button, Card, Field, inputCls } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { Link, navigate } from '../lib/router.jsx';
import { useAuth } from '../lib/auth.jsx';
import * as api from '../lib/api.js';
import { APP_NAME, DEMO_ID } from '../config.js';

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <div className="text-center mb-6">
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-accent text-accent-ink">
          <Icon name="tree" size={22} />
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-ink">{title}</h1>
        <p className="text-sm text-ink-2 mt-1">{subtitle}</p>
      </div>
      <Card className="p-6">{children}</Card>
      <div className="mt-5 text-center text-sm text-ink-2">{footer}</div>
    </div>
  );
}

const safeNext = (next) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/projects');

export function Login({ next }) {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn(username.trim(), password);
      navigate(safeNext(next), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title={`Sign in to ${APP_NAME}`}
      subtitle="To upload surveys and see your server's projects"
      footer={
        <>
          No account?{' '}
          <Link to="/register" className="text-accent font-medium">
            Create one
          </Link>{' '}
          · or{' '}
          <Link to={`/results/${DEMO_ID}`} className="text-accent font-medium">
            try the demo
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Username" htmlFor="username">
          <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className={inputCls} autoFocus />
        </Field>
        <Field label="Password" htmlFor="password">
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={inputCls} />
        </Field>
        {error && <Alert level="error">{error}</Alert>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Shell>
  );
}

export function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Choose a username and a password.');
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await api.register(username.trim(), password, confirm);
      setDone(true);
    } catch (err) {
      setError(err.status === 409 ? 'That username is already taken.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Shell title="Account created" subtitle={`You can now sign in as ${username.trim()}.`}>
        <Button variant="primary" className="w-full" onClick={() => navigate('/login')}>
          Go to sign in
        </Button>
      </Shell>
    );
  }

  return (
    <Shell
      title="Create an account"
      subtitle="Accounts are stored on your analysis server"
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="text-accent font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Username" htmlFor="newUsername">
          <input id="newUsername" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className={inputCls} autoFocus />
        </Field>
        <Field label="Password" htmlFor="newPassword">
          <input id="newPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputCls} />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword">
          <input id="confirmPassword" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={inputCls} />
        </Field>
        {error && <Alert level="error">{error}</Alert>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </Shell>
  );
}
