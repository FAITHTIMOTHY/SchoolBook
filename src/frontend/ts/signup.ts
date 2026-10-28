/**
 * SchoolBook — Registration / Sign Up controller.
 */

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3100' : '';

const alertBox = document.getElementById('signup-alert') as HTMLDivElement | null;
const alertText = document.getElementById('signup-alert-text');
const alertIcon = document.getElementById('signup-alert-icon');
const form = document.getElementById('signup-form') as HTMLFormElement | null;
const schoolInput = document.getElementById('signup-school') as HTMLInputElement | null;
const firstNameInput = document.getElementById('signup-firstname') as HTMLInputElement | null;
const lastNameInput = document.getElementById('signup-lastname') as HTMLInputElement | null;
const emailInput = document.getElementById('signup-email') as HTMLInputElement | null;
const passwordInput = document.getElementById('signup-password') as HTMLInputElement | null;
const submitButton = document.getElementById('signup-submit') as HTMLButtonElement | null;
const submitLabel = document.getElementById('signup-submit-label');
const togglePassword = document.getElementById('toggle-signup-password') as HTMLButtonElement | null;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AlertKind = 'error' | 'success' | 'info';

function showAlert(kind: AlertKind, message: string): void {
  if (!alertBox || !alertText) return;
  alertBox.className = `auth-alert ${kind}`;
  alertBox.hidden = false;
  if (alertIcon) alertIcon.textContent = kind === 'success' ? '✓' : kind === 'info' ? 'i' : '!';
  alertText.textContent = message;
}

function hideAlert(): void {
  if (alertBox) alertBox.hidden = true;
}

function setLoading(loading: boolean): void {
  if (!submitButton || !submitLabel) return;
  submitButton.disabled = loading;
  if (loading) {
    submitLabel.innerHTML = '<span class="spinner" aria-hidden="true"></span> Creating workspace…';
    submitButton.setAttribute('aria-busy', 'true');
  } else {
    submitLabel.textContent = 'Create school workspace';
    submitButton.removeAttribute('aria-busy');
  }
}

function setupPasswordToggle(): void {
  if (!togglePassword || !passwordInput) return;
  togglePassword.addEventListener('click', () => {
    const showing = passwordInput.type === 'text';
    passwordInput.type = showing ? 'password' : 'text';
    togglePassword.textContent = showing ? 'Show' : 'Hide';
    togglePassword.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });
}

function setupSignupForm(): void {
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();

    const schoolName = (schoolInput?.value || '').trim();
    const firstName = (firstNameInput?.value || '').trim();
    const lastName = (lastNameInput?.value || '').trim();
    const email = (emailInput?.value || '').trim();
    const password = passwordInput?.value || '';

    if (!schoolName) {
      showAlert('error', 'Please enter your school or organization name.');
      schoolInput?.focus();
      return;
    }

    if (!firstName || !lastName) {
      showAlert('error', 'Please enter your first and last name.');
      if (!firstName) firstNameInput?.focus();
      else lastNameInput?.focus();
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      showAlert('error', 'Please enter a valid email address.');
      emailInput?.focus();
      return;
    }

    if (password.length < 8) {
      showAlert('error', 'Password must be at least 8 characters long.');
      passwordInput?.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          schoolName,
          firstName,
          lastName,
          email,
          password,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string | string[];
        message?: string | string[];
      };

      if (!response.ok) {
        const raw = data.error || data.message || '';
        const message = Array.isArray(raw) ? raw.join(', ') : String(raw);
        showAlert('error', message || 'Could not complete registration. Please check your details.');
        setLoading(false);
        return;
      }

      showAlert('success', 'Workspace created! Opening your dashboard…');
      window.setTimeout(() => {
        window.location.replace('/app');
      }, 700);
    } catch {
      showAlert('error', 'SchoolBook could not reach the server. Check your connection and try again.');
      setLoading(false);
    }
  });
}

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

document.documentElement.setAttribute('data-theme', 'light');
setupPasswordToggle();
setupSignupForm();
