"use strict";
(() => {
  // src/frontend/ts/reset-password.ts
  var API_BASE = window.location.protocol === "file:" ? "http://localhost:3100" : "";
  var params = new URLSearchParams(window.location.search);
  var token = params.get("token") || "";
  var tenantSlug = (params.get("tenant") || "").trim().toLowerCase();
  var form = document.getElementById("reset-form");
  var passwordInput = document.getElementById("new-password");
  var confirmInput = document.getElementById("confirm-password");
  var submitButton = document.getElementById("reset-submit");
  var togglePassword = document.getElementById("toggle-password");
  var alertBox = document.getElementById("reset-alert");
  var alertText = document.getElementById("reset-alert-text");
  var alertIcon = document.getElementById("reset-alert-icon");
  function showAlert(kind, message) {
    if (!alertBox || !alertText) return;
    alertBox.className = `auth-alert ${kind}`;
    alertBox.hidden = false;
    if (alertIcon) alertIcon.textContent = kind === "success" ? "\u2713" : kind === "info" ? "i" : "!";
    alertText.textContent = message;
  }
  function disableForm(message) {
    showAlert("error", message);
    if (form) {
      for (const element of Array.from(form.elements)) {
        element.disabled = true;
      }
    }
  }
  function setupThemeToggle() {
    const button = document.getElementById("theme-toggle");
    const icon = document.getElementById("theme-toggle-icon");
    const sync = () => {
      const theme = document.documentElement.getAttribute("data-theme") || "light";
      if (icon) icon.textContent = theme === "dark" ? "\u2600\uFE0F" : "\u{1F319}";
      button?.setAttribute("title", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    };
    sync();
    button?.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("schoolbook-theme", next);
      } catch {
      }
      sync();
    });
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
  function setLoading(loading) {
    if (!submitButton) return;
    submitButton.disabled = loading;
    submitButton.textContent = loading ? "Updating\u2026" : "Update password";
  }
  if (!token || !tenantSlug) {
    disableForm("This reset link is incomplete. Request a new password reset from the sign-in page.");
  } else if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = passwordInput?.value || "";
      const confirmation = confirmInput?.value || "";
      if (password.length < 8) {
        showAlert("error", "Your new password must be at least 8 characters long.");
        passwordInput?.focus();
        return;
      }
      if (password !== confirmation) {
        showAlert("error", "The two passwords do not match.");
        confirmInput?.focus();
        confirmInput?.select();
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ token, tenantSlug, password })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const raw = data.error || data.message || "";
          const message = Array.isArray(raw) ? raw.join(", ") : String(raw);
          showAlert(
            "error",
            message || (response.status === 400 ? "This reset link is invalid or has expired. Request a new one." : "The password could not be updated. Please try again.")
          );
          setLoading(false);
          return;
        }
        showAlert("success", "Password updated. Taking you to sign in\u2026");
        window.setTimeout(() => window.location.replace("/login?reset=1"), 1200);
      } catch {
        showAlert(
          "error",
          "SchoolBook could not reach the server. Check your connection and try again."
        );
        setLoading(false);
      }
    });
  }
  setupThemeToggle();
  setupPasswordToggle();
})();
//# sourceMappingURL=reset-password.js.map
