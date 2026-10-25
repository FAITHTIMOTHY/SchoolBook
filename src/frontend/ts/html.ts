/**
 * HTML escaping helpers.
 *
 * The legacy UI renders API data with template strings. Every value that
 * originates from a user (names, remarks, item descriptions, broadcast bodies)
 * must pass through one of these helpers before it reaches innerHTML.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"'`]/g,
    (character) => HTML_ESCAPES[character] ?? character,
  );
}

export function escapeAttribute(value: unknown): string {
  return escapeHtml(value);
}

const DEFAULT_AVATAR = '/avatar-default.svg';

export function safeImageUrl(value: unknown): string {
  const raw = String(value ?? '').trim();

  if (!raw) return DEFAULT_AVATAR;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;

  try {
    const url = new URL(raw, window.location.origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href;
    }
  } catch {
    // Fall through to the local default.
  }

  return DEFAULT_AVATAR;
}

export function safeHref(value: unknown, fallback = '#'): string {
  const raw = String(value ?? '').trim();

  if (!raw) return fallback;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (raw.startsWith('#')) return raw;

  try {
    const url = new URL(raw, window.location.origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href;
    }
  } catch {
    // Fall through to the safe fallback.
  }

  return fallback;
}
