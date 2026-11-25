import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from './api.js';
import { BACKEND_ENABLED } from '../config.js';

const KEY = 'urban-forest-gis.user';
const AuthContext = createContext(null);

const read = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const write = (value) => {
  try {
    if (value) window.localStorage.setItem(KEY, value);
    else window.localStorage.removeItem(KEY);
  } catch {
    // storage unavailable (private mode); the session just won't persist
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(read);
  const [backend, setBackend] = useState(BACKEND_ENABLED ? 'checking' : 'disabled');

  const checkBackend = useCallback(async () => {
    if (!BACKEND_ENABLED) return false;
    setBackend('checking');
    const ok = await api.ping();
    setBackend(ok ? 'online' : 'offline');
    return ok;
  }, []);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  const value = useMemo(
    () => ({
      user,
      backend,
      checkBackend,
      async signIn(username, password) {
        await api.login(username, password);
        write(username);
        setUser(username);
        setBackend('online');
      },
      async signOut() {
        await api.logout();
        write(null);
        setUser(null);
      },
    }),
    [user, backend, checkBackend],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
