import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, AuthState } from '../types';

interface AuthContextType extends AuthState {
  login:    (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout:   () => Promise<void>;
  loading:  boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const BASE = '/api/auth';

function saveAuth(accessToken: string, refreshToken: string, user: User) {
  localStorage.setItem('accessToken',  accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('user',         JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}
function loadAuth(): AuthState {
  const at = localStorage.getItem('accessToken');
  const rt = localStorage.getItem('refreshToken');
  const u  = localStorage.getItem('user');
  return { accessToken: at, refreshToken: rt, user: u ? JSON.parse(u) as User : null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadAuth);
  const [loading, setLoading] = useState(true);

  // Validate token on mount
  useEffect(() => {
    if (!state.accessToken) { setLoading(false); return; }
    fetch(`${BASE}/me`, { headers: { Authorization: `Bearer ${state.accessToken}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ user }: { user: User }) => setState(s => ({ ...s, user })))
      .catch(() => { clearAuth(); setState({ user: null, accessToken: null, refreshToken: null }); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json() as { error?: string };
      throw new Error(err.error ?? 'Login failed');
    }
    const { user, accessToken, refreshToken } = await res.json() as { user: User; accessToken: string; refreshToken: string };
    saveAuth(accessToken, refreshToken, user);
    setState({ user, accessToken, refreshToken });
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const res = await fetch(`${BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    if (!res.ok) {
      const err = await res.json() as { error?: string };
      throw new Error(err.error ?? 'Registration failed');
    }
    const { user, accessToken, refreshToken } = await res.json() as { user: User; accessToken: string; refreshToken: string };
    saveAuth(accessToken, refreshToken, user);
    setState({ user, accessToken, refreshToken });
  }, []);

  const logout = useCallback(async () => {
    if (state.accessToken) {
      await fetch(`${BASE}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.accessToken}` },
        body: JSON.stringify({ refreshToken: state.refreshToken }),
      }).catch(() => {});
    }
    clearAuth();
    setState({ user: null, accessToken: null, refreshToken: null });
  }, [state.accessToken, state.refreshToken]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
