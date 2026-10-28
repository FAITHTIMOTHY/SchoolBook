"use strict";
(() => {
  // src/frontend/ts/signup.ts
  var API_BASE = window.location.protocol === "file:" ? "http://localhost:3100" : "";
  var alertBox = document.getElementById("signup-alert");
  var alertText = document.getElementById("signup-alert-text");
  var alertIcon = document.getElementById("signup-alert-icon");
  var form = document.getElementById("signup-form");
  var schoolInput = document.getElementById("signup-school");
  var firstNameInput = document.getElementById("signup-firstname");
  var lastNameInput = document.getElementById("signup-lastname");
  var emailInput = document.getElementById("signup-email");
  var passwordInput = document.getElementById("signup-password");
  var submitButton = document.getElementById("signup-submit");
  var submitLabel = document.getElementById("signup-submit-label");
  var togglePassword = document.getElementById("toggle-signup-password");
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function showAlert(kind, message) {
    if (!alertBox || !alertText) return;
    alertBox.className = `auth-alert ${kind}`;
    alertBox.hidden = false;
    if (alertIcon) alertIcon.textContent = kind === "success" ? "\u2713" : kind === "info" ? "i" : "!";
    alertText.textContent = message;
  }
  function hideAlert() {
    if (alertBox) alertBox.hidden = true;
  }
  function setLoading(loading) {
    if (!submitButton || !submitLabel) return;
    submitButton.disabled = loading;
    if (loading) {
      submitLabel.innerHTML = '<span class="spinner" aria-hidden="true"></span> Creating workspace\u2026';
      submitButton.setAttribute("aria-busy", "true");
    } else {
      submitLabel.textContent = "Create school workspace";
      submitButton.removeAttribute("aria-busy");
    }
  }
  function setupPasswordToggle() {
    if (!togglePassword || !passwordInput) return;
    togglePassword.addEventListener("click", () => {
      const showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      togglePassword.textContent = showing ? "Show" : "Hide";
      togglePassword.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    });
  }
  function setupSignupForm() {
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideAlert();
      const schoolName = (schoolInput?.value || "").trim();
      const firstName = (firstNameInput?.value || "").trim();
      const lastName = (lastNameInput?.value || "").trim();
      const email = (emailInput?.value || "").trim();
      const password = passwordInput?.value || "";
      if (!schoolName) {
        showAlert("error", "Please enter your school or organization name.");
        schoolInput?.focus();
        return;
      }
      if (!firstName || !lastName) {
        showAlert("error", "Please enter your first and last name.");
        if (!firstName) firstNameInput?.focus();
        else lastNameInput?.focus();
        return;
      }
      if (!EMAIL_PATTERN.test(email)) {
        showAlert("error", "Please enter a valid email address.");
        emailInput?.focus();
        return;
      }
      if (password.length < 8) {
        showAlert("error", "Password must be at least 8 characters long.");
        passwordInput?.focus();
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/auth/signup`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({
            schoolName,
            firstName,
            lastName,
            email,
            password
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const raw = data.error || data.message || "";
          const message = Array.isArray(raw) ? raw.join(", ") : String(raw);
          showAlert("error", message || "Could not complete registration. Please check your details.");
          setLoading(false);
          return;
        }
        showAlert("success", "Workspace created! Opening your dashboard\u2026");
        window.setTimeout(() => {
          window.location.replace("/app");
        }, 700);
      } catch {
        showAlert("error", "SchoolBook could not reach the server. Check your connection and try again.");
        setLoading(false);
      }
    });
  }
  var year = document.getElementById("year");
  if (year) year.textContent = String((/* @__PURE__ */ new Date()).getFullYear());
  document.documentElement.setAttribute("data-theme", "light");
  setupPasswordToggle();
  setupSignupForm();
})();
//# sourceMappingURL=signup.js.map
