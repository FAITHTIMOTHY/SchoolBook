/**
 * SchoolBook SMS - Type-safe API Client
 */

import { state } from './state.js';

export const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

export interface ApiFetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export async function apiFetch<T = any>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-ID': state.activeTenantId,
    'X-User-ID': state.activeUserId,
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function showConnectionIssue(): void {
  const main = document.querySelector('.content-display');
  if (!main || document.getElementById('connection-issue')) return;

  const panel = document.createElement('section');
  panel.className = 'connection-issue';
  panel.id = 'connection-issue';
  panel.innerHTML = `
    <span class="connection-issue__eyebrow">Server connection unavailable</span>
    <h2>SchoolBook can’t reach its local server.</h2>
    <p>Open SchoolBook through the local server to load student records, attendance, campus inventory, and tuition data.</p>
    <div class="connection-issue__steps">
      <code>npm.cmd start</code>
      <span>Then visit</span>
      <a href="http://localhost:3000">http://localhost:3000</a>
    </div>
  `;
  main.prepend(panel);
}
