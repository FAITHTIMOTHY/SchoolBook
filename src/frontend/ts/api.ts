/**
 * SchoolBook SMS - Type-safe API Client
 *
 * Authentication is cookie-based. The browser never sees or stores access
 * tokens in JavaScript; the API sets HttpOnly cookies and rotates the refresh
 * token. A 401 triggers one silent refresh attempt before the user is sent back
 * to the login page.
 */

export const API_BASE =
  window.location.protocol === 'file:' ? 'http://localhost:3100' : '';

export interface ApiFetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

let refreshInFlight: Promise<boolean> | null = null;

function isAuthEndpoint(endpoint: string): boolean {
  return (
    endpoint === '/api/auth/login' ||
    endpoint === '/api/auth/refresh'
  );
}

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

function redirectToLogin(): void {
  if (window.location.pathname === '/login') {
    return;
  }

  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const perform = (): Promise<Response> =>
    fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

  let response = await perform();

  if (response.status === 401 && !isAuthEndpoint(endpoint)) {
    const refreshed = await refreshSession();

    if (!refreshed) {
      redirectToLogin();
      throw new Error('Your session has expired. Please sign in again.');
    }

    response = await perform();
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      errorData.error ||
      errorData.message ||
      `Request failed with status ${response.status}`;
    const error = new Error(
      Array.isArray(message) ? message.join(', ') : String(message),
    ) as Error & { status?: number; details?: unknown };
    error.status = response.status;
    error.details = errorData;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function showConnectionIssue(): void {
  const main = document.querySelector('.content-display');
  if (!main || document.getElementById('connection-issue')) return;

  const panel = document.createElement('section');
  panel.className = 'connection-issue';
  panel.id = 'connection-issue';
  panel.innerHTML = `
    <span class="connection-issue__eyebrow">Server connection unavailable</span>
    <h2>SchoolBook can't reach its server.</h2>
    <p>Check that the SchoolBook API is running, then reload this page.</p>
    <div class="connection-issue__steps">
      <code>cd backend &amp;&amp; npm run start:prod</code>
      <span>Then visit</span>
      <a href="/app">/app</a>
    </div>
  `;
  main.prepend(panel);
}
