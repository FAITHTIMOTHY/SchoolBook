/**
 * SchoolBook SMS - Client Controller Entry Point
 * Top-tier TypeScript Single Page App Architecture
 */

import { state } from './state.js';
import { apiFetch, showConnectionIssue, API_BASE } from './api.js';
import { applyRBACStyling } from './rbac.js';
import { Tenant, MemberProfileSummary, ActiveTab } from './types.js';

import { loadOverviewData } from './tabs/overviewTab.js';
import { loadPortalData, savePortalChanges, addSubjectRow, bulkEmailGuardian } from './tabs/portalTab.js';
import { loadMembersData, viewMemberDetail, deleteMemberProfile } from './tabs/membersTab.js';
import { loadAttendanceSheet, markMemberAttendance, closeServiceAttendance, loadWorkersPerformance } from './tabs/attendanceTab.js';
import { loadInventoryData, updateInventoryStatus, deleteInventoryItem } from './tabs/inventoryTab.js';
import { loadFinancialsData, handlePaymentSubmit } from './tabs/financialsTab.js';
import { loadBroadcastContext, handleBroadcastSubmit } from './tabs/broadcastTab.js';
import { setupModalListeners, setupRegistrationForms } from './modals.js';

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

function selectUserProfile(userId: string): void {
  state.activeUserId = userId;
  const profileSelector = document.getElementById('profile-selector') as HTMLSelectElement | null;
  if (profileSelector) profileSelector.value = userId;

  state.activeUser = state.profilesList.find(p => p.id === userId) || null;

  if (state.activeUser) {
    const elName = document.getElementById('current-user-name');
    const elBadge = document.getElementById('current-user-badge');
    const elAvatar = document.getElementById('current-user-avatar') as HTMLImageElement | null;
    const elDept = document.getElementById('current-user-dept');

    if (elName) elName.textContent = state.activeUser.name;
    if (elBadge) elBadge.textContent = state.activeUser.role;
    if (elAvatar) {
      elAvatar.src = state.activeUser.profile_picture_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop';
    }
    if (elDept) {
      elDept.textContent = state.getUnitLabel(state.activeUser.unit_id);
    }

    applyRBACStyling();
  }
}

async function loadProfilesForTenant(tenantId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/profiles?tenantId=${tenantId}`);
    if (!response.ok) throw new Error('Failed to load profiles');
    state.profilesList = await response.json() as MemberProfileSummary[];

    const profileSelector = document.getElementById('profile-selector') as HTMLSelectElement | null;
    if (profileSelector) {
      profileSelector.innerHTML = state.profilesList.map(p =>
        `<option value="${p.id}">${p.name} (${p.position})</option>`
      ).join('');
    }

    if (state.profilesList.length > 0) {
      selectUserProfile(state.profilesList[0].id);
    }
  } catch (err) {
    console.error('Failed to load profiles for tenant:', err);
  }
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
  setupModalListeners();
  setupRegistrationForms();

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
    // 1. Load Tenants
    const response = await fetch(`${API_BASE}/api/tenants`);
    if (!response.ok) throw new Error('Could not fetch tenants');
    state.tenantsList = await response.json() as Tenant[];

    const tenantSelector = document.getElementById('tenant-selector') as HTMLSelectElement | null;
    if (tenantSelector) {
      tenantSelector.innerHTML = state.tenantsList.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

      if (state.tenantsList.length > 0) {
        state.activeTenantId = state.tenantsList[0].id;
        tenantSelector.value = state.activeTenantId;
      }

      tenantSelector.addEventListener('change', async (e) => {
        state.activeTenantId = (e.target as HTMLSelectElement).value;
        await loadProfilesForTenant(state.activeTenantId);
        refreshActiveTab();
      });
    }

    // 2. Load Profiles for selected tenant
    if (state.activeTenantId) {
      await loadProfilesForTenant(state.activeTenantId);
    }

    const profileSelector = document.getElementById('profile-selector');
    if (profileSelector) {
      profileSelector.addEventListener('change', (e) => {
        selectUserProfile((e.target as HTMLSelectElement).value);
        refreshActiveTab();
      });
    }

    // 3. Initial active tab render
    refreshActiveTab();

  } catch (err) {
    console.error('Initialization error:', err);
    showConnectionIssue();
  }
});

