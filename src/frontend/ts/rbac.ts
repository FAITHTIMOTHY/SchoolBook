/**
 * SchoolBook SMS - Role-Based Access Control (RBAC) UI Manager
 */

import { state } from './state.js';

export function applyRBACStyling(): void {
  if (!state.activeUser) return;
  const role = state.activeUser.role;

  // 0. Hide workspaces the signed-in account cannot use. This prevents a
  // finance officer or student from landing on a tab that only returns 403s.
  const setTabVisible = (tab: string, visible: boolean): void => {
    const button = document.querySelector<HTMLElement>(
      `.nav-btn[data-tab="${tab}"]`,
    );
    if (button) button.style.display = visible ? '' : 'none';
  };

  const studentView = state.isStudent();

  setTabVisible('portal', state.canViewPortal());
  setTabVisible('members', !studentView);
  setTabVisible('attendance', state.isTeacherOrPrincipal());
  setTabVisible('inventory', !studentView);
  setTabVisible('financials', !studentView);
  setTabVisible('broadcast', true);

  // 1. Members/Students Tab: Register button visibility (Principal, Counselor)
  const btnOpenMemberModal = document.getElementById('btn-open-member-modal');
  if (btnOpenMemberModal) {
    btnOpenMemberModal.style.display = state.canRegisterMembers() ? 'block' : 'none';
  }

  // 2. Attendance Tab: Marking sheet & close button restricted to Teachers and Principals
  const attBanner = document.getElementById('attendance-restricted-banner');
  const attCloseBtn = document.getElementById('btn-close-service');
  const isTeacherOrPrincipal = state.isTeacherOrPrincipal();

  if (attBanner) {
    attBanner.style.display = isTeacherOrPrincipal ? 'none' : 'block';
  }
  if (attCloseBtn) {
    attCloseBtn.style.display = isTeacherOrPrincipal ? 'inline-flex' : 'none';
  }

  // 3. Inventory Tab: Adding items is limited to staff with edit rights.
  const btnOpenInventoryModal = document.getElementById('btn-open-inventory-modal');
  if (btnOpenInventoryModal) {
    btnOpenInventoryModal.style.display = state.isAuthorizedToEditInventory()
      ? 'block'
      : 'none';
  }

  const invBanner = document.getElementById('inventory-restricted-banner');
  if (invBanner) {
    invBanner.style.display = state.isAuthorizedToEditInventory()
      ? 'none'
      : 'block';
  }

  // 4. Financial Tab: Audit panel vs Denied panel visibility (Principal & Bursar)
  const auditPanel = document.getElementById('finance-audit-panel');
  const deniedPanel = document.getElementById('finance-denied-panel');
  const canAccessFinance = state.canAccessFinance();

  if (auditPanel) {
    auditPanel.style.display = canAccessFinance ? 'block' : 'none';
  }
  if (deniedPanel) {
    deniedPanel.style.display = canAccessFinance ? 'none' : 'flex';
  }

  // 5. Broadcast Tab: Compose form accessible to Principal, Counselors, and Teachers
  const broadcastArea = document.getElementById('broadcast-content-area');
  const broadcastBanner = document.getElementById('broadcast-restricted-banner');
  const canBroadcast = state.canBroadcast();

  if (canBroadcast) {
    if (broadcastArea) broadcastArea.style.display = 'flex';
    if (broadcastBanner) broadcastBanner.style.display = 'none';

    const targetSelect = document.getElementById('bc-target') as HTMLSelectElement | null;
    const unitGroup = document.getElementById('bc-unit-group');

    if (targetSelect && unitGroup) {
      if (role === 'Principal' || role === 'Teacher') {
        if (targetSelect.options[0]) targetSelect.options[0].disabled = false;
        unitGroup.style.display = targetSelect.value === 'unit' ? 'block' : 'none';
      } else {
        targetSelect.value = 'unit';
        if (targetSelect.options[0]) targetSelect.options[0].disabled = true;
        unitGroup.style.display = 'block';
      }
    }
  } else {
    if (broadcastArea) broadcastArea.style.display = 'none';
    if (broadcastBanner) broadcastBanner.style.display = 'block';
  }

  // 6. Student Portal Tab: Editing restricted to Teachers and Management; read-only for Student/Guardian
  const portalEditBar = document.getElementById('portal-editor-controls');
  const portalReadOnlyBanner = document.getElementById('portal-readonly-banner');
  const portalStudentSelector = document.getElementById('portal-student-selector-wrap');
  const canEditPortal = state.canEditPortal();

  if (portalEditBar) {
    portalEditBar.style.display = canEditPortal ? 'flex' : 'none';
  }
  if (portalReadOnlyBanner) {
    portalReadOnlyBanner.style.display = canEditPortal ? 'none' : 'flex';
  }
  if (portalStudentSelector) {
    // Teachers & Management can select which student portal to edit; Students see only their own
    portalStudentSelector.style.display = canEditPortal ? 'block' : 'none';
  }
}
