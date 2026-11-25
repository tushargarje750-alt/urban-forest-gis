import { useEffect, useState } from 'react';

/** Hash routing, so the build works on any static host without rewrite rules. */
function current() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path, params: new URLSearchParams(query) };
}

export function useRoute() {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const onChange = () => {
      setRoute(current());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(to, { replace = false } = {}) {
  const url = `#${to}`;
  if (replace) {
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = to;
  }
}

export function Link({ to, ...props }) {
  return <a href={`#${to}`} {...props} />;
}
