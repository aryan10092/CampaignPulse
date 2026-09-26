import { API_URL } from './config';

/**
 * Returns fetch headers including the Authorization Bearer token from localStorage.
 */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cp_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/**
 * Authenticated fetch wrapper that automatically attaches the Bearer token.
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cp_token') : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  return fetch(`${API_URL}${path}`, { ...options, headers });
}
