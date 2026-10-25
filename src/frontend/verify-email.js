"use strict";
(() => {
  // src/frontend/ts/verify-email.ts
  var API_BASE = window.location.protocol === "file:" ? "http://localhost:3100" : "";
  var params = new URLSearchParams(window.location.search);
  var token = params.get("token") || "";
  var tenantSlug = (params.get("tenant") || "").trim().toLowerCase();
  var icon = document.getElementById("status-icon");
  var title = document.getElementById("status-title");
  var message = document.getElementById("status-message");
  var alertBox = document.getElementById("status-alert");
  var alertText = document.getElementById("status-alert-text");
  var alertIcon = document.getElementById("status-alert-icon");
  var action = document.getElementById("status-action");
  function setStatus(kind, heading, body) {
    if (icon) icon.textContent = kind === "success" ? "\u2713" : "!";
    if (title) title.textContent = heading;
    if (message) message.textContent = body;
    if (alertBox && alertText) {
      alertBox.className = `auth-alert ${kind === "success" ? "success" : "error"}`;
      alertBox.hidden = false;
      if (alertIcon) alertIcon.textContent = kind === "success" ? "\u2713" : "!";
      alertText.textContent = body;
    }
    if (message) message.hidden = true;
    if (action) {
      action.style.display = "inline-flex";
      action.textContent = "Continue to sign in";
      action.href = kind === "success" ? "/login?verified=1" : "/login";
    }
  }
  function setupThemeToggle() {
    const button = document.getElementById("theme-toggle");
    const themeIcon = document.getElementById("theme-toggle-icon");
    const sync = () => {
      const theme = document.documentElement.getAttribute("data-theme") || "light";
      if (themeIcon) themeIcon.textContent = theme === "dark" ? "\u2600\uFE0F" : "\u{1F319}";
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
  async function verify() {
    if (!token || !tenantSlug) {
      setStatus(
        "error",
        "This verification link is incomplete",
        "The link is missing its token or school code. Request a new verification email from your administrator."
      );
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/auth/verify-email`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ token, tenantSlug })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const raw = data.error || data.message || "";
        const text = Array.isArray(raw) ? raw.join(", ") : String(raw);
        setStatus(
          "error",
          "We could not verify this email",
          text || "The link may have expired or already been used. Request a new verification email."
        );
        return;
      }
      setStatus(
        "success",
        "Your email is verified",
        "Thanks for confirming your address. You can now sign in to your campus workspace."
      );
    } catch {
      setStatus(
        "error",
        "SchoolBook is unreachable",
        "Check your connection and try this link again in a moment."
      );
    }
  }
  setupThemeToggle();
  void verify();
})();
//# sourceMappingURL=verify-email.js.map
