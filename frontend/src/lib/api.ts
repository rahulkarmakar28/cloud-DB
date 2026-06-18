import type { DatabaseInstance, CreateDatabaseForm, PlanConfig, MetricPoint } from '../types';

const BASE = '/api';

async function refreshAccessToken(): Promise<string | null> {
  const rt = localStorage.getItem('refreshToken');
  if (!rt) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return null;
    const { accessToken, refreshToken } = await res.json() as { accessToken: string; refreshToken: string };
    localStorage.setItem('accessToken',  accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    return accessToken;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token = localStorage.getItem('accessToken');

  const doFetch = async (t: string | null) => fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  let res = await doFetch(token);

  // Auto-refresh on 401
  if (res.status === 401) {
    token = await refreshAccessToken();
    if (!token) {
      localStorage.clear();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    res = await doFetch(token);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getDatabases: () =>
    request<{ databases: DatabaseInstance[] }>('/databases'),

  getDatabase: (id: string) =>
    request<{ database: DatabaseInstance }>(`/databases/${id}`),

  createDatabase: (form: CreateDatabaseForm) =>
    request<{ database: DatabaseInstance }>('/databases', {
      method: 'POST', body: JSON.stringify(form),
    }),

  deleteDatabase: (id: string) =>
    request<{ message: string }>(`/databases/${id}`, { method: 'DELETE' }),

  pauseDatabase:  (id: string) =>
    request<{ message: string }>(`/databases/${id}/pause`,  { method: 'PATCH' }),

  resumeDatabase: (id: string) =>
    request<{ message: string }>(`/databases/${id}/resume`, { method: 'PATCH' }),

  getMetrics: (id: string) =>
    request<{ current: Record<string, number>; series: MetricPoint[] }>(`/databases/${id}/metrics`),

  getManifests: (id: string) =>
    request<{ manifests: Record<string, unknown> }>(`/databases/${id}/manifests`),

  getPlans:   () => request<{ plans:   PlanConfig[] }>('/plans'),
  getEngines: () => request<{ engines: Record<string, string[]> }>('/engines'),
  getRegions: () => request<{ regions: { id: string; label: string; flag: string }[] }>('/regions'),
};
