/**
 * SchoolBook — password reset controller.
 *
 * The reset token is supplied by the email link. It is single-use and is
 * consumed by the API; the browser never stores it beyond this page.
 */

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3100' : '';

const params = new URLSearchParams(window.location.search);
const token = params.get('token') || '';
const tenantSlug = (params.get('tenant') || '').trim().toLowerCase();

const form = document.getElementById('reset-form') as HTMLFormElement | null;
const passwordInput = document.getElementById('new-password') as HTMLInputElement | null;
const confirmInput = document.getElementById('confirm-password') as HTMLInputElement | null;
const submitButton = document.getElementById('reset-submit') as HTMLButtonElement | null;
const togglePassword = document.getElementById('toggle-password') as HTMLButtonElement | null;
const alertBox = document.getElementById('reset-alert') as HTMLDivElement | null;
const alertText = document.getElementById('reset-alert-text');
const alertIcon = document.getElementById('reset-alert-icon');

function showAlert(kind: 'error' | 'success' | 'info', message: string): void {
  if (!alertBox || !alertText) return;
  alertBox.className = `auth-alert ${kind}`;
  alertBox.hidden = false;
  if (alertIcon) alertIcon.textContent = kind === 'success' ? '✓' : kind === 'info' ? 'i' : '!';
  alertText.textContent = message;
}

function disableForm(message: string): void {
  showAlert('error', message);
  if (form) {
    for (const element of Array.from(form.elements)) {
      (element as HTMLInputElement | HTMLButtonElement).disabled = true;
    }
  }
}

function setupThemeToggle(): void {
  const button = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-toggle-icon');

  const sync = (): void => {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
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

function setupPasswordToggle(): void {
  if (!togglePassword || !passwordInput) return;

  togglePassword.addEventListener('click', () => {
    const showing = passwordInput.type === 'text';
    passwordInput.type = showing ? 'password' : 'text';
    togglePassword.classList.toggle('is-showing', !showing);
    togglePassword.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    togglePassword.setAttribute('title', showing ? 'Show password' : 'Hide password');
    passwordInput.focus();
  });
}

function updateSubmitState(): void {
  if (!submitButton || !passwordInput || !confirmInput) return;
  const isReady = passwordInput.value.length >= 8 && confirmInput.value.length >= 8;
  submitButton.disabled = !isReady;
  submitButton.classList.toggle('is-inactive', !isReady);
}

function setLoading(loading: boolean): void {
  if (!submitButton) return;
  submitButton.disabled = loading;
  submitButton.textContent = loading ? 'Updating…' : 'Update password';
  if (loading) {
    submitButton.classList.remove('is-inactive');
  } else {
    updateSubmitState();
  }
}

if (!token || !tenantSlug) {
  disableForm('This reset link is incomplete. Request a new password reset from the sign-in page.');
} else if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const password = passwordInput?.value || '';
    const confirmation = confirmInput?.value || '';

    if (password.length < 8) {
      showAlert('error', 'Your new password must be at least 8 characters long.');
      passwordInput?.focus();
      return;
    }

    if (password !== confirmation) {
      showAlert('error', 'The two passwords do not match.');
      confirmInput?.focus();
      confirmInput?.select();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ token, tenantSlug, password }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string | string[];
        message?: string | string[];
      };

      if (!response.ok) {
        const raw = data.error || data.message || '';
        const message = Array.isArray(raw) ? raw.join(', ') : String(raw);
        showAlert(
          'error',
          message ||
            (response.status === 400
              ? 'This reset link is invalid or has expired. Request a new one.'
              : 'The password could not be updated. Please try again.'),
        );
        setLoading(false);
        return;
      }

      showAlert('success', 'Password updated. Taking you to sign in…');
      window.setTimeout(() => window.location.replace('/login?reset=1'), 1200);
    } catch {
      showAlert(
        'error',
        'SchoolBook could not reach the server. Check your connection and try again.',
      );
      setLoading(false);
    }
  });
}

setupThemeToggle();
setupPasswordToggle();

passwordInput?.addEventListener('input', updateSubmitState);
confirmInput?.addEventListener('input', updateSubmitState);
updateSubmitState();
