/**
 * SchoolBook SMS - Client Controller Entry Point
 * Top-tier TypeScript Single Page App Architecture
 */

import { state } from './state.js';
import { apiFetch, showConnectionIssue } from './api.js';
import { applyRBACStyling } from './rbac.js';
import { safeImageUrl } from './html.js';
import { Member, Tenant, Unit, ActiveTab } from './types.js';

import { loadOverviewData } from './tabs/overviewTab.js';
import { loadPortalData, savePortalChanges, addSubjectRow, bulkEmailGuardian } from './tabs/portalTab.js';
import { loadMembersData, viewMemberDetail, deleteMemberProfile, setupAccessModal } from './tabs/membersTab.js';
import { loadAttendanceSheet, markMemberAttendance, closeServiceAttendance, loadWorkersPerformance } from './tabs/attendanceTab.js';
import { loadInventoryData, updateInventoryStatus, deleteInventoryItem } from './tabs/inventoryTab.js';
import { loadFinancialsData, handlePaymentSubmit } from './tabs/financialsTab.js';
import { loadBroadcastContext, handleBroadcastSubmit } from './tabs/broadcastTab.js';
import { setupModalListeners, setupRegistrationForms } from './modals.js';

const DEFAULT_AVATAR = '/avatar-default.svg';

// Expose handlers to global window for table row inline triggers
declare global {
  interface Window {
    viewMemberDetail: typeof viewMemberDetail;
    deleteMemberProfile: typeof deleteMemberProfile;
    markMemberAttendance: typeof markMemberAttendance;
    updateInventoryStatus: typeof updateInventoryStatus;
    deleteInventoryItem: typeof deleteInventoryItem;
  }
}

window.viewMemberDetail = viewMemberDetail;
window.deleteMemberProfile = deleteMemberProfile;
window.markMemberAttendance = markMemberAttendance;
window.updateInventoryStatus = updateInventoryStatus;
window.deleteInventoryItem = deleteInventoryItem;

export function refreshActiveTab(): void {
  if (!state.activeTenantId || !state.activeUserId) return;

  switch (state.activeTab) {
    case 'overview':
      loadOverviewData();
      break;
    case 'portal':
      loadPortalData();
      break;
    case 'members':
      loadMembersData();
      break;
    case 'attendance':
      loadAttendanceSheet();
      loadWorkersPerformance();
      break;
    case 'inventory':
      loadInventoryData();
      break;
    case 'financials':
      loadFinancialsData();
      break;
    case 'broadcast':
      loadBroadcastContext();
      break;
  }
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function updateUserChrome(member: Member, tenant: Tenant): void {
  const displayName =
    member.name ||
    `${member.email || 'SchoolBook'} User`;

  setText('current-user-name', displayName);
  setText('current-user-badge', member.role);
  setText('current-user-dept', state.getUnitLabel(member.unit_id));
  setText('notion-breadcrumb-campus', tenant.name);
  setText('workspace-sidebar-name', tenant.name);
  setText('topbar-tenant-name', tenant.name);

  const avatar = document.getElementById('current-user-avatar') as HTMLImageElement | null;
  if (avatar) {
    avatar.src = safeImageUrl(member.profile_picture_url || DEFAULT_AVATAR);
    avatar.alt = `${displayName} profile picture`;
    avatar.onerror = () => {
      avatar.onerror = null;
      avatar.src = DEFAULT_AVATAR;
    };
  }

  const profileCard = document.getElementById('user-profile-summary');
  if (profileCard) {
    profileCard.title = `${member.position || member.role} · ${member.email || ''}`;
  }
}

async function loadSession(): Promise<void> {
  const [member, tenantResponse, units] = await Promise.all([
    apiFetch<Member>('/api/members/me'),
    apiFetch<{
      id: string;
      name: string;
      slug: string;
      logoUrl?: string | null;
    }>('/api/tenants/current'),
    apiFetch<Unit[]>('/api/units').catch(() => [] as Unit[]),
  ]);

  const tenant: Tenant = {
    id: tenantResponse.id,
    name: tenantResponse.name,
    logo_url: tenantResponse.logoUrl ?? '',
  };

  state.setUnits(units);
  state.activeUser = member;
  state.activeUserId = member.id;
  state.activeTenantId = member.tenant_id;
  state.tenantsList = [tenant];

  updateUserChrome(member, tenant);
  applyRBACStyling();
}

function setupLogout(): void {
  const logoutButton = document.getElementById('btn-logout');
  if (!logoutButton) return;

  logoutButton.addEventListener('click', async (event) => {
    event.preventDefault();
    logoutButton.setAttribute('aria-busy', 'true');

    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // The cookies are cleared by the server even when the session is already
      // expired. The redirect below is still the correct outcome.
    }

    window.location.assign('/login');
  });
}

function setupTabNavigation(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.nav-btn');
  const menuWrapper = document.getElementById('sidebar-menu-wrapper');
  const hamburgerBtn = document.getElementById('mobile-hamburger');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tabId = btn.getAttribute('data-tab') as ActiveTab;
      state.activeTab = tabId;

      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
      });
      document.getElementById(`pane-${tabId}`)?.classList.add('active');

      // Auto-collapse mobile drawer
      if (menuWrapper?.classList.contains('active')) {
        menuWrapper.classList.remove('active');
      }
      if (hamburgerBtn?.classList.contains('active')) {
        hamburgerBtn.classList.remove('active');
      }

      refreshActiveTab();
    });
  });

  // Mobile hamburger toggle
  if (hamburgerBtn && menuWrapper) {
    hamburgerBtn.addEventListener('click', () => {
      hamburgerBtn.classList.toggle('active');
      menuWrapper.classList.toggle('active');
    });
  }
}

/**
 * Global Theme Handler for Notion Light & Dark Mode
 */
function setupThemeHandler(): void {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const htmlEl = document.documentElement;

  const applyTheme = (theme: string): void => {
    htmlEl.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('schoolbook-theme', theme);
    } catch {
      // ignore storage access restrictions
    }
    if (themeToggleBtn) {
      themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
      themeToggleBtn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    }
  };

  const initialTheme = ((): string => {
    try {
      const stored = localStorage.getItem('schoolbook-theme');
      if (stored === 'dark' || stored === 'light') return stored;
    } catch {
      // ignore
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  })();

  applyTheme(initialTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const current = htmlEl.getAttribute('data-theme') || 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'schoolbook-theme' && (e.newValue === 'dark' || e.newValue === 'light')) {
      applyTheme(e.newValue);
    }
  });
}

function setupDOMListeners(): void {
  setupThemeHandler();
  setupTabNavigation();
  setupLogout();
  setupModalListeners();
  setupRegistrationForms();
  setupAccessModal();

  // Set default date for attendance form
  const attDateInput = document.getElementById('att-service-date') as HTMLInputElement | null;
  if (attDateInput) {
    attDateInput.value = new Date().toISOString().split('T')[0];
  }

  // Members search bar filter listeners
  const memberSearch = document.getElementById('member-search-input');
  const memberRole = document.getElementById('member-role-filter');
  const memberStatus = document.getElementById('member-status-filter');

  if (memberSearch) memberSearch.onkeyup = () => loadMembersData();
  if (memberRole) memberRole.onchange = () => loadMembersData();
  if (memberStatus) memberStatus.onchange = () => loadMembersData();

  // Attendance form listener
  const attForm = document.getElementById('attendance-setup-form');
  if (attForm) {
    attForm.onsubmit = (e) => {
      e.preventDefault();
      loadAttendanceSheet();
    };
  }

  // Close service button
  const btnCloseService = document.getElementById('btn-close-service');
  if (btnCloseService) {
    btnCloseService.onclick = () => closeServiceAttendance();
  }

  // Payment form listener
  const payMethod = document.getElementById('pay-method') as HTMLSelectElement | null;
  const cardFields = document.getElementById('card-fields');
  if (payMethod && cardFields) {
    payMethod.onchange = (e) => {
      const target = e.target as HTMLSelectElement;
      cardFields.style.display = target.value === 'Card' ? 'block' : 'none';
    };
  }

  const payForm = document.getElementById('payment-gateway-form');
  if (payForm) {
    payForm.onsubmit = handlePaymentSubmit;
  }

  // Broadcast form listener
  const bcForm = document.getElementById('broadcast-compose-form');
  if (bcForm) {
    bcForm.onsubmit = handleBroadcastSubmit;
  }

  // Student Portal listeners
  const btnSavePortal = document.getElementById('btn-save-portal');
  if (btnSavePortal) {
    btnSavePortal.onclick = () => savePortalChanges();
  }

  const btnAddSubject = document.getElementById('btn-add-subject');
  if (btnAddSubject) {
    btnAddSubject.onclick = () => addSubjectRow();
  }

  const btnBulkEmailGuardian = document.getElementById('btn-bulk-email-guardian');
  if (btnBulkEmailGuardian) {
    btnBulkEmailGuardian.onclick = () => bulkEmailGuardian();
  }
}

// App Initialization
document.addEventListener('DOMContentLoaded', async () => {
  setupDOMListeners();

  try {
    await loadSession();
    refreshActiveTab();
  } catch (err) {
    const status = (err as { status?: number }).status;

    if (status === 401 || status === 403) {
      window.location.assign('/login');
      return;
    }

    console.error('Initialization error:', err);
    showConnectionIssue();
  }
});
