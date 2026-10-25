/**
 * SchoolBook — email verification controller.
 */

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3100' : '';

const params = new URLSearchParams(window.location.search);
const token = params.get('token') || '';
const tenantSlug = (params.get('tenant') || '').trim().toLowerCase();

const icon = document.getElementById('status-icon');
const title = document.getElementById('status-title');
const message = document.getElementById('status-message');
const alertBox = document.getElementById('status-alert') as HTMLDivElement | null;
const alertText = document.getElementById('status-alert-text');
const alertIcon = document.getElementById('status-alert-icon');
const action = document.getElementById('status-action') as HTMLAnchorElement | null;

function setStatus(kind: 'success' | 'error', heading: string, body: string): void {
  if (icon) icon.textContent = kind === 'success' ? '✓' : '!';
  if (title) title.textContent = heading;
  if (message) message.textContent = body;

  if (alertBox && alertText) {
    alertBox.className = `auth-alert ${kind === 'success' ? 'success' : 'error'}`;
    alertBox.hidden = false;
    if (alertIcon) alertIcon.textContent = kind === 'success' ? '✓' : '!';
    alertText.textContent = body;
  }

  if (message) message.hidden = true;
  if (action) {
    action.style.display = 'inline-flex';
    action.textContent = 'Continue to sign in';
    action.href = kind === 'success' ? '/login?verified=1' : '/login';
  }
}

function setupThemeToggle(): void {
  const button = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-toggle-icon');

  const sync = (): void => {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    if (themeIcon) themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    button?.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  };

  sync();

  button?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);

    try {
      localStorage.setItem('schoolbook-theme', next);
    } catch {
      // ignore storage restrictions
    }

    sync();
  });
}

async function verify(): Promise<void> {
  if (!token || !tenantSlug) {
    setStatus(
      'error',
      'This verification link is incomplete',
      'The link is missing its token or school code. Request a new verification email from your administrator.',
    );
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/verify-email`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ token, tenantSlug }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string | string[];
      message?: string | string[];
    };

    if (!response.ok) {
      const raw = data.error || data.message || '';
      const text = Array.isArray(raw) ? raw.join(', ') : String(raw);
      setStatus(
        'error',
        'We could not verify this email',
        text || 'The link may have expired or already been used. Request a new verification email.',
      );
      return;
    }

    setStatus(
      'success',
      'Your email is verified',
      'Thanks for confirming your address. You can now sign in to your campus workspace.',
    );
  } catch {
    setStatus(
      'error',
      'SchoolBook is unreachable',
      'Check your connection and try this link again in a moment.',
    );
  }
}

setupThemeToggle();
void verify();
