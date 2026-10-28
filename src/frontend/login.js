"use strict";
(() => {
  // src/frontend/ts/login.ts
  var API_BASE = window.location.protocol === "file:" ? "http://localhost:3100" : "";
  var alertBox = document.getElementById("login-alert");
  var alertText = document.getElementById("login-alert-text");
  var alertIcon = document.getElementById("login-alert-icon");
  var form = document.getElementById("login-form");
  var tenantInput = document.getElementById("tenant-slug");
  var emailInput = document.getElementById("email");
  var passwordInput = document.getElementById("password");
  var submitButton = document.getElementById("login-submit");
  var submitLabel = document.getElementById("login-submit-label");
  var togglePassword = document.getElementById("toggle-password");
  var googleSection = document.getElementById("google-section");
  var googleLink = document.getElementById("google-login");
  var resetDialog = document.getElementById("reset-dialog");
  var resetForm = document.getElementById("reset-form");
  var resetEmail = document.getElementById("reset-email");
  var resetAlert = document.getElementById("reset-alert");
  var resetAlertText = document.getElementById("reset-alert-text");
  var resetAlertIcon = document.getElementById("reset-alert-icon");
  var resetSubmit = document.getElementById("reset-submit");
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function showAlert(kind, message, target = "login") {
    const box = target === "login" ? alertBox : resetAlert;
    const text = target === "login" ? alertText : resetAlertText;
    const icon = target === "login" ? alertIcon : resetAlertIcon;
    if (!box || !text) return;
    box.className = `auth-alert ${kind}`;
    box.hidden = false;
    if (icon) icon.textContent = kind === "success" ? "\u2713" : kind === "info" ? "i" : "!";
    text.textContent = message;
  }
  function hideAlert(target = "login") {
    const box = target === "login" ? alertBox : resetAlert;
    if (box) box.hidden = true;
  }
  function getNextPath() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "";
    if (next.startsWith("/") && !next.startsWith("//")) {
      return next;
    }
    return "/app";
  }
  function normalizeSlug(value) {
    return value.trim().toLowerCase();
  }
  function setLoading(loading) {
    if (!submitButton || !submitLabel) return;
    submitButton.disabled = loading;
    if (loading) {
      submitLabel.innerHTML = '<span class="spinner" aria-hidden="true"></span> Signing in\u2026';
      submitButton.setAttribute("aria-busy", "true");
    } else {
      submitLabel.textContent = "Sign in";
      submitButton.removeAttribute("aria-busy");
    }
  }
  function setResetLoading(loading) {
    if (!resetSubmit) return;
    resetSubmit.disabled = loading;
    resetSubmit.textContent = loading ? "Sending\u2026" : "Send reset link";
  }
  function friendlyLoginError(status, rawMessage) {
    if (status === 401) {
      return "The school code, email, or password is incorrect. Check your details and try again.";
    }
    if (status === 403) {
      return "This account is inactive or does not have access. Contact your school administrator.";
    }
    if (status === 429) {
      return "Too many sign-in attempts. Wait a minute, then try again.";
    }
    if (status === 400 && rawMessage) {
      return rawMessage;
    }
    if (status >= 500) {
      return "SchoolBook is temporarily unavailable. Please try again in a moment.";
    }
    return rawMessage || "Sign in failed. Check your details and try again.";
  }
  function friendlyOAuthError(code) {
    switch (code) {
      case "google_not_configured":
        return "Google sign-in is not configured for this campus yet. Use your email and password.";
      case "google_failed":
      case "oauth_failed":
      case "access_denied":
        return "Google sign-in could not be completed. Try again or use your email and password.";
      case "account_inactive":
        return "This account is inactive. Contact your school administrator.";
      default:
        return "Sign-in could not be completed. Please try again.";
    }
  }
  async function redirectIfSignedIn() {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      if (response.ok) {
        window.location.replace(getNextPath());
      }
    } catch {
    }
  }
  async function loadProviders() {
    if (!googleSection || !googleLink) return;
    try {
      const response = await fetch(`${API_BASE}/api/auth/providers`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) return;
      const providers = await response.json();
      if (providers.google) {
        googleSection.hidden = false;
        const params = new URLSearchParams(window.location.search);
        const slug = normalizeSlug(tenantInput?.value || params.get("tenant") || "");
        googleLink.href = `${API_BASE}/api/auth/google?tenant=${encodeURIComponent(slug)}`;
      }
      const forgotButton = document.getElementById("forgot-password");
      if (forgotButton) {
        forgotButton.hidden = !providers.passwordReset;
      }
    } catch {
    }
  }
  function openResetDialog() {
    if (!resetDialog) return;
    hideAlert("reset");
    resetDialog.hidden = false;
    document.body.style.overflow = "hidden";
    if (resetEmail && emailInput?.value) {
      resetEmail.value = emailInput.value.trim();
    }
    window.setTimeout(() => resetEmail?.focus(), 30);
  }
  function closeResetDialog() {
    if (!resetDialog) return;
    resetDialog.hidden = true;
    document.body.style.overflow = "";
  }
  function setupThemeToggle() {
    document.documentElement.setAttribute("data-theme", "light");
    return;
    document.documentElement.setAttribute("data-theme", "light");
    try {
      localStorage.removeItem("schoolbook-theme");
    } catch {
    }
  }
  function setupPasswordToggle() {
    if (!togglePassword || !passwordInput) return;
    togglePassword.addEventListener("click", () => {
      const showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      togglePassword.textContent = showing ? "Show" : "Hide";
      togglePassword.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      passwordInput.focus();
    });
  }
  function setupLoginForm() {
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideAlert("login");
      const params = new URLSearchParams(window.location.search);
      const tenantSlug = normalizeSlug(tenantInput?.value || params.get("tenant") || "schoolbook");
      const email = (emailInput?.value || "").trim();
      const password = passwordInput?.value || "";
      if (!EMAIL_PATTERN.test(email)) {
        showAlert("error", "Enter a valid email address.");
        emailInput?.focus();
        return;
      }
      if (!password) {
        showAlert("error", "Enter your password.");
        passwordInput?.focus();
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ tenantSlug, email, password })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const raw = data.error || data.message || "";
          const message = Array.isArray(raw) ? raw.join(", ") : String(raw);
          showAlert("error", friendlyLoginError(response.status, message));
          setLoading(false);
          passwordInput?.focus();
          passwordInput?.select();
          return;
        }
        window.location.replace(getNextPath());
      } catch {
        showAlert(
          "error",
          "SchoolBook could not reach the server. Check your connection and try again."
        );
        setLoading(false);
      }
    });
  }
  function setupResetDialog() {
    document.getElementById("forgot-password")?.addEventListener("click", openResetDialog);
    document.getElementById("reset-cancel")?.addEventListener("click", closeResetDialog);
    resetDialog?.addEventListener("click", (event) => {
      if (event.target === resetDialog) closeResetDialog();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && resetDialog && !resetDialog.hidden) {
        closeResetDialog();
      }
    });
    if (!resetForm) return;
    resetForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideAlert("reset");
      const params = new URLSearchParams(window.location.search);
      const tenantSlug = normalizeSlug(tenantInput?.value || params.get("tenant") || "schoolbook");
      const email = (resetEmail?.value || "").trim();
      if (!EMAIL_PATTERN.test(email)) {
        showAlert("error", "Enter a valid email address.", "reset");
        resetEmail?.focus();
        return;
      }
      setResetLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ tenantSlug, email })
        });
        if (response.status === 429) {
          showAlert(
            "error",
            "Too many reset requests. Wait a minute, then try again.",
            "reset"
          );
          return;
        }
        if (response.status >= 500) {
          showAlert(
            "error",
            "The reset service is temporarily unavailable. Please try again shortly.",
            "reset"
          );
          return;
        }
        showAlert(
          "success",
          "If an account exists for that email, a secure reset link is on its way. Check your inbox and spam folder.",
          "reset"
        );
      } catch {
        showAlert(
          "error",
          "SchoolBook could not reach the server. Check your connection and try again.",
          "reset"
        );
      } finally {
        setResetLoading(false);
      }
    });
  }
  function showQueryMessages() {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error") || params.get("reason");
    const verified = params.get("verified");
    const reset = params.get("reset");
    if (error) {
      showAlert("error", friendlyOAuthError(error));
      return;
    }
    if (verified === "1" || verified === "true") {
      showAlert("success", "Your email address is verified. Sign in to continue.");
      return;
    }
    if (reset === "1" || reset === "true") {
      showAlert("success", "Your password has been reset. Sign in with your new password.");
    }
  }
  function setupGoogle() {
    googleLink?.addEventListener("click", (event) => {
      const slug = normalizeSlug(tenantInput?.value || "");
      if (!slug) {
        event.preventDefault();
        showAlert("error", "Enter your school code before continuing with Google.");
        tenantInput?.focus();
        return;
      }
      googleLink.href = `${API_BASE}/api/auth/google?tenant=${encodeURIComponent(slug)}`;
    });
  }
  var year = document.getElementById("year");
  if (year) year.textContent = String((/* @__PURE__ */ new Date()).getFullYear());
  setupThemeToggle();
  setupPasswordToggle();
  setupLoginForm();
  setupResetDialog();
  setupGoogle();
  showQueryMessages();
  void redirectIfSignedIn();
  void loadProviders();
})();
//# sourceMappingURL=login.js.map
