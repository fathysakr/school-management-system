const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Endpoints where a 401 is part of normal flow (wrong credentials) — never auto-redirect
const AUTH_ENDPOINTS = ['/auth/login', '/auth/parent-login'];

function handleAuthFailure(endpoint: string) {
  if (typeof window === 'undefined') return;
  if (AUTH_ENDPOINTS.some((e) => endpoint.includes(e))) return;
  const path = window.location.pathname;
  if (path.startsWith('/login') || path.startsWith('/register')) return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = `/login?expired=1`;
}

interface RequestOptions extends RequestInit {
  token?: string;
}

async function apiRequest(endpoint: string, options: RequestOptions = {}) {
  const { token, headers: customHeaders, ...restOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...restOptions,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. Response: ${text.substring(0, 200)}`);
  }

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) handleAuthFailure(endpoint);
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  get: (endpoint: string, token?: string | null) =>
    apiRequest(endpoint, { method: 'GET', token: token ?? undefined }),

  post: (endpoint: string, body: unknown, token?: string | null) =>
    apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      token: token ?? undefined,
    }),

  put: (endpoint: string, body: unknown, token?: string | null) =>
    apiRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      token: token ?? undefined,
    }),

  delete: (endpoint: string, token?: string | null, body?: unknown) =>
    apiRequest(endpoint, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined, token: token ?? undefined }),

  upload: async (endpoint: string, formData: FormData, token?: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_URL}${endpoint}`, { method: 'POST', headers, body: formData });
    if (!response.ok) {
      if (response.status === 401) handleAuthFailure(endpoint);
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }
    return response.json();
  },
};
