"use strict";
(() => {
  // src/frontend/ts/state.ts
  var UNIT_LABELS = {
    "unit_oak_admin": "Principal's Office & Administration",
    "unit_oak_sciences": "Faculty of Science & STEM",
    "unit_oak_humanities": "Faculty of Humanities & Arts",
    "unit_oak_grade10": "Grade 10 - Class A (Sophomores)",
    "unit_oak_grade11": "Grade 11 - Class A (Juniors)",
    "unit_oak_counseling": "Student Affairs & Counseling",
    "unit_oak_bursar": "Bursar & Finance Office",
    "unit_oak_athletics": "Athletics & Physical Education",
    "unit_maple_admin": "Headmaster's Office",
    "unit_maple_faculty": "Teaching Faculty",
    "unit_maple_bursar": "Accounts & Bursar Department"
  };
  var ApplicationState = class {
    activeTenantId = "";
    activeUserId = "";
    activeUser = null;
    activeTab = "overview";
    tenantsList = [];
    unitsList = [];
    unitLabels = {};
    setUnits(units) {
      this.unitsList = units;
      this.unitLabels = {};
      for (const unit of units) {
        this.unitLabels[unit.id] = unit.name;
      }
    }
    getUnitLabel(unitId) {
      if (!unitId) return "No Class / Faculty Assigned";
      return this.unitLabels[unitId] || UNIT_LABELS[unitId] || "Department / Faculty";
    }
    isPrincipal() {
      return this.activeUser?.role === "Principal";
    }
    isLeader() {
      return this.isPrincipal();
    }
    isFinanceStaff() {
      const position = (this.activeUser?.position || "").toLowerCase();
      const unit = this.getUnitLabel(this.activeUser?.unit_id).toLowerCase();
      return position.includes("account") || position.includes("bursar") || position.includes("finance") || unit.includes("finance") || unit.includes("bursar") || unit.includes("account");
    }
    isLibrarian() {
      const position = (this.activeUser?.position || "").toLowerCase();
      const unit = this.getUnitLabel(this.activeUser?.unit_id).toLowerCase();
      return position.includes("librarian") || position.includes("library") || unit.includes("library") || unit.includes("librarian");
    }
    isTeacherOrPrincipal() {
      if (this.isFinanceStaff() || this.isLibrarian()) return false;
      const role = this.activeUser?.role;
      return role === "Teacher" || role === "Principal" || role === "Counselor";
    }
    canViewPortal() {
      return !this.isFinanceStaff();
    }
    canRegisterMembers() {
      return this.isPrincipal();
    }
    canAccessFinance() {
      return this.isPrincipal() || this.isFinanceStaff();
    }
    canEditPortal() {
      return this.isTeacherOrPrincipal();
    }
    canBrowsePortals() {
      return this.canEditPortal() || this.isLibrarian();
    }
    canBroadcast() {
      return this.isTeacherOrPrincipal();
    }
    isStudent() {
      return this.activeUser?.role === "Student";
    }
    isAuthorizedToEditInventory() {
      if (this.isFinanceStaff()) return false;
      return this.isTeacherOrPrincipal() || this.isLibrarian();
    }
  };
  var state = new ApplicationState();

  // src/frontend/ts/api.ts
  var API_BASE = window.location.protocol === "file:" ? "http://localhost:3100" : "";
  var refreshInFlight = null;
  function isAuthEndpoint(endpoint) {
    return endpoint === "/api/auth/login" || endpoint === "/api/auth/refresh";
  }
  async function refreshSession() {
    if (!refreshInFlight) {
      refreshInFlight = fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      }).then((response) => response.ok).catch(() => false).finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }
  function redirectToLogin() {
    if (window.location.pathname === "/login") {
      return;
    }
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }
  async function apiFetch(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...options.headers || {}
    };
    const perform = () => fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: "include"
    });
    let response = await perform();
    if (response.status === 401 && !isAuthEndpoint(endpoint)) {
      const refreshed = await refreshSession();
      if (!refreshed) {
        redirectToLogin();
        throw new Error("Your session has expired. Please sign in again.");
      }
      response = await perform();
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error || errorData.message || `Request failed with status ${response.status}`;
      const error = new Error(
        Array.isArray(message) ? message.join(", ") : String(message)
      );
      error.status = response.status;
      error.details = errorData;
      throw error;
    }
    if (response.status === 204) {
      return void 0;
    }
    return await response.json();
  }
  function showConnectionIssue() {
    const main = document.querySelector(".content-display");
    if (!main || document.getElementById("connection-issue")) return;
    const panel = document.createElement("section");
    panel.className = "connection-issue";
    panel.id = "connection-issue";
    panel.innerHTML = `
    <span class="connection-issue__eyebrow">Server connection unavailable</span>
    <h2>SchoolBook can't reach its server.</h2>
    <p>Check that the SchoolBook API is running, then reload this page.</p>
    <div class="connection-issue__steps">
      <code>cd backend &amp;&amp; npm run start:prod</code>
      <span>Then visit</span>
      <a href="/app">/app</a>
    </div>
  `;
    main.prepend(panel);
  }

  // src/frontend/ts/rbac.ts
  function applyRBACStyling() {
    if (!state.activeUser) return;
    const role = state.activeUser.role;
    const setTabVisible = (tab, visible) => {
      const button = document.querySelector(
        `.nav-btn[data-tab="${tab}"]`
      );
      if (button) button.style.display = visible ? "" : "none";
    };
    const studentView = state.isStudent();
    setTabVisible("portal", state.canViewPortal());
    setTabVisible("members", !studentView);
    setTabVisible("attendance", state.isTeacherOrPrincipal());
    setTabVisible("inventory", !studentView);
    setTabVisible("financials", !studentView);
    setTabVisible("broadcast", true);
    const btnOpenMemberModal = document.getElementById("btn-open-member-modal");
    if (btnOpenMemberModal) {
      btnOpenMemberModal.style.display = state.canRegisterMembers() ? "block" : "none";
    }
    const attBanner = document.getElementById("attendance-restricted-banner");
    const attCloseBtn = document.getElementById("btn-close-service");
    const isTeacherOrPrincipal = state.isTeacherOrPrincipal();
    if (attBanner) {
      attBanner.style.display = isTeacherOrPrincipal ? "none" : "block";
    }
    if (attCloseBtn) {
      attCloseBtn.style.display = isTeacherOrPrincipal ? "inline-flex" : "none";
    }
    const btnOpenInventoryModal = document.getElementById("btn-open-inventory-modal");
    if (btnOpenInventoryModal) {
      btnOpenInventoryModal.style.display = state.isAuthorizedToEditInventory() ? "block" : "none";
    }
    const invBanner = document.getElementById("inventory-restricted-banner");
    if (invBanner) {
      invBanner.style.display = state.isAuthorizedToEditInventory() ? "none" : "block";
    }
    const auditPanel = document.getElementById("finance-audit-panel");
    const deniedPanel = document.getElementById("finance-denied-panel");
    const canAccessFinance = state.canAccessFinance();
    if (auditPanel) {
      auditPanel.style.display = canAccessFinance ? "block" : "none";
    }
    if (deniedPanel) {
      deniedPanel.style.display = canAccessFinance ? "none" : "flex";
    }
    const broadcastArea = document.getElementById("broadcast-content-area");
    const broadcastBanner = document.getElementById("broadcast-restricted-banner");
    const canBroadcast = state.canBroadcast();
    if (canBroadcast) {
      if (broadcastArea) broadcastArea.style.display = "flex";
      if (broadcastBanner) broadcastBanner.style.display = "none";
      const targetSelect = document.getElementById("bc-target");
      const unitGroup = document.getElementById("bc-unit-group");
      if (targetSelect && unitGroup) {
        if (role === "Principal" || role === "Teacher") {
          if (targetSelect.options[0]) targetSelect.options[0].disabled = false;
          unitGroup.style.display = targetSelect.value === "unit" ? "block" : "none";
        } else {
          targetSelect.value = "unit";
          if (targetSelect.options[0]) targetSelect.options[0].disabled = true;
          unitGroup.style.display = "block";
        }
      }
    } else {
      if (broadcastArea) broadcastArea.style.display = "none";
      if (broadcastBanner) broadcastBanner.style.display = "block";
    }
    const portalEditBar = document.getElementById("portal-editor-controls");
    const portalReadOnlyBanner = document.getElementById("portal-readonly-banner");
    const portalStudentSelector = document.getElementById("portal-student-selector-wrap");
    const canEditPortal = state.canEditPortal();
    if (portalEditBar) {
      portalEditBar.style.display = canEditPortal ? "flex" : "none";
    }
    if (portalReadOnlyBanner) {
      portalReadOnlyBanner.style.display = canEditPortal ? "none" : "flex";
    }
    if (portalStudentSelector) {
      portalStudentSelector.style.display = canEditPortal ? "block" : "none";
    }
  }

  // src/frontend/ts/html.ts
  var HTML_ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "`": "&#96;"
  };
  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"'`]/g,
      (character) => HTML_ESCAPES[character] ?? character
    );
  }
  function escapeAttribute(value) {
    return escapeHtml(value);
  }
  var DEFAULT_AVATAR = "/avatar-default.svg";
  function safeImageUrl(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return DEFAULT_AVATAR;
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    try {
      const url = new URL(raw, window.location.origin);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.href;
      }
    } catch {
    }
    return DEFAULT_AVATAR;
  }

  // src/frontend/ts/tabs/overviewTab.ts
  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }
  function formatMoney(value) {
    return `$${Number(value || 0).toLocaleString(void 0, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }
  async function loadOverviewData() {
    const welcome = document.getElementById("overview-welcome");
    if (welcome) {
      welcome.textContent = `Active academic context: ${state.activeUser?.name || "Loading"} (${state.activeUser?.position || ""})`;
    }
    let members = [];
    try {
      members = await apiFetch("/api/members");
    } catch (error) {
      console.error("Failed loading member overview:", error);
      setText("overview-welcome", "Campus overview is temporarily unavailable.");
      return;
    }
    const students = members.filter((member) => member.role === "Student");
    const total = students.length;
    const active = students.filter(
      (student) => student.status === "Active"
    ).length;
    const activeRatio = total > 0 ? Math.round(active / total * 100) : 0;
    setText("kpi-total-members", String(total));
    setText("kpi-active-members", String(active));
    setText("overview-active-ratio", `${activeRatio}%`);
    await Promise.allSettled([loadFinanceCard(), loadAttendanceCard()]);
    const subjectResult = await loadSubjectAverages();
    renderPerformanceStatistics(
      members,
      subjectResult.averages,
      subjectResult.message
    );
  }
  async function loadFinanceCard() {
    if (!state.canAccessFinance()) {
      setText("kpi-finance-totals", "Restricted");
      setText("overview-finance-forecast", "Restricted");
      setText(
        "overview-projection-status",
        "Vault Locked (Principal/Bursar Only)"
      );
      renderFinancialBars(null);
      return;
    }
    try {
      const financeData = await apiFetch(
        "/api/financials/projections"
      );
      setText("kpi-finance-totals", formatMoney(financeData.summary.Total));
      setText(
        "overview-finance-forecast",
        formatMoney(financeData.projectedNextWeek)
      );
      setText(
        "overview-projection-status",
        `Avg Weekly Fee Flow: ${financeData.growthRatePercent}%`
      );
      renderFinancialBars(financeData.summary);
    } catch (error) {
      console.error("Failed loading finance overview:", error);
      setText("kpi-finance-totals", "Unavailable");
      setText("overview-finance-forecast", "Unavailable");
      setText(
        "overview-projection-status",
        "Finance data temporarily unavailable"
      );
      renderFinancialBars(
        null,
        "Finance data is temporarily unavailable. Try again shortly."
      );
    }
  }
  async function loadAttendanceCard() {
    if (!state.isTeacherOrPrincipal()) {
      setText("kpi-attendance-avg", "Restricted");
      renderAttendanceTrendChart(
        [],
        "Attendance insights are restricted to academic staff."
      );
      renderRecentServices(
        [],
        "Attendance registers are restricted to academic staff."
      );
      return;
    }
    try {
      const stats = await apiFetch(
        "/api/attendance/stats"
      );
      setText("kpi-attendance-avg", `${stats.avgAttendanceRate}%`);
      renderAttendanceTrendChart(stats.recentServices);
      renderRecentServices(stats.recentServices);
    } catch (error) {
      console.error("Failed loading attendance overview:", error);
      setText("kpi-attendance-avg", "Unavailable");
      renderAttendanceTrendChart(
        [],
        "Attendance data is temporarily unavailable."
      );
      renderRecentServices([], "Attendance data is temporarily unavailable.");
    }
  }
  async function loadSubjectAverages() {
    if (state.isFinanceStaff()) {
      return {
        averages: [],
        message: "Subject breakdown is available to academic staff."
      };
    }
    try {
      const portals = await apiFetch("/api/portal");
      if (!Array.isArray(portals) || portals.length === 0) {
        return { averages: [], message: "No published grades yet." };
      }
      const totals = /* @__PURE__ */ new Map();
      for (const portal of portals) {
        const grades = Array.isArray(portal.grades) ? portal.grades : [];
        for (const grade of grades) {
          if (!grade || typeof grade.subject !== "string" || typeof grade.score !== "number" || !Number.isFinite(grade.score)) {
            continue;
          }
          const current = totals.get(grade.subject) ?? { total: 0, count: 0 };
          current.total += grade.score;
          current.count += 1;
          totals.set(grade.subject, current);
        }
      }
      const averages = [...totals.entries()].map(([name, value]) => ({
        name,
        score: value.count > 0 ? Math.round(value.total / value.count) : 0
      })).sort((left, right) => right.score - left.score).slice(0, 5);
      return {
        averages,
        message: averages.length > 0 ? "" : "No published grades yet."
      };
    } catch (error) {
      console.error("Failed loading subject overview:", error);
      return {
        averages: [],
        message: "Subject breakdown is temporarily unavailable."
      };
    }
  }
  function renderPerformanceStatistics(members, subjectAverages, subjectMessage) {
    const students = members.filter((member) => member.role === "Student");
    const scored = students.filter(
      (student) => typeof student.academic_score === "number" && Number.isFinite(student.academic_score)
    );
    const total = scored.length;
    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;
    for (const student of scored) {
      const score = student.academic_score;
      if (score > 70) greenCount += 1;
      else if (score >= 50) yellowCount += 1;
      else redCount += 1;
    }
    const greenPct = total > 0 ? Math.round(greenCount / total * 100) : 0;
    const yellowPct = total > 0 ? Math.round(yellowCount / total * 100) : 0;
    const redPct = total > 0 ? Math.max(0, 100 - greenPct - yellowPct) : 0;
    const elBarGreen = document.getElementById("stat-bar-green");
    const elBarYellow = document.getElementById("stat-bar-yellow");
    const elBarRed = document.getElementById("stat-bar-red");
    if (elBarGreen) {
      elBarGreen.style.width = `${greenPct}%`;
      elBarGreen.title = `Green Tier (>70%): ${greenCount} Students (${greenPct}%)`;
    }
    if (elBarYellow) {
      elBarYellow.style.width = `${yellowPct}%`;
      elBarYellow.title = `Yellow Tier (50-69%): ${yellowCount} Students (${yellowPct}%)`;
    }
    if (elBarRed) {
      elBarRed.style.width = `${redPct}%`;
      elBarRed.title = `Red Tier (<50%): ${redCount} Students (${redPct}%)`;
    }
    const elGreenCount = document.getElementById("stat-count-green");
    const elYellowCount = document.getElementById("stat-count-yellow");
    const elRedCount = document.getElementById("stat-count-red");
    if (elGreenCount) {
      elGreenCount.innerHTML = `<span class="perf-circle perf-green"></span> <strong>${greenCount}</strong> (${greenPct}%)`;
    }
    if (elYellowCount) {
      elYellowCount.innerHTML = `<span class="perf-circle perf-yellow"></span> <strong>${yellowCount}</strong> (${yellowPct}%)`;
    }
    if (elRedCount) {
      elRedCount.innerHTML = `<span class="perf-circle perf-red"></span> <strong>${redCount}</strong> (${redPct}%)`;
    }
    const subjectBarsContainer = document.getElementById("stat-subject-bars");
    if (subjectBarsContainer) {
      if (subjectAverages.length === 0) {
        subjectBarsContainer.innerHTML = `
        <div class="p-2 text-center text-muted" style="font-size:0.85rem">
          ${escapeHtml(subjectMessage || "No published grades yet.")}
        </div>
      `;
      } else {
        subjectBarsContainer.innerHTML = subjectAverages.map((subject) => {
          const score = Math.max(0, Math.min(100, subject.score));
          const color = score > 70 ? "#2f9e44" : score >= 50 ? "#f08c00" : "#e03131";
          return `
            <div class="subject-bar-row">
              <div class="subject-bar-meta">
                <span class="subject-title">${escapeHtml(subject.name)}</span>
                <span class="subject-val"><strong>${score}%</strong></span>
              </div>
              <div class="stat-progress-track">
                <div class="stat-progress-fill" style="width: ${score}%; background: ${color};"></div>
              </div>
            </div>
          `;
        }).join("");
      }
    }
  }
  function renderAttendanceTrendChart(services, emptyMessage = "No attendance sessions recorded yet.") {
    const chartContainer = document.getElementById("stat-attendance-chart");
    if (!chartContainer) return;
    if (!services || services.length === 0) {
      chartContainer.innerHTML = `
      <div class="p-2 text-center text-muted" style="font-size:0.85rem">
        ${escapeHtml(emptyMessage)}
      </div>
    `;
      return;
    }
    const chronological = [...services].slice(0, 5).reverse();
    chartContainer.innerHTML = chronological.map((service) => {
      const rate = Math.max(0, Math.min(100, Number(service.rate) || 0));
      const date = /* @__PURE__ */ new Date(`${service.date}T00:00:00.000Z`);
      const day = Number.isNaN(date.getTime()) ? service.date : date.toLocaleDateString(void 0, { weekday: "short" });
      return `
        <div class="chart-vertical-col" title="${escapeHtml(service.date)} \xB7 ${escapeHtml(service.name)}: ${service.present}/${service.total} present">
          <span class="chart-bar-val">${rate}%</span>
          <div class="chart-bar-pillar-wrap">
            <div class="chart-bar-pillar" style="height: ${Math.max(2, rate)}%; background: var(--notion-blue);"></div>
          </div>
          <span class="chart-bar-day">${escapeHtml(day)}</span>
        </div>
      `;
    }).join("");
  }
  function renderRecentServices(services, emptyMessage = "No attendance sessions recorded yet.") {
    const tbody = document.getElementById("overview-services-tbody");
    if (!tbody) return;
    if (!services || services.length === 0) {
      tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted">${escapeHtml(emptyMessage)}</td>
      </tr>
    `;
      return;
    }
    tbody.innerHTML = services.map((service) => {
      const isOpen = service.status === "Open";
      return `
        <tr>
          <td><strong>${escapeHtml(service.name)}</strong></td>
          <td>${escapeHtml(service.date)}</td>
          <td>${service.present}/${service.total} <span class="text-muted">(${service.rate}%)</span></td>
          <td><span class="notion-tag ${isOpen ? "tag-blue" : "tag-green"}">${isOpen ? "\u25CF Open" : "\u2713 Closed"}</span></td>
        </tr>
      `;
    }).join("");
  }
  function renderFinancialBars(summary, emptyMessage = "Financial fee breakdown is restricted to the Principal and Bursar.") {
    const container = document.getElementById("stat-financial-bars");
    if (!container) return;
    if (!summary) {
      container.innerHTML = `
      <div class="p-2 text-center text-muted" style="font-size:0.85rem">
        ${escapeHtml(emptyMessage)}
      </div>
    `;
      return;
    }
    const total = Number(summary.Total) || 0;
    if (total <= 0) {
      container.innerHTML = `
      <div class="p-2 text-center text-muted" style="font-size:0.85rem">
        No payments have been recorded for this campus yet.
      </div>
    `;
      return;
    }
    const categories = [
      { name: "Tuition Fees", collected: summary.Tuition },
      { name: "Lab & Library Fees", collected: summary["Lab & Library Fees"] },
      {
        name: "PTA & Extracurricular",
        collected: summary["PTA & Extracurricular"]
      },
      { name: "Alumni Endowment / Gifts", collected: summary.Donations }
    ];
    container.innerHTML = categories.map((category) => {
      const share = Math.max(
        0,
        Math.min(100, Math.round(category.collected / total * 100))
      );
      return `
        <div class="financial-bar-row">
          <div class="financial-bar-meta">
            <span class="fin-cat-name">${escapeHtml(category.name)}</span>
            <span class="fin-cat-amt">$${category.collected.toLocaleString()} <span class="text-muted">(${share}% of collected)</span></span>
          </div>
          <div class="stat-progress-track">
            <div class="stat-progress-fill" style="width: ${share}%; background: var(--notion-blue);"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  // src/frontend/ts/tabs/portalTab.ts
  var currentPortal = null;
  var currentStudentId = "";
  function getPerformanceBadge(score) {
    const num = typeof score === "number" ? score : 0;
    if (num > 70) {
      return {
        color: "green",
        circleHtml: `<span class="perf-circle perf-green" title="Academic Standing: ${num}% (Superior >70%)"></span>`,
        badgeHtml: `<span class="perf-tag perf-tag-green"><span class="perf-circle perf-green"></span> ${num}% \xB7 Honors (>70%)</span>`,
        standingText: "Honors Standing (>70%)"
      };
    } else if (num >= 50) {
      return {
        color: "yellow",
        circleHtml: `<span class="perf-circle perf-yellow" title="Academic Standing: ${num}% (Satisfactory 50-69%)"></span>`,
        badgeHtml: `<span class="perf-tag perf-tag-yellow"><span class="perf-circle perf-yellow"></span> ${num}% \xB7 Satisfactory (50-69%)</span>`,
        standingText: "Satisfactory Academic Standing (50-69%)"
      };
    } else {
      return {
        color: "red",
        circleHtml: `<span class="perf-circle perf-red" title="Academic Standing: ${num}% (Intervention Required <50%)"></span>`,
        badgeHtml: `<span class="perf-tag perf-tag-red"><span class="perf-circle perf-red"></span> ${num}% \xB7 Intervention (<50%)</span>`,
        standingText: "Academic Intervention Required (<50%)"
      };
    }
  }
  async function loadPortalData() {
    try {
      const canBrowse = state.canBrowsePortals();
      const isStudent = state.isStudent();
      const select = document.getElementById("portal-student-select");
      const studentSelectorWrap = document.getElementById("portal-student-selector-wrap");
      if (canBrowse) {
        if (studentSelectorWrap) studentSelectorWrap.style.display = "flex";
        const students = await apiFetch("/api/members?role=Student");
        if (select && students.length > 0) {
          select.innerHTML = students.map((s) => {
            const perf = getPerformanceBadge(s.academic_score);
            const icon = perf.color === "green" ? "\u{1F7E2}" : perf.color === "yellow" ? "\u{1F7E1}" : "\u{1F534}";
            return `<option value="${escapeAttribute(s.id)}" ${s.id === currentStudentId ? "selected" : ""}>${icon} ${escapeHtml(s.name)} (${escapeHtml(s.position || "Student")}) - ${s.academic_score || 0}%</option>`;
          }).join("");
          if (!currentStudentId || !students.some((s) => s.id === currentStudentId)) {
            currentStudentId = students[0].id;
          }
          select.value = currentStudentId;
          select.onchange = () => {
            currentStudentId = select.value;
            fetchAndRenderPortal(currentStudentId);
          };
        }
      } else {
        if (studentSelectorWrap) studentSelectorWrap.style.display = "none";
        currentStudentId = state.activeUser?.id || "";
      }
      if (!currentStudentId) return;
      await fetchAndRenderPortal(currentStudentId);
    } catch (err) {
      console.error("Failed loading student portal context:", err);
    }
  }
  async function fetchAndRenderPortal(studentId) {
    try {
      const portal = await apiFetch(`/api/portal/${studentId}`);
      currentPortal = portal;
      renderPortalView(portal);
    } catch (err) {
      console.error(`Failed to fetch portal for student ${studentId}:`, err);
    }
  }
  function renderPortalView(portal) {
    const isEditable = state.canEditPortal();
    const elName = document.getElementById("portal-student-name");
    const elGrade = document.getElementById("portal-student-grade");
    const elTerm = document.getElementById("portal-current-term");
    const elPerfBadge = document.getElementById("portal-perf-indicator");
    const elLastUpdated = document.getElementById("portal-last-updated");
    const elOverallScoreInput = document.getElementById("portal-overall-score-input");
    const perf = getPerformanceBadge(portal.overall_score);
    if (elName) elName.textContent = portal.student_name;
    if (elGrade) elGrade.textContent = portal.grade_level;
    if (elTerm) elTerm.textContent = portal.term;
    if (elPerfBadge) {
      elPerfBadge.innerHTML = `
      <div class="perf-circle-hero perf-${perf.color}"></div>
      <div class="perf-hero-meta">
        <span class="perf-score-text">${portal.overall_score}%</span>
        <span class="perf-status-desc">${perf.standingText}</span>
      </div>
    `;
    }
    if (elLastUpdated) {
      const updatedDate = new Date(portal.updated_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
      elLastUpdated.textContent = `Last certified by: ${portal.last_updated_by} on ${updatedDate}`;
    }
    if (elOverallScoreInput) {
      elOverallScoreInput.value = String(portal.overall_score);
      elOverallScoreInput.disabled = !isEditable;
      elOverallScoreInput.oninput = () => {
        const val = Number(elOverallScoreInput.value);
        const dynamicPerf = getPerformanceBadge(val);
        if (elPerfBadge) {
          elPerfBadge.innerHTML = `
          <div class="perf-circle-hero perf-${dynamicPerf.color}"></div>
          <div class="perf-hero-meta">
            <span class="perf-score-text">${val}%</span>
            <span class="perf-status-desc">${dynamicPerf.standingText}</span>
          </div>
        `;
        }
      };
    }
    const tbody = document.getElementById("portal-grades-tbody");
    if (tbody) {
      if (portal.grades.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">No subject assessment records entered yet.</td></tr>`;
      } else {
        tbody.innerHTML = portal.grades.map((g, idx) => {
          const gradePerf = getPerformanceBadge(g.score);
          return `
          <tr data-grade-id="${escapeAttribute(g.id)}">
            <td><strong>${escapeHtml(g.subject)}</strong></td>
            <td>${escapeHtml(g.teacher)}</td>
            <td>${escapeHtml(g.term)}</td>
            <td>
              <div class="flex-row align-center gap-1">
                ${gradePerf.circleHtml}
                ${isEditable ? `<input type="number" class="notion-input input-score-sm" min="0" max="100" value="${g.score}" onchange="window.updateGradeScore(${idx}, this.value)">` : `<strong>${g.score}%</strong>`}
              </div>
            </td>
            <td>
              ${isEditable ? `<input type="text" class="notion-input input-comment-sm" value="${escapeAttribute(g.comments || "")}" onchange="window.updateGradeComment(${idx}, this.value)">` : `<span class="text-secondary">${escapeHtml(g.comments || "Satisfactory work.")}</span>`}
            </td>
            ${isEditable ? `<td><button type="button" class="notion-icon-btn text-danger" onclick="window.removeGradeRow(${idx})" title="Remove course grade">\u2715</button></td>` : ""}
          </tr>
        `;
        }).join("");
      }
    }
    const elRemarks = document.getElementById("portal-teacher-remarks");
    if (elRemarks) {
      elRemarks.value = portal.teacher_remarks || "";
      elRemarks.disabled = !isEditable;
    }
    const elGuardianName = document.getElementById("portal-guardian-name");
    const elGuardianEmail = document.getElementById("portal-guardian-email");
    const elGuardianPhone = document.getElementById("portal-guardian-phone");
    const elGuardianRelation = document.getElementById("portal-guardian-relation");
    if (elGuardianName) {
      elGuardianName.value = portal.guardian_name || "";
      elGuardianName.disabled = !isEditable;
    }
    if (elGuardianEmail) {
      elGuardianEmail.value = portal.guardian_email || "";
      elGuardianEmail.disabled = !isEditable;
    }
    if (elGuardianPhone) {
      elGuardianPhone.value = portal.guardian_phone || "";
      elGuardianPhone.disabled = !isEditable;
    }
    if (elGuardianRelation) {
      elGuardianRelation.value = portal.guardian_relation || "Parent/Guardian";
      elGuardianRelation.disabled = !isEditable;
    }
    const syllabusList = document.getElementById("portal-syllabus-list");
    if (syllabusList) {
      if (portal.syllabus_attachments.length === 0) {
        syllabusList.innerHTML = `<p class="text-muted" style="font-size:0.85rem">No syllabus documents attached yet.</p>`;
      } else {
        syllabusList.innerHTML = portal.syllabus_attachments.map((att) => `
        <div class="syllabus-item-pill">
          <div class="syllabus-item-info">
            <span class="syllabus-icon">\u{1F4C4}</span>
            <div class="syllabus-text">
              <strong>${escapeHtml(att.title)}</strong>
              <span class="syllabus-sub">${escapeHtml(att.filename)} \xB7 Uploaded by ${escapeHtml(att.uploaded_by)} (${escapeHtml(att.date)})</span>
            </div>
          </div>
          <span class="notion-tag tag-gray" title="This deployment records attachment metadata. File delivery is managed by the school office.">On file</span>
        </div>
      `).join("");
      }
    }
  }
  window.updateGradeScore = (index, newScore) => {
    if (!currentPortal || !currentPortal.grades[index]) return;
    const val = Math.min(100, Math.max(0, Number(newScore) || 0));
    currentPortal.grades[index].score = val;
    const total = currentPortal.grades.reduce((sum, g) => sum + g.score, 0);
    const avg = Math.round(total / currentPortal.grades.length);
    currentPortal.overall_score = avg;
    const overallInput = document.getElementById("portal-overall-score-input");
    if (overallInput) overallInput.value = String(avg);
    const elPerfBadge = document.getElementById("portal-perf-indicator");
    const dynamicPerf = getPerformanceBadge(avg);
    if (elPerfBadge) {
      elPerfBadge.innerHTML = `
      <div class="perf-circle-hero perf-${dynamicPerf.color}"></div>
      <div class="perf-hero-meta">
        <span class="perf-score-text">${avg}%</span>
        <span class="perf-status-desc">${dynamicPerf.standingText}</span>
      </div>
    `;
    }
  };
  window.updateGradeComment = (index, newComment) => {
    if (!currentPortal || !currentPortal.grades[index]) return;
    currentPortal.grades[index].comments = newComment;
  };
  window.removeGradeRow = (index) => {
    if (!currentPortal) return;
    currentPortal.grades.splice(index, 1);
    renderPortalView(currentPortal);
  };
  function addSubjectRow() {
    if (!currentPortal) return;
    const newCourse = {
      id: `g_${Date.now()}`,
      subject: "New Academic Subject",
      score: 75,
      teacher: state.activeUser?.name || "Class Teacher",
      term: currentPortal.term || "Fall 2026",
      comments: "Regular performance"
    };
    currentPortal.grades.push(newCourse);
    renderPortalView(currentPortal);
  }
  async function savePortalChanges() {
    if (!currentPortal || !currentStudentId) return;
    if (!state.canEditPortal()) {
      alert("Access Denied: Student portals can only be edited by Teachers and Campus Management.");
      return;
    }
    const elOverallScore = document.getElementById("portal-overall-score-input");
    const elRemarks = document.getElementById("portal-teacher-remarks");
    const elGuardianName = document.getElementById("portal-guardian-name");
    const elGuardianEmail = document.getElementById("portal-guardian-email");
    const elGuardianPhone = document.getElementById("portal-guardian-phone");
    const elGuardianRelation = document.getElementById("portal-guardian-relation");
    const payload = {
      overall_score: Number(elOverallScore?.value || currentPortal.overall_score),
      term: currentPortal.term,
      grades: currentPortal.grades,
      teacher_remarks: elRemarks?.value || "",
      guardian_name: elGuardianName?.value || "",
      guardian_email: elGuardianEmail?.value || "",
      guardian_phone: elGuardianPhone?.value || "",
      guardian_relation: elGuardianRelation?.value || "",
      syllabus_attachments: currentPortal.syllabus_attachments
    };
    try {
      const res = await apiFetch(`/api/portal/${currentStudentId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      currentPortal = res.portal;
      alert(`Success: ${res.message}`);
      renderPortalView(res.portal);
    } catch (err) {
      alert(`Error updating student portal: ${err.message}`);
    }
  }
  function bulkEmailGuardian() {
    if (!currentPortal) return;
    const email = (currentPortal.guardian_email || "").trim();
    if (!email) {
      alert("No guardian email is registered for this student.");
      return;
    }
    const name = currentPortal.guardian_name || "Guardian";
    const subject = encodeURIComponent(
      `Academic evaluation report for ${currentPortal.student_name}`
    );
    const body = encodeURIComponent(
      `Dear ${name},

This is the current academic summary for ${currentPortal.student_name} (${currentPortal.grade_level || "Student"}, ${currentPortal.term || "current term"}).

Overall score: ${currentPortal.overall_score}%
Teacher remarks: ${currentPortal.teacher_remarks || "None recorded."}

Please contact the school office if you would like to discuss this report.

Regards,
${state.activeUser?.name || "SchoolBook"}`
    );
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
  }

  // src/frontend/ts/tabs/membersTab.ts
  var lastMemberDetail = null;
  async function loadMembersData() {
    try {
      const searchInput = document.getElementById("member-search-input");
      const roleSelect = document.getElementById("member-role-filter");
      const statusSelect = document.getElementById("member-status-filter");
      const search = searchInput?.value || "";
      const role = roleSelect?.value || "";
      const status = statusSelect?.value || "";
      let query = "?";
      if (search) query += `search=${encodeURIComponent(search)}&`;
      if (role) query += `role=${encodeURIComponent(role)}&`;
      if (status) query += `status=${encodeURIComponent(status)}&`;
      const members = await apiFetch(`/api/members${query}`);
      const tbody = document.getElementById("members-list-tbody");
      if (!tbody) return;
      if (members.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center">No matching students or faculty members found.</td></tr>`;
        return;
      }
      tbody.innerHTML = members.map((m) => {
        let perfDisplay = `<span class="notion-tag tag-gray">Faculty / Staff</span>`;
        if (m.role === "Student") {
          const perf = getPerformanceBadge(m.academic_score);
          perfDisplay = `
          <div class="perf-row-pill" title="Performance: ${m.academic_score || 0}% (${perf.standingText})">
            ${perf.circleHtml}
            <strong>${m.academic_score || 0}%</strong>
          </div>
        `;
        } else if (m.role === "Principal") {
          perfDisplay = `<span class="notion-tag tag-purple">Core Admin</span>`;
        } else {
          perfDisplay = `<span class="notion-tag tag-blue">Academic Staff</span>`;
        }
        return `
        <tr>
          <td><img src="${safeImageUrl(m.profile_picture_url)}" alt="" class="table-avatar"></td>
          <td><strong>${escapeHtml(m.name)}</strong></td>
          <td><span class="badge badge-role">${escapeHtml(m.role)}</span></td>
          <td>${escapeHtml(m.position || (m.role === "Student" ? "Student" : "Faculty Staff"))}</td>
          <td>${perfDisplay}</td>
          <td><span class="badge ${m.status === "Active" ? "badge-active" : "badge-inactive"}">${escapeHtml(m.status)}</span></td>
          <td>
            <div class="flex-row gap-1 justify-end">
              <button class="btn btn-secondary btn-sm" onclick="window.viewMemberDetail('${escapeAttribute(m.id)}')">\u{1F464} Profile</button>
              ${m.role === "Student" ? `<button class="btn btn-primary btn-sm" onclick="window.switchToStudentPortal('${escapeAttribute(m.id)}')">\u{1F393} Portal</button>` : ""}
              ${state.isPrincipal() ? `<button class="btn btn-danger btn-sm" onclick="window.deleteMemberProfile('${escapeAttribute(m.id)}')">\u2716</button>` : ""}
            </div>
          </td>
        </tr>
      `;
      }).join("");
    } catch (err) {
      console.error("Failed loading student/staff registry list:", err);
    }
  }
  async function viewMemberDetail(id) {
    try {
      const member = await apiFetch(`/api/members/${id}`);
      lastMemberDetail = member;
      const detAvatar = document.getElementById("det-avatar");
      const detName = document.getElementById("det-name");
      const detRoleBadge = document.getElementById("det-role-badge");
      const detPosition = document.getElementById("det-position");
      const statusEl = document.getElementById("det-status");
      const detUnit = document.getElementById("det-unit");
      const detEmail = document.getElementById("det-email");
      const detPhone = document.getElementById("det-phone");
      const detAddress = document.getElementById("det-address");
      const detDob = document.getElementById("det-dob");
      const detJoined = document.getElementById("det-joined");
      const detCustomSection = document.getElementById("det-custom-attributes");
      if (detAvatar) detAvatar.src = safeImageUrl(member.profile_picture_url);
      if (detName) detName.textContent = member.name;
      if (detRoleBadge) detRoleBadge.textContent = member.role;
      if (detPosition) detPosition.textContent = member.position || (member.role === "Student" ? "Student" : "Faculty Staff");
      if (statusEl) {
        statusEl.textContent = member.status;
        statusEl.className = `status-indicator badge ${member.status === "Active" ? "badge-active" : "badge-inactive"}`;
      }
      if (detUnit) detUnit.textContent = state.getUnitLabel(member.unit_id);
      if (detEmail) detEmail.textContent = member.email || "\u{1F512} Pruned/Hidden for Privacy";
      if (detPhone) detPhone.textContent = member.phone || "\u{1F512} Pruned/Hidden for Privacy";
      if (detAddress) detAddress.textContent = member.address || "\u{1F512} Pruned/Hidden for Privacy";
      if (detDob) {
        if (member.dob_month && member.dob_day) {
          const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          detDob.textContent = `${months[member.dob_month - 1]} ${member.dob_day}`;
        } else {
          detDob.textContent = "\u{1F512} Pruned/Hidden for Privacy";
        }
      }
      if (detJoined) {
        if (member.joined_date) {
          detJoined.textContent = new Date(member.joined_date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
          });
        } else {
          detJoined.textContent = "\u{1F512} Pruned/Hidden for Privacy";
        }
      }
      if (detCustomSection) {
        if (member.role === "Principal") {
          detCustomSection.innerHTML = `
          <div class="notion-callout mt-2">
            <span class="callout-emoji">\u{1F3DB}\uFE0F</span>
            <div class="callout-text">
              <strong>Core Institutional Leadership Profile</strong><br>
              <span class="text-secondary">Administrative clearance: Level 1 Executive Oversight</span>
            </div>
          </div>
          <div class="detail-row notion-prop-row mt-1">
            <span class="prop-name"><span class="prop-icon">\u{1F3E2}</span> Office Location</span>
            <strong>${escapeHtml(member.office_location || "Executive Quadrangle Suite")}</strong>
          </div>
          <div class="detail-row notion-prop-row">
            <span class="prop-name"><span class="prop-icon">\u23F0</span> Office Hours</span>
            <strong>${escapeHtml(member.office_hours || "Mon-Thu 9:00 AM - 1:00 PM")}</strong>
          </div>
          <div class="detail-row notion-prop-row">
            <span class="prop-name"><span class="prop-icon">\u{1F3AF}</span> Leadership Scope</span>
            <strong>${escapeHtml(member.specialization || "Campus Governance & Standards")}</strong>
          </div>
          ${member.bio ? `
            <div class="mt-2 p-2 notion-callout-panel" style="font-size:0.9rem">
              <strong>Professional Biography:</strong><br>
              <p class="text-secondary mt-1">${escapeHtml(member.bio)}</p>
            </div>
          ` : ""}
        `;
        } else if (member.role === "Teacher" || member.role === "Counselor") {
          detCustomSection.innerHTML = `
          <div class="notion-callout mt-2">
            <span class="callout-emoji">\u{1F4DA}</span>
            <div class="callout-text">
              <strong>Academic Faculty & Staff Profile</strong><br>
              <span class="text-secondary">Departmental educator & student advisor</span>
            </div>
          </div>
          <div class="detail-row notion-prop-row mt-1">
            <span class="prop-name"><span class="prop-icon">\u{1F3E2}</span> Faculty Office</span>
            <strong>${escapeHtml(member.office_location || "Faculty Hall Office")}</strong>
          </div>
          <div class="detail-row notion-prop-row">
            <span class="prop-name"><span class="prop-icon">\u23F0</span> Advisory Hours</span>
            <strong>${escapeHtml(member.office_hours || "Daily 3:00 PM - 4:30 PM")}</strong>
          </div>
          <div class="detail-row notion-prop-row">
            <span class="prop-name"><span class="prop-icon">\u{1F4D6}</span> Specialization</span>
            <strong>${escapeHtml(member.specialization || "Secondary Curriculum & Mentorship")}</strong>
          </div>
          ${member.bio ? `
            <div class="mt-2 p-2 notion-callout-panel" style="font-size:0.9rem">
              <strong>Faculty Background:</strong><br>
              <p class="text-secondary mt-1">${escapeHtml(member.bio)}</p>
            </div>
          ` : ""}
        `;
        } else {
          const perf = getPerformanceBadge(member.academic_score);
          detCustomSection.innerHTML = `
          <div class="notion-callout mt-2">
            <span class="callout-emoji">\u{1F393}</span>
            <div class="callout-text">
              <strong>Student Academic Standing</strong><br>
              <span class="text-secondary">Certified continuous evaluation record</span>
            </div>
          </div>
          <div class="detail-row notion-prop-row mt-1">
            <span class="prop-name"><span class="prop-icon">\u{1F4CA}</span> Academic Performance</span>
            <div class="flex-row align-center gap-1">
              ${perf.circleHtml}
              <strong>${member.academic_score || 0}%</strong>
              <span class="perf-status-desc">(${perf.standingText})</span>
            </div>
          </div>
          <div class="detail-row notion-prop-row">
            <span class="prop-name"><span class="prop-icon">\u{1F465}</span> Guardian Contact</span>
            <strong>${escapeHtml(member.guardian_name || "Guardian on file")} (${escapeHtml(member.guardian_email || "No email registered")})</strong>
          </div>
          <div class="mt-2">
            <button class="btn btn-primary btn-full" onclick="window.switchToStudentPortal('${escapeAttribute(member.id)}')">
              \u{1F393} View Official Student Portal
            </button>
          </div>
        `;
        }
        detCustomSection.innerHTML += renderAccessPanel(member);
      }
      const modal = document.getElementById("profile-detail-modal");
      if (modal) modal.classList.add("active");
    } catch (err) {
      alert(err.message || "Failed to view profile details");
    }
  }
  async function deleteMemberProfile(id) {
    if (!confirm("Archive this profile? The person will no longer appear in active registers, but their attendance, grades, and finance history are preserved.")) {
      return;
    }
    try {
      const res = await apiFetch(`/api/members/${id}`, { method: "DELETE" });
      alert(res.message);
      loadMembersData();
    } catch (err) {
      alert(err.message || "Failed to delete profile");
    }
  }
  function renderAccessPanel(member) {
    if (!state.isPrincipal()) return "";
    const rows = [];
    if (member.role === "Student") {
      rows.push(
        loginRow(
          "Student login",
          member.email,
          Boolean(member.user_id),
          member.id,
          "student",
          member.id
        )
      );
      if (member.guardian_id) {
        rows.push(
          loginRow(
            "Guardian login",
            member.guardian_email || "",
            Boolean(member.guardian_user_id),
            member.guardian_id,
            "guardian",
            member.id
          )
        );
      } else {
        rows.push(`
        <div class="detail-row notion-prop-row">
          <span class="prop-name"><span class="prop-icon">\u{1F511}</span> Guardian login</span>
          <span class="text-secondary">No guardian linked</span>
        </div>
      `);
      }
    } else {
      rows.push(
        loginRow(
          "Workspace login",
          member.email,
          Boolean(member.user_id),
          member.id,
          "staff",
          member.id
        )
      );
    }
    return `
    <div class="notion-callout mt-2">
      <span class="callout-emoji">\u{1F510}</span>
      <div class="callout-text">
        <strong>Access &amp; Login</strong><br>
        <span class="text-secondary">Create a workspace account linked to this profile. Passwords are shown once.</span>
      </div>
    </div>
    ${rows.join("")}
  `;
  }
  function loginRow(label, email, linked, linkId, kind, returnId) {
    const action = linked ? '<span class="notion-tag tag-green">Login linked</span>' : `<button type="button" class="btn btn-secondary btn-sm" onclick="window.openAccessModal('${escapeAttribute(linkId)}', '${kind}', '${escapeAttribute(returnId)}')">Create login</button>`;
    return `
    <div class="detail-row notion-prop-row">
      <span class="prop-name"><span class="prop-icon">\u{1F511}</span> ${escapeHtml(label)}</span>
      <div class="flex-row align-center gap-1">
        <span class="text-secondary">${escapeHtml(email || "No email on file")}</span>
        ${action}
      </div>
    </div>
  `;
  }
  function inferStaffRole(member) {
    const position = (member.position || "").toLowerCase();
    if (member.role === "Principal") return "PRINCIPAL";
    if (position.includes("bursar") || position.includes("account") || position.includes("finance")) {
      return "ACCOUNTANT";
    }
    if (position.includes("librarian") || position.includes("library")) {
      return "LIBRARIAN";
    }
    return "TEACHER";
  }
  function staffRoleOptions(member) {
    const position = (member.position || "").toLowerCase();
    const options = [];
    if (member.role === "Principal") {
      options.push(["PRINCIPAL", "Principal"]);
    }
    options.push(["TEACHER", "Teacher"]);
    if (position.includes("bursar") || position.includes("account") || position.includes("finance")) {
      options.push(["ACCOUNTANT", "Accountant"]);
    }
    if (position.includes("librarian") || position.includes("library")) {
      options.push(["LIBRARIAN", "Librarian"]);
    }
    options.push(["VICE_PRINCIPAL", "Vice Principal"]);
    const seen = /* @__PURE__ */ new Set();
    return options.filter(([value]) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }
  function generateTempPassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    const random = new Uint32Array(12);
    crypto.getRandomValues(random);
    return Array.from(random, (value) => alphabet[value % alphabet.length]).join("");
  }
  function openAccessModal(linkId, kind, returnId) {
    const member = lastMemberDetail;
    if (!member) {
      alert("Open the profile again before creating a login.");
      return;
    }
    const isGuardian = kind === "guardian";
    const name = isGuardian ? member.guardian_name || "Guardian" : member.name || "User";
    const email = isGuardian ? member.guardian_email || "" : member.email || "";
    const [firstName, ...rest] = name.trim().split(/\s+/);
    const lastName = rest.join(" ") || "User";
    const linkInput = document.getElementById("access-link-id");
    const returnInput = document.getElementById("access-return-id");
    const kindInput = document.getElementById("access-profile-kind");
    const firstInput = document.getElementById("access-first-name");
    const lastInput = document.getElementById("access-last-name");
    const emailInput = document.getElementById("access-email");
    const roleSelect = document.getElementById("access-role");
    const passwordInput = document.getElementById("access-password");
    const profileName = document.getElementById("access-profile-name");
    const profileNote = document.getElementById("access-profile-note");
    if (linkInput) linkInput.value = linkId;
    if (returnInput) returnInput.value = returnId;
    if (kindInput) kindInput.value = kind;
    if (firstInput) firstInput.value = firstName;
    if (lastInput) lastInput.value = lastName;
    if (emailInput) emailInput.value = email;
    if (passwordInput) passwordInput.value = generateTempPassword();
    if (roleSelect) {
      const options = kind === "student" ? [["STUDENT", "Student"]] : kind === "guardian" ? [["GUARDIAN", "Guardian"]] : staffRoleOptions(member);
      roleSelect.innerHTML = options.map(
        ([value, label]) => `<option value="${escapeAttribute(value)}">${escapeHtml(label)}</option>`
      ).join("");
      roleSelect.value = kind === "student" ? "STUDENT" : kind === "guardian" ? "GUARDIAN" : inferStaffRole(member);
    }
    if (profileName) {
      profileName.textContent = `${name} \xB7 ${isGuardian ? "Guardian account" : member.role === "Student" ? "Student account" : "Staff account"}`;
    }
    if (profileNote) {
      profileNote.textContent = isGuardian ? "This login will be linked to the guardian record so the family can see the linked student portal." : member.role === "Student" ? "This login will be linked to the student record so the student sees their own portal." : "This login will be linked to the staff record and the selected workspace role.";
    }
    const modal = document.getElementById("access-modal");
    if (modal) modal.classList.add("active");
    emailInput?.focus();
  }
  function closeAccessModal() {
    const modal = document.getElementById("access-modal");
    if (modal) modal.classList.remove("active");
  }
  async function submitAccessForm(e) {
    e.preventDefault();
    const linkId = document.getElementById("access-link-id")?.value || "";
    const returnId = document.getElementById("access-return-id")?.value || "";
    const kind = document.getElementById("access-profile-kind")?.value || "";
    const firstName = document.getElementById("access-first-name")?.value || "";
    const lastName = document.getElementById("access-last-name")?.value || "";
    const email = document.getElementById("access-email")?.value.trim() || "";
    const role = document.getElementById("access-role")?.value || "";
    const password = document.getElementById("access-password")?.value || "";
    if (!linkId || !email || !role || password.length < 8) {
      alert("Enter a login email and a temporary password of at least 8 characters.");
      return;
    }
    const payload = {
      email,
      firstName,
      lastName,
      role,
      password,
      isActive: true
    };
    if (kind === "staff") payload.staffId = linkId;
    else if (kind === "student") payload.studentId = linkId;
    else if (kind === "guardian") payload.guardianId = linkId;
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      alert(
        `Login created.

Email: ${email}
Temporary password: ${password}

Share this privately. The person should change it after signing in.`
      );
      closeAccessModal();
      if (returnId) await viewMemberDetail(returnId);
      await loadMembersData();
    } catch (err) {
      alert(err.message || "Failed to create workspace login");
    }
  }
  function setupAccessModal() {
    const form = document.getElementById("access-form");
    if (form) form.onsubmit = submitAccessForm;
    const closeBtn = document.getElementById("btn-close-access-modal");
    if (closeBtn) closeBtn.onclick = () => closeAccessModal();
    const cancelBtn = document.getElementById("btn-cancel-access-modal");
    if (cancelBtn) cancelBtn.onclick = () => closeAccessModal();
    const generateBtn = document.getElementById("btn-generate-password");
    if (generateBtn) {
      generateBtn.onclick = () => {
        const passwordInput = document.getElementById("access-password");
        if (passwordInput) passwordInput.value = generateTempPassword();
      };
    }
  }
  window.viewMemberDetail = viewMemberDetail;
  window.deleteMemberProfile = deleteMemberProfile;
  window.openAccessModal = openAccessModal;
  window.switchToStudentPortal = (studentId) => {
    const modal = document.getElementById("profile-detail-modal");
    if (modal) modal.classList.remove("active");
    const portalNav = document.getElementById("nav-portal");
    if (portalNav) {
      portalNav.click();
      setTimeout(() => {
        const select = document.getElementById("portal-student-select");
        if (select) {
          select.value = studentId;
          select.dispatchEvent(new Event("change"));
        }
      }, 100);
    }
  };

  // src/frontend/ts/tabs/attendanceTab.ts
  async function loadAttendanceSheet() {
    const tbody = document.getElementById("attendance-sheet-tbody");
    const btnClose = document.getElementById("btn-close-service");
    const sheetTitle = document.getElementById("active-sheet-title");
    if (!state.isTeacherOrPrincipal()) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center">Attendance registers are restricted to Teaching Staff and Principals.</td></tr>`;
      }
      if (btnClose) btnClose.disabled = true;
      return;
    }
    try {
      const serviceNameInput = document.getElementById("att-service-name");
      const serviceDateInput = document.getElementById("att-service-date");
      const serviceName = serviceNameInput?.value || "Morning Roll Call";
      const date = serviceDateInput?.value || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const data = await apiFetch(`/api/attendance/sheet?date=${date}&serviceName=${encodeURIComponent(serviceName)}`);
      if (sheetTitle) {
        sheetTitle.textContent = `${data.serviceName} checklist (${data.serviceDate})`;
      }
      if (btnClose) btnClose.disabled = false;
      if (!tbody) return;
      if (data.sheet.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center">No students or staff found in campus directory to mark.</td></tr>`;
        if (btnClose) btnClose.disabled = true;
        return;
      }
      tbody.innerHTML = data.sheet.map((m) => `
      <tr>
        <td><strong>${escapeHtml(m.memberName)}</strong></td>
        <td><span class="badge badge-role">${escapeHtml(m.role)}</span> (${escapeHtml(m.position || (m.role === "Student" ? "Student" : "Staff"))})</td>
        <td>
          <div class="flex-row gap-2 align-center">
            <input type="checkbox" id="check-${escapeAttribute(m.memberId)}" ${m.status === "Present" ? "checked" : ""}
              onchange="window.markMemberAttendance('${escapeAttribute(m.memberId)}', '${escapeAttribute(data.serviceDate)}', '${escapeAttribute(data.serviceName)}', this.checked ? 'Present' : 'Absent')">
            <label for="check-${escapeAttribute(m.memberId)}">${escapeHtml(m.status)}</label>
          </div>
        </td>
      </tr>
    `).join("");
    } catch (err) {
      console.error("Failed to load attendance checklist sheet:", err);
    }
  }
  async function markMemberAttendance(memberId, serviceDate, serviceName, status) {
    try {
      await apiFetch("/api/attendance/mark", {
        method: "POST",
        body: JSON.stringify({ memberId, serviceDate, serviceName, status })
      });
      const label = document.querySelector(`label[for="check-${memberId}"]`);
      if (label) label.textContent = status;
    } catch (err) {
      alert(`Failed to save attendance: ${err.message}`);
    }
  }
  async function closeServiceAttendance() {
    const serviceNameInput = document.getElementById("att-service-name");
    const serviceDateInput = document.getElementById("att-service-date");
    const serviceName = serviceNameInput?.value || "Morning Roll Call";
    const serviceDate = serviceDateInput?.value || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    if (!confirm(`Are you sure you want to close the attendance register for ${serviceName} on ${serviceDate}? Anyone unmarked will be automatically recorded as Absent.`)) {
      return;
    }
    try {
      const res = await apiFetch("/api/attendance/close-service", {
        method: "POST",
        body: JSON.stringify({ serviceDate, serviceName })
      });
      alert(res.message);
      await loadAttendanceSheet();
      await loadWorkersPerformance();
    } catch (err) {
      alert(err.message || "Failed to close session");
    }
  }
  async function loadWorkersPerformance() {
    const tbody = document.getElementById("workers-performance-tbody");
    const elRate = document.getElementById("workers-activeness-rate");
    const isStatsLeader = ["Principal", "Counselor"].includes(state.activeUser?.role || "");
    if (!isStatsLeader) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center">Reports restricted to academic administrators.</td></tr>`;
      }
      if (elRate) elRate.textContent = "Locked";
      return;
    }
    try {
      const data = await apiFetch("/api/attendance/stats?type=faculty");
      if (elRate) elRate.textContent = `${data.avgAttendanceRate}%`;
      if (!tbody) return;
      if (data.memberPerformance.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center">No staff or student attendance logs recorded.</td></tr>`;
        return;
      }
      tbody.innerHTML = data.memberPerformance.map((w) => `
      <tr>
        <td><strong>${escapeHtml(w.name)}</strong></td>
        <td><span class="badge badge-role">${escapeHtml(w.role)}</span></td>
        <td>${w.presentCount}/${w.totalServices}</td>
        <td><strong>${w.attendanceRate}%</strong></td>
      </tr>
    `).join("");
    } catch (err) {
      console.error("Failed loading attendance consistency statistics:", err);
    }
  }

  // src/frontend/ts/tabs/inventoryTab.ts
  async function loadInventoryData() {
    try {
      const items = await apiFetch("/api/inventory");
      const grid = document.getElementById("inventory-items-grid");
      if (!grid) return;
      const isAuthorizedToEdit = state.isAuthorizedToEditInventory();
      if (items.length === 0) {
        grid.innerHTML = `<div class="text-center" style="grid-column: 1/-1;">No equipment or facilities registered on this campus.</div>`;
        return;
      }
      grid.innerHTML = items.map((item) => {
        const isSelected = (val) => item.status === val ? "selected" : "";
        const badgeClass = item.status === "Active" ? "badge-active" : item.status === "Faulty" ? "badge-faulty" : "badge-inactive";
        return `
        <div class="inventory-card">
          <div>
            <h3>${escapeHtml(item.item_name)}</h3>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:4px;">${escapeHtml(item.description || "No description provided.")}</p>
          </div>
          
          <div class="inv-meta">
            <span class="inv-dept">${escapeHtml(state.getUnitLabel(item.unit_id))}</span>
            <span class="badge ${badgeClass}">${escapeHtml(item.status)}</span>
          </div>

          ${isAuthorizedToEdit ? `
            <div class="inv-controls">
              <select onchange="window.updateInventoryStatus('${escapeAttribute(item.id)}', this.value)" class="form-input select-input btn-sm flex-1">
                <option value="Active" ${isSelected("Active")}>Active</option>
                <option value="Faulty" ${isSelected("Faulty")}>Faulty</option>
                <option value="Unavailable" ${isSelected("Unavailable")}>Unavailable</option>
              </select>
              ${state.isPrincipal() ? `
                <button class="btn btn-danger btn-sm" onclick="window.deleteInventoryItem('${escapeAttribute(item.id)}')">\u2716 Delete</button>
              ` : ""}
            </div>
          ` : ""}
        </div>
      `;
      }).join("");
    } catch (err) {
      console.error("Failed to load campus inventory assets:", err);
    }
  }
  async function updateInventoryStatus(id, status) {
    try {
      await apiFetch(`/api/inventory/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status })
      });
      await loadInventoryData();
    } catch (err) {
      alert(err.message || "Failed to update equipment status");
    }
  }
  async function deleteInventoryItem(id) {
    if (!confirm("Remove this equipment from the campus inventory permanently?")) return;
    try {
      const res = await apiFetch(`/api/inventory/${id}`, { method: "DELETE" });
      alert(res.message);
      await loadInventoryData();
    } catch (err) {
      alert(err.message || "Failed to delete inventory item");
    }
  }

  // src/frontend/ts/tabs/financialsTab.ts
  async function loadFinancialsData() {
    if (!state.canAccessFinance()) return;
    const [ledgerResult, projectionResult] = await Promise.allSettled([
      apiFetch("/api/financials"),
      apiFetch("/api/financials/projections")
    ]);
    const tbody = document.getElementById("finance-ledger-tbody");
    if (ledgerResult.status === "fulfilled") {
      const ledger = ledgerResult.value;
      if (tbody) {
        if (ledger.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" class="text-center">No tuition or fee transactions logged under active campus.</td></tr>`;
        } else {
          tbody.innerHTML = ledger.map(
            (entry) => `
              <tr>
                <td>${new Date(entry.transaction_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                <td><strong>${escapeHtml(entry.contributorName)}</strong></td>
                <td><span class="badge badge-role">${escapeHtml(entry.category)}</span></td>
                <td>${escapeHtml(entry.payment_method)}</td>
                <td><strong>$${entry.amount.toFixed(2)}</strong></td>
              </tr>
            `
          ).join("");
        }
      }
    } else {
      console.error("Failed loading financial ledger:", ledgerResult.reason);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">The ledger could not be loaded. Try again shortly.</td></tr>`;
      }
    }
    const elGrowthRate = document.getElementById("finance-growth-rate");
    const elNextProj = document.getElementById("finance-next-projection");
    if (projectionResult.status === "fulfilled") {
      const projections = projectionResult.value;
      if (elGrowthRate) {
        elGrowthRate.textContent = `${projections.growthRatePercent}%`;
      }
      if (elNextProj) {
        elNextProj.textContent = `$${projections.projectedNextWeek.toLocaleString(void 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    } else {
      console.error(
        "Failed loading financial projections:",
        projectionResult.reason
      );
      if (elGrowthRate) elGrowthRate.textContent = "Unavailable";
      if (elNextProj) elNextProj.textContent = "Unavailable";
    }
  }
  async function handlePaymentSubmit(e) {
    e.preventDefault();
    const payForm = document.getElementById("payment-gateway-form");
    const payCategory = document.getElementById("pay-category");
    const payAmount = document.getElementById("pay-amount");
    const payMethod = document.getElementById("pay-method");
    const payAnonymous = document.getElementById("pay-anonymous");
    const payReference = document.getElementById("pay-reference");
    const cardFields = document.getElementById("card-fields");
    const method = payMethod?.value || "Card";
    const reference = payReference?.value.trim() || "";
    if (method === "Card" && !reference) {
      alert("Card payments require the reference supplied by your payment gateway. Raw card numbers are never accepted.");
      payReference?.focus();
      return;
    }
    const body = {
      amount: Number(payAmount?.value || 0),
      category: payCategory?.value || "Tuition",
      payment_method: method,
      reference: reference || void 0,
      anonymous: payAnonymous?.checked || false
    };
    try {
      const res = await apiFetch("/api/financials/pay", {
        method: "POST",
        body: JSON.stringify(body)
      });
      alert(res.message);
      if (payForm) payForm.reset();
      if (cardFields) cardFields.style.display = "block";
      await loadFinancialsData();
    } catch (err) {
      alert(`Transaction Rejected: ${err.message}`);
    }
  }

  // src/frontend/ts/tabs/broadcastTab.ts
  async function loadBroadcastContext() {
    await loadBroadcastFeed();
    if (!state.canBroadcast()) return;
    try {
      const units = await apiFetch("/api/units");
      const select = document.getElementById("bc-unit-id");
      if (select) {
        select.innerHTML = units.map(
          (u) => `<option value="${escapeAttribute(u.id)}">${escapeHtml(u.name)}</option>`
        ).join("");
      }
      const targetSelect = document.getElementById("bc-target");
      const unitGroup = document.getElementById("bc-unit-group");
      if (targetSelect && unitGroup) {
        targetSelect.onchange = (e) => {
          const val = e.target.value;
          if (val === "unit") {
            unitGroup.style.display = "block";
          } else {
            unitGroup.style.display = "none";
          }
        };
      }
      const categorySelect = document.getElementById("bc-category");
      const eventDateGroup = document.getElementById("bc-event-date-group");
      const attachmentGroup = document.getElementById("bc-attachment-group");
      if (categorySelect) {
        categorySelect.onchange = () => {
          const cat = categorySelect.value;
          if (eventDateGroup) {
            eventDateGroup.style.display = cat === "assignment" || cat === "test" ? "block" : "none";
          }
          if (attachmentGroup) {
            attachmentGroup.style.display = cat === "curriculum" ? "block" : "none";
          }
        };
      }
    } catch (err) {
      console.error("Failed loading broadcast context:", err);
    }
  }
  async function loadBroadcastFeed() {
    try {
      const broadcasts = await apiFetch("/api/messaging");
      const container = document.getElementById("broadcast-feed-container");
      if (!container) return;
      if (broadcasts.length === 0) {
        container.innerHTML = `<div class="notion-callout"><span class="callout-emoji">\u{1F4E2}</span><div class="callout-text">No announcements posted yet in this broadcast channel.</div></div>`;
        return;
      }
      container.innerHTML = broadcasts.map((b) => {
        let catTagClass = "tag-blue";
        let catIcon = "\u{1F4E2}";
        let catLabel = "General Notice";
        if (b.category === "assignment") {
          catTagClass = "tag-orange";
          catIcon = "\u{1F4DD}";
          catLabel = "Assignment Reminder";
        } else if (b.category === "test") {
          catTagClass = "tag-red";
          catIcon = "\u{1F3AF}";
          catLabel = "Test / Exam Notice";
        } else if (b.category === "impromptu") {
          catTagClass = "tag-yellow";
          catIcon = "\u26A1";
          catLabel = "Impromptu Information";
        } else if (b.category === "curriculum") {
          catTagClass = "tag-green";
          catIcon = "\u{1F4DA}";
          catLabel = "Syllabus & Curriculum";
        }
        const formattedDate = new Date(b.sent_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
        return `
        <div class="broadcast-card notion-panel">
          <div class="bc-card-header">
            <div class="bc-author-row">
              <span class="bc-author-avatar">\u{1F464}</span>
              <div class="bc-author-meta">
                <strong>${escapeHtml(b.sender_name)}</strong>
                <span class="text-secondary" style="font-size:0.75rem"> \xB7 ${escapeHtml(b.sender_role)} \xB7 ${escapeHtml(formattedDate)}</span>
              </div>
            </div>
            <span class="notion-tag ${catTagClass}">${catIcon} ${catLabel}</span>
          </div>

          <h3 class="bc-title mt-1">${escapeHtml(b.title || "Broadcast Circular")}</h3>
          <p class="bc-message mt-1">${escapeHtml(b.message)}</p>

          ${b.event_date ? `
            <div class="bc-event-pill mt-1">
              <span>\u{1F4C5}</span> <strong>Event / Due Date:</strong> ${escapeHtml(b.event_date)}
            </div>
          ` : ""}

          ${b.attachment ? `
            <div class="bc-attachment-box mt-1">
              <div class="bc-att-info">
                <span class="bc-att-icon">\u{1F4C4}</span>
                <div>
                  <strong>${escapeHtml(b.attachment.name)}</strong>
                  <span class="text-secondary" style="font-size:0.75rem">${escapeHtml(b.attachment.size || "PDF")} \xB7 ${escapeHtml(b.attachment.type || "Curriculum Syllabus Document")}</span>
                </div>
              </div>
              <span class="notion-tag tag-gray" title="This deployment records attachment metadata. File delivery is managed by the school office.">On file</span>
            </div>
          ` : ""}

          <div class="bc-card-footer mt-1">
            <span class="bc-recipients-pill">\u{1F465} ${b.recipient_count} Recipients</span>
            ${b.bulk_mailed ? `<span class="notion-tag tag-purple">\u2709\uFE0F Email delivery queued</span>` : ""}
          </div>
        </div>
      `;
      }).join("");
    } catch (err) {
      console.error("Failed loading broadcast channel feed:", err);
    }
  }
  async function handleBroadcastSubmit(e) {
    e.preventDefault();
    const bcLogs = document.getElementById("broadcast-logs-container");
    const targetSelect = document.getElementById("bc-target");
    const unitSelect = document.getElementById("bc-unit-id");
    const categorySelect = document.getElementById("bc-category");
    const titleInput = document.getElementById("bc-title");
    const messageInput = document.getElementById("bc-message");
    const eventDateInput = document.getElementById("bc-event-date");
    const attachmentInput = document.getElementById("bc-attachment-title");
    const bulkMailCheckbox = document.getElementById("bc-bulk-mail");
    const category = categorySelect?.value || "impromptu";
    const title = titleInput?.value || "";
    const message = messageInput?.value || "";
    const event_date = eventDateInput?.value || void 0;
    const bulk_mail = Boolean(bulkMailCheckbox?.checked);
    let attachment = void 0;
    if (category === "curriculum") {
      const docName = attachmentInput?.value || "Academic_Curriculum_Syllabus.pdf";
      attachment = {
        name: docName,
        url: `/documents/${encodeURIComponent(docName)}`,
        size: "1.8 MB",
        type: "Verified Course Curriculum PDF"
      };
    }
    const body = {
      target: targetSelect?.value || "all",
      unitId: unitSelect?.value || null,
      category,
      title,
      message,
      event_date,
      attachment,
      bulk_mail
    };
    try {
      const res = await apiFetch("/api/messaging/send", {
        method: "POST",
        body: JSON.stringify(body)
      });
      if (bcLogs) {
        const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString();
        const entry = document.createElement("div");
        entry.className = "log-entry";
        entry.innerHTML = `
        <span class="log-time" style="color:var(--text-muted)">[${escapeHtml(timestamp)}]</span>
        <strong style="color:var(--notion-blue)">${escapeHtml(category.toUpperCase())} Broadcast Dispatched:</strong> ${escapeHtml(res.message)}<br>
        <span style="font-size:0.75rem; color:var(--text-secondary)">Recipients (${res.recipientCount})${bulk_mail ? " [Email requested]" : ""}: ${escapeHtml(res.recipients.join(", ") || "Directory members")}</span>
      `;
        bcLogs.insertBefore(entry, bcLogs.firstChild);
      }
      if (titleInput) titleInput.value = "";
      if (messageInput) messageInput.value = "";
      if (attachmentInput) attachmentInput.value = "";
      if (eventDateInput) eventDateInput.value = "";
      await loadBroadcastFeed();
    } catch (err) {
      if (bcLogs) {
        const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString();
        const entry = document.createElement("div");
        entry.className = "log-entry error";
        entry.innerHTML = `
        <span class="log-time" style="color:var(--text-muted)">[${escapeHtml(timestamp)}]</span>
        <strong>Broadcast Error:</strong> ${escapeHtml(err.message)}
      `;
        bcLogs.insertBefore(entry, bcLogs.firstChild);
      }
      alert(err.message || "Failed to dispatch broadcast");
    }
  }

  // src/frontend/ts/modals.ts
  function setupModalListeners() {
    const mModal = document.getElementById("member-modal");
    const btnOpenMemberModal = document.getElementById("btn-open-member-modal");
    const btnCloseMemberModal = document.getElementById("btn-close-member-modal");
    const btnCancelMemberModal = document.getElementById("btn-cancel-member-modal");
    if (btnOpenMemberModal && mModal) {
      btnOpenMemberModal.onclick = async () => {
        try {
          const units = await apiFetch("/api/units");
          const select = document.getElementById("reg-unit");
          if (select) {
            select.innerHTML = '<option value="">No Class / Faculty Assigned</option>' + units.map((u) => `<option value="${escapeAttribute(u.id)}">${escapeHtml(u.name)}</option>`).join("");
          }
        } catch (err) {
          console.error("Failed to load classes/faculties for registration modal:", err);
        }
        mModal.classList.add("active");
      };
    }
    if (btnCloseMemberModal && mModal) {
      btnCloseMemberModal.onclick = () => mModal.classList.remove("active");
    }
    if (btnCancelMemberModal && mModal) {
      btnCancelMemberModal.onclick = () => mModal.classList.remove("active");
    }
    const iModal = document.getElementById("inventory-modal");
    const btnOpenInventoryModal = document.getElementById("btn-open-inventory-modal");
    const btnCloseInventoryModal = document.getElementById("btn-close-inventory-modal");
    const btnCancelInventoryModal = document.getElementById("btn-cancel-inventory-modal");
    if (btnOpenInventoryModal && iModal) {
      btnOpenInventoryModal.onclick = async () => {
        try {
          const units = await apiFetch("/api/units");
          const select = document.getElementById("inv-unit");
          if (select) {
            select.innerHTML = '<option value="">No Specific Faculty / Dept</option>' + units.map((u) => `<option value="${escapeAttribute(u.id)}">${escapeHtml(u.name)}</option>`).join("");
          }
        } catch (err) {
          console.error("Failed to load faculties for inventory modal:", err);
        }
        iModal.classList.add("active");
      };
    }
    if (btnCloseInventoryModal && iModal) {
      btnCloseInventoryModal.onclick = () => iModal.classList.remove("active");
    }
    if (btnCancelInventoryModal && iModal) {
      btnCancelInventoryModal.onclick = () => iModal.classList.remove("active");
    }
    const dModal = document.getElementById("profile-detail-modal");
    const btnCloseDetailModal = document.getElementById("btn-close-detail-modal");
    if (btnCloseDetailModal && dModal) {
      btnCloseDetailModal.onclick = () => dModal.classList.remove("active");
    }
  }
  function setupRegistrationForms() {
    const memberForm = document.getElementById("member-register-form");
    if (memberForm) {
      memberForm.onsubmit = async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById("reg-name");
        const emailInput = document.getElementById("reg-email");
        const phoneInput = document.getElementById("reg-phone");
        const addressInput = document.getElementById("reg-address");
        const dobMonthInput = document.getElementById("reg-dob-month");
        const dobDayInput = document.getElementById("reg-dob-day");
        const roleSelect = document.getElementById("reg-role");
        const positionInput = document.getElementById("reg-position");
        const unitSelect = document.getElementById("reg-unit");
        const role = roleSelect?.value || "Student";
        const defaultPosition = role === "Student" ? "Student" : "Faculty Staff";
        const body = {
          name: nameInput?.value || "",
          email: emailInput?.value || "",
          phone: phoneInput?.value || "",
          address: addressInput?.value || "",
          dob_month: Number(dobMonthInput?.value || 1),
          dob_day: Number(dobDayInput?.value || 1),
          role,
          position: positionInput?.value || defaultPosition,
          unit_id: unitSelect?.value || null
        };
        try {
          await apiFetch("/api/members", {
            method: "POST",
            body: JSON.stringify(body)
          });
          alert("Profile successfully registered in SchoolBook database.");
          document.getElementById("member-modal")?.classList.remove("active");
          memberForm.reset();
          await loadMembersData();
        } catch (err) {
          alert(`Registration failed: ${err.message}`);
        }
      };
    }
    const invForm = document.getElementById("inventory-add-form");
    if (invForm) {
      invForm.onsubmit = async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById("inv-name");
        const descInput = document.getElementById("inv-description");
        const statusSelect = document.getElementById("inv-status");
        const unitSelect = document.getElementById("inv-unit");
        const body = {
          item_name: nameInput?.value || "",
          description: descInput?.value || "",
          status: statusSelect?.value || "Active",
          unit_id: unitSelect?.value || null
        };
        try {
          await apiFetch("/api/inventory", {
            method: "POST",
            body: JSON.stringify(body)
          });
          alert("Campus asset registered successfully in SchoolBook inventory.");
          document.getElementById("inventory-modal")?.classList.remove("active");
          invForm.reset();
          await loadInventoryData();
        } catch (err) {
          alert(`Inventory registration failed: ${err.message}`);
        }
      };
    }
  }

  // src/frontend/ts/main.ts
  var DEFAULT_AVATAR2 = "/avatar-default.svg";
  window.viewMemberDetail = viewMemberDetail;
  window.deleteMemberProfile = deleteMemberProfile;
  window.markMemberAttendance = markMemberAttendance;
  window.updateInventoryStatus = updateInventoryStatus;
  window.deleteInventoryItem = deleteInventoryItem;
  function refreshActiveTab() {
    if (!state.activeTenantId || !state.activeUserId) return;
    switch (state.activeTab) {
      case "overview":
        loadOverviewData();
        break;
      case "portal":
        loadPortalData();
        break;
      case "members":
        loadMembersData();
        break;
      case "attendance":
        loadAttendanceSheet();
        loadWorkersPerformance();
        break;
      case "inventory":
        loadInventoryData();
        break;
      case "financials":
        loadFinancialsData();
        break;
      case "broadcast":
        loadBroadcastContext();
        break;
    }
  }
  function setText2(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }
  function updateUserChrome(member, tenant) {
    const displayName = member.name || `${member.email || "SchoolBook"} User`;
    setText2("current-user-name", displayName);
    setText2("current-user-badge", member.role);
    setText2("current-user-dept", state.getUnitLabel(member.unit_id));
    setText2("notion-breadcrumb-campus", tenant.name);
    setText2("workspace-sidebar-name", tenant.name);
    setText2("topbar-tenant-name", tenant.name);
    const avatar = document.getElementById("current-user-avatar");
    if (avatar) {
      avatar.src = safeImageUrl(member.profile_picture_url || DEFAULT_AVATAR2);
      avatar.alt = `${displayName} profile picture`;
      avatar.onerror = () => {
        avatar.onerror = null;
        avatar.src = DEFAULT_AVATAR2;
      };
    }
    const profileCard = document.getElementById("user-profile-summary");
    if (profileCard) {
      profileCard.title = `${member.position || member.role} \xB7 ${member.email || ""}`;
    }
  }
  async function loadSession() {
    const [member, tenantResponse, units] = await Promise.all([
      apiFetch("/api/members/me"),
      apiFetch("/api/tenants/current"),
      apiFetch("/api/units").catch(() => [])
    ]);
    const tenant = {
      id: tenantResponse.id,
      name: tenantResponse.name,
      logo_url: tenantResponse.logoUrl ?? ""
    };
    state.setUnits(units);
    state.activeUser = member;
    state.activeUserId = member.id;
    state.activeTenantId = member.tenant_id;
    state.tenantsList = [tenant];
    updateUserChrome(member, tenant);
    applyRBACStyling();
  }
  function setupLogout() {
    const logoutButton = document.getElementById("btn-logout");
    if (!logoutButton) return;
    logoutButton.addEventListener("click", async (event) => {
      event.preventDefault();
      logoutButton.setAttribute("aria-busy", "true");
      try {
        await apiFetch("/api/auth/logout", { method: "POST" });
      } catch {
      }
      window.location.assign("/login");
    });
  }
  function setupTabNavigation() {
    const buttons = document.querySelectorAll(".nav-btn");
    const menuWrapper = document.getElementById("sidebar-menu-wrapper");
    const hamburgerBtn = document.getElementById("mobile-hamburger");
    const sidebar = document.querySelector(".notion-sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    const closeDrawer = () => {
      sidebar?.classList.remove("is-open");
      hamburgerBtn?.classList.remove("active");
      backdrop?.classList.remove("active");
      if (menuWrapper?.classList.contains("active")) {
        menuWrapper.classList.remove("active");
      }
    };
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const tabId = btn.getAttribute("data-tab");
        state.activeTab = tabId;
        document.querySelectorAll(".tab-pane").forEach((pane) => {
          pane.classList.remove("active");
        });
        document.getElementById(`pane-${tabId}`)?.classList.add("active");
        closeDrawer();
        refreshActiveTab();
      });
    });
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener("click", () => {
        const willOpen = !sidebar?.classList.contains("is-open");
        sidebar?.classList.toggle("is-open", willOpen);
        hamburgerBtn.classList.toggle("active", willOpen);
        backdrop?.classList.toggle("active", willOpen);
        menuWrapper?.classList.toggle("active", willOpen);
      });
    }
    backdrop?.addEventListener("click", closeDrawer);
  }
  function setupThemeHandler() {
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const htmlEl = document.documentElement;
    const applyTheme = (theme) => {
      htmlEl.setAttribute("data-theme", theme);
      try {
        localStorage.setItem("schoolbook-theme", theme);
      } catch {
      }
      if (themeToggleBtn) {
        themeToggleBtn.textContent = theme === "dark" ? "\u2600\uFE0F" : "\u{1F319}";
        themeToggleBtn.setAttribute("title", theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode");
      }
    };
    const initialTheme = (() => {
      try {
        const stored = localStorage.getItem("schoolbook-theme");
        if (stored === "dark" || stored === "light") return stored;
      } catch {
      }
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    })();
    applyTheme(initialTheme);
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const current = htmlEl.getAttribute("data-theme") || "light";
        applyTheme(current === "dark" ? "light" : "dark");
      });
    }
    window.addEventListener("storage", (e) => {
      if (e.key === "schoolbook-theme" && (e.newValue === "dark" || e.newValue === "light")) {
        applyTheme(e.newValue);
      }
    });
  }
  function setupDOMListeners() {
    setupThemeHandler();
    setupTabNavigation();
    setupLogout();
    setupModalListeners();
    setupRegistrationForms();
    setupAccessModal();
    const attDateInput = document.getElementById("att-service-date");
    if (attDateInput) {
      attDateInput.value = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    }
    const memberSearch = document.getElementById("member-search-input");
    const memberRole = document.getElementById("member-role-filter");
    const memberStatus = document.getElementById("member-status-filter");
    if (memberSearch) memberSearch.onkeyup = () => loadMembersData();
    if (memberRole) memberRole.onchange = () => loadMembersData();
    if (memberStatus) memberStatus.onchange = () => loadMembersData();
    const attForm = document.getElementById("attendance-setup-form");
    if (attForm) {
      attForm.onsubmit = (e) => {
        e.preventDefault();
        loadAttendanceSheet();
      };
    }
    const btnCloseService = document.getElementById("btn-close-service");
    if (btnCloseService) {
      btnCloseService.onclick = () => closeServiceAttendance();
    }
    const payMethod = document.getElementById("pay-method");
    const cardFields = document.getElementById("card-fields");
    if (payMethod && cardFields) {
      payMethod.onchange = (e) => {
        const target = e.target;
        cardFields.style.display = target.value === "Card" ? "block" : "none";
      };
    }
    const payForm = document.getElementById("payment-gateway-form");
    if (payForm) {
      payForm.onsubmit = handlePaymentSubmit;
    }
    const bcForm = document.getElementById("broadcast-compose-form");
    if (bcForm) {
      bcForm.onsubmit = handleBroadcastSubmit;
    }
    const btnSavePortal = document.getElementById("btn-save-portal");
    if (btnSavePortal) {
      btnSavePortal.onclick = () => savePortalChanges();
    }
    const btnAddSubject = document.getElementById("btn-add-subject");
    if (btnAddSubject) {
      btnAddSubject.onclick = () => addSubjectRow();
    }
    const btnBulkEmailGuardian = document.getElementById("btn-bulk-email-guardian");
    if (btnBulkEmailGuardian) {
      btnBulkEmailGuardian.onclick = () => bulkEmailGuardian();
    }
  }
  document.addEventListener("DOMContentLoaded", async () => {
    setupDOMListeners();
    try {
      await loadSession();
      refreshActiveTab();
    } catch (err) {
      const status = err.status;
      if (status === 401 || status === 403) {
        window.location.assign("/login");
        return;
      }
      console.error("Initialization error:", err);
      showConnectionIssue();
    }
  });
})();
//# sourceMappingURL=app.js.map
