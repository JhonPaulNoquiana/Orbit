const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export async function checkHealth({ timeout = 8000 } = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${BASE_URL}/health`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Server returned ${response.status}`);

    const payload = await response.json();
    if (payload?.status !== 'ok') throw new Error('Server is not ready');
    return payload;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function api(path, options = {}) {
  const token = localStorage.getItem('orbit_token');
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Something went wrong');
  return payload;
}
