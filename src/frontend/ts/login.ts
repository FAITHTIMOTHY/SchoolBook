/**
 * SchoolBook — login controller.
 *
 * Uses the API's HttpOnly cookie session. No access token is ever stored in
 * JavaScript, localStorage, or sessionStorage.
 */

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3100' : '';

const alertBox = document.getElementById('login-alert') as HTMLDivElement | null;
const alertText = document.getElementById('login-alert-text');
const alertIcon = document.getElementById('login-alert-icon');
const form = document.getElementById('login-form') as HTMLFormElement | null;
const tenantInput = document.getElementById('tenant-slug') as HTMLInputElement | null;
const emailInput = document.getElementById('email') as HTMLInputElement | null;
const passwordInput = document.getElementById('password') as HTMLInputElement | null;
const submitButton = document.getElementById('login-submit') as HTMLButtonElement | null;
const submitLabel = document.getElementById('login-submit-label');
const togglePassword = document.getElementById('toggle-password') as HTMLButtonElement | null;
const googleSection = document.getElementById('google-section');
const googleLink = document.getElementById('google-login') as HTMLAnchorElement | null;

const resetDialog = document.getElementById('reset-dialog');
const resetForm = document.getElementById('reset-form') as HTMLFormElement | null;
const resetEmail = document.getElementById('reset-email') as HTMLInputElement | null;
const resetAlert = document.getElementById('reset-alert');
const resetAlertText = document.getElementById('reset-alert-text');
const resetAlertIcon = document.getElementById('reset-alert-icon');
const resetSubmit = document.getElementById('reset-submit') as HTMLButtonElement | null;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AlertKind = 'error' | 'success' | 'info';

function showAlert(
  kind: AlertKind,
  message: string,
  target: 'login' | 'reset' = 'login',
): void {
  const box = target === 'login' ? alertBox : (resetAlert as HTMLDivElement | null);
  const text = target === 'login' ? alertText : resetAlertText;
  const icon = target === 'login' ? alertIcon : resetAlertIcon;

  if (!box || !text) return;

  box.className = `auth-alert ${kind}`;
  box.hidden = false;
  if (icon) icon.textContent = kind === 'success' ? '✓' : kind === 'info' ? 'i' : '!';
  text.textContent = message;
}

function hideAlert(target: 'login' | 'reset' = 'login'): void {
  const box = target === 'login' ? alertBox : resetAlert;
  if (box) box.hidden = true;
}

function getNextPath(): string {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || '';

  // Only allow same-origin absolute paths. Reject protocol-relative URLs.
  if (next.startsWith('/') && !next.startsWith('//')) {
    return next;
  }

  return '/app';
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function setLoading(loading: boolean): void {
  if (!submitButton || !submitLabel) return;

  submitButton.disabled = loading;
  if (loading) {
    submitLabel.innerHTML = '<span class="spinner" aria-hidden="true"></span> Signing in…';
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.classList.remove('is-inactive');
  } else {
    submitLabel.textContent = 'Sign in';
    submitButton.removeAttribute('aria-busy');
    updateSubmitState();
  }
}

function setResetLoading(loading: boolean): void {
  if (!resetSubmit) return;
  resetSubmit.disabled = loading;
  resetSubmit.textContent = loading ? 'Sending…' : 'Send reset link';
}

function friendlyLoginError(status: number, rawMessage: string): string {
  if (status === 401) {
    return 'The school code, email, or password is incorrect. Check your details and try again.';
  }
  if (status === 403) {
    return 'This account is inactive or does not have access. Contact your school administrator.';
  }
  if (status === 429) {
    return 'Too many sign-in attempts. Wait a minute, then try again.';
  }
  if (status === 400 && rawMessage) {
    return rawMessage;
  }
  if (status >= 500) {
    return 'SchoolBook is temporarily unavailable. Please try again in a moment.';
  }
  return rawMessage || 'Sign in failed. Check your details and try again.';
}

function friendlyOAuthError(code: string): string {
  switch (code) {
    case 'google_not_configured':
      return 'Google sign-in is not configured for this campus yet. Use your email and password.';
    case 'google_failed':
    case 'oauth_failed':
    case 'access_denied':
      return 'Google sign-in could not be completed. Try again or use your email and password.';
    case 'account_inactive':
      return 'This account is inactive. Contact your school administrator.';
    default:
      return 'Sign-in could not be completed. Please try again.';
  }
}

async function redirectIfSignedIn(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (response.ok) {
      window.location.replace(getNextPath());
    }
  } catch {
    // The login form remains available when the API is unreachable.
  }
}

async function loadProviders(): Promise<void> {
  if (!googleSection || !googleLink) return;

  try {
    const response = await fetch(`${API_BASE}/api/auth/providers`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return;

    const providers = (await response.json()) as {
      google?: boolean;
      passwordReset?: boolean;
    };

    if (providers.google) {
      googleSection.hidden = false;

      const params = new URLSearchParams(window.location.search);
      const slug = normalizeSlug(tenantInput?.value || params.get('tenant') || '');
      googleLink.href = `${API_BASE}/api/auth/google?tenant=${encodeURIComponent(slug)}`;
    }

    const forgotButton = document.getElementById('forgot-password');
    if (forgotButton) {
      forgotButton.hidden = !providers.passwordReset;
    }
  } catch {
    // Password sign-in is still available.
  }
}

function openResetDialog(): void {
  if (!resetDialog) return;

  hideAlert('reset');
  resetDialog.hidden = false;
  document.body.style.overflow = 'hidden';

  if (resetEmail && emailInput?.value) {
    resetEmail.value = emailInput.value.trim();
  }

  window.setTimeout(() => resetEmail?.focus(), 30);
}

function closeResetDialog(): void {
  if (!resetDialog) return;
  resetDialog.hidden = true;
  document.body.style.overflow = '';
}

function setupThemeToggle(): void {
  // Locked to light theme
  document.documentElement.setAttribute('data-theme', 'light');
  return;
  document.documentElement.setAttribute("data-theme", "light");
  try {
    localStorage.removeItem("schoolbook-theme");
  } catch {}
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
  if (!submitButton || !emailInput || !passwordInput) return;
  const isReady = Boolean(emailInput.value.trim()) && Boolean(passwordInput.value);
  submitButton.disabled = !isReady;
  submitButton.classList.toggle('is-inactive', !isReady);
}

function setupLoginForm(): void {
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert('login');

    const params = new URLSearchParams(window.location.search);
    const tenantSlug = normalizeSlug(tenantInput?.value || params.get('tenant') || 'schoolbook');
    const email = (emailInput?.value || '').trim();
    const password = passwordInput?.value || '';

    if (!EMAIL_PATTERN.test(email)) {
      showAlert('error', 'Enter a valid email address.');
      emailInput?.focus();
      return;
    }

    if (!password) {
      showAlert('error', 'Enter your password.');
      passwordInput?.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ tenantSlug, email, password }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string | string[];
        message?: string | string[];
      };

      if (!response.ok) {
        const raw = data.error || data.message || '';
        const message = Array.isArray(raw) ? raw.join(', ') : String(raw);
        showAlert('error', friendlyLoginError(response.status, message));
        setLoading(false);
        passwordInput?.focus();
        passwordInput?.select();
        return;
      }

      window.location.replace(getNextPath());
    } catch {
      showAlert(
        'error',
        'SchoolBook could not reach the server. Check your connection and try again.',
      );
      setLoading(false);
    }
  });
}

function setupResetDialog(): void {
  document.getElementById('forgot-password')?.addEventListener('click', openResetDialog);
  document.getElementById('reset-cancel')?.addEventListener('click', closeResetDialog);

  resetDialog?.addEventListener('click', (event) => {
    if (event.target === resetDialog) closeResetDialog();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && resetDialog && !resetDialog.hidden) {
      closeResetDialog();
    }
  });

  if (!resetForm) return;

  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert('reset');

    const params = new URLSearchParams(window.location.search);
    const tenantSlug = normalizeSlug(tenantInput?.value || params.get('tenant') || 'schoolbook');
    const email = (resetEmail?.value || '').trim();

    if (!EMAIL_PATTERN.test(email)) {
      showAlert('error', 'Enter a valid email address.', 'reset');
      resetEmail?.focus();
      return;
    }

    setResetLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ tenantSlug, email }),
      });

      if (response.status === 429) {
        showAlert(
          'error',
          'Too many reset requests. Wait a minute, then try again.',
          'reset',
        );
        return;
      }

      if (response.status >= 500) {
        showAlert(
          'error',
          'The reset service is temporarily unavailable. Please try again shortly.',
          'reset',
        );
        return;
      }

      showAlert(
        'success',
        'If an account exists for that email, a secure reset link is on its way. Check your inbox and spam folder.',
        'reset',
      );
    } catch {
      showAlert(
        'error',
        'SchoolBook could not reach the server. Check your connection and try again.',
        'reset',
      );
    } finally {
      setResetLoading(false);
    }
  });
}

function showQueryMessages(): void {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error') || params.get('reason');
  const verified = params.get('verified');
  const reset = params.get('reset');

  if (error) {
    showAlert('error', friendlyOAuthError(error));
    return;
  }

  if (verified === '1' || verified === 'true') {
    showAlert('success', 'Your email address is verified. Sign in to continue.');
    return;
  }

  if (reset === '1' || reset === 'true') {
    showAlert('success', 'Your password has been reset. Sign in with your new password.');
  }
}

function setupGoogle(): void {
  googleLink?.addEventListener('click', (event) => {
    const slug = normalizeSlug(tenantInput?.value || '');
    if (!slug) {
      event.preventDefault();
      showAlert('error', 'Enter your school code before continuing with Google.');
      tenantInput?.focus();
      return;
    }

    googleLink.href = `${API_BASE}/api/auth/google?tenant=${encodeURIComponent(slug)}`;
  });
}

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

setupThemeToggle();
setupPasswordToggle();
setupLoginForm();
setupResetDialog();
setupGoogle();
showQueryMessages();
emailInput?.addEventListener('input', updateSubmitState);
passwordInput?.addEventListener('input', updateSubmitState);
updateSubmitState();
void redirectIfSignedIn();
void loadProviders();
