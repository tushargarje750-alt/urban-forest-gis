/**
 * Client for the Flask backend in app.py. The backend is frozen, so every
 * quirk is handled here rather than changed there:
 *  - POST /upload runs the whole pipeline inside the request and answers
 *    {status:"ok"} even when processing failed; the real outcome is GET /status.
 *  - /status is one global flag ("idle" | "processing" | "done" | "error").
 *  - Login is not enforced by any endpoint; it only validates credentials.
 */
import { API_BASE, BACKEND_ENABLED } from '../config.js';

export class ApiError extends Error {
  constructor(message, { status = 0, cause } = {}) {
    super(message);
    this.status = status;
    this.cause = cause;
  }
}

const unreachable = () =>
  new ApiError(`Can't reach the server at ${API_BASE}. Is the Flask backend running?`);

async function request(path, { method = 'GET', body, timeout = 20000 } = {}) {
  if (!BACKEND_ENABLED) throw new ApiError('This site runs in demo-only mode (no backend configured).');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, body, signal: ctrl.signal });
  } catch (err) {
    throw unreachable(err);
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Flask returns an HTML error page on unhandled exceptions (500)
  }
  if (!res.ok) {
    const message =
      data?.message || data?.error || (res.status >= 500 ? 'The server hit an error (see the Flask console).' : res.statusText);
    throw new ApiError(message, { status: res.status });
  }
  return data;
}

const form = (fields) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

export async function ping() {
  if (!BACKEND_ENABLED) return false;
  try {
    await request('/status', { timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}

export async function login(username, password) {
  try {
    await request('/login_page', { method: 'POST', body: form({ username, password }) });
  } catch (err) {
    if (err.status === 401) throw new ApiError('Incorrect username or password.', { status: 401 });
    throw err;
  }
}

export async function register(username, password, confirmPassword) {
  await request('/register', {
    method: 'POST',
    body: form({ username, password, confirm_password: confirmPassword }),
  });
}

export async function logout() {
  try {
    await request('/logout', { timeout: 4000 });
  } catch {
    // the session cookie is not used by any endpoint; local sign-out is enough
  }
}

export async function listProjects() {
  const data = await request('/projects');
  return Array.isArray(data?.projects) ? data.projects : [];
}

export async function addProject(projectName) {
  await request('/add_project', { method: 'POST', body: form({ projectName }) });
}

export async function getStatus() {
  const data = await request('/status', { timeout: 8000 });
  return data?.status ?? 'idle';
}

/** GeoJSON FeatureCollection (TreeID, Girth, Height, Health, MGRVI) + extent [minX,minY,maxX,maxY]. */
export async function getTrees(projectName) {
  try {
    return await request(`/get_tree_data?${new URLSearchParams({ projectName })}`, { timeout: 60000 });
  } catch (err) {
    if (err.status >= 500) {
      throw new ApiError(
        `No results found for "${projectName}". The project may not have finished processing.`,
        { status: err.status },
      );
    }
    throw err;
  }
}

/**
 * Upload ortho/DEM/DTM with progress. Resolves when the request finishes,
 * which is after the backend pipeline has run. Callers must then read
 * getStatus() to learn whether processing succeeded.
 */
export function uploadProject({ projectName, ortho, dem, dtm }, { onUploadProgress, onUploaded } = {}) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    xhr.open('POST', `${API_BASE}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onUploadProgress?.(e.loaded, e.total);
    };
    xhr.upload.onload = () => onUploaded?.();
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new ApiError(`Upload failed (HTTP ${xhr.status}).`, { status: xhr.status }));
    };
    xhr.onerror = () => reject(unreachable());
    xhr.onabort = () => reject(new ApiError('Upload cancelled.', { status: -1 }));
    xhr.send(form({ projectName, ortho, dem, dtm }));
  });
  return { promise, abort: () => xhr.abort() };
}

/* ---------------- demo project (static files in public/demo) ---------------- */

const demoUrl = (file) => `${import.meta.env.BASE_URL}demo/${file}`;

export async function getDemo() {
  const [trees, meta] = await Promise.all(
    ['trees.json', 'meta.json'].map(async (f) => {
      const res = await fetch(demoUrl(f));
      if (!res.ok) throw new ApiError('The demo data could not be loaded.');
      return res.json();
    }),
  );
  return {
    trees,
    meta,
    images: {
      ortho: demoUrl('ortho.jpg'),
      height: demoUrl('height.jpg'),
      health: demoUrl('health.jpg'),
    },
  };
}
