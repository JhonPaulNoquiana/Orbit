import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('orbit_token')) return setLoading(false);
    api('/auth/me').then(setSession).catch(() => localStorage.removeItem('orbit_token')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function refreshOnFocus() {
      if (localStorage.getItem('orbit_token')) api('/auth/me').then(setSession).catch(() => {});
    }
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, []);

  async function authenticate(mode, values) {
    const result = await api(`/auth/${mode}`, { method: 'POST', body: values });
    localStorage.setItem('orbit_token', result.token);
    const fresh = await api('/auth/me');
    setSession(fresh);
    return fresh;
  }

  function logout() {
    localStorage.removeItem('orbit_token');
    setSession(null);
  }

  return <AuthContext.Provider value={{ session, loading, authenticate, logout, refresh: () => api('/auth/me').then(setSession) }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
