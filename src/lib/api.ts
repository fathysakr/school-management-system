const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

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
};
