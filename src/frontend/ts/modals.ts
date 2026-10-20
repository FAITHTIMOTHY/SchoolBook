/**
 * SchoolBook SMS - Modals and Forms Controller
 */

import { apiFetch } from './api.js';
import { Unit } from './types.js';
import { loadMembersData } from './tabs/membersTab.js';
import { loadInventoryData } from './tabs/inventoryTab.js';

export function setupModalListeners(): void {
  // 1. Student & Staff Registry Modal
  const mModal = document.getElementById('member-modal');
  const btnOpenMemberModal = document.getElementById('btn-open-member-modal');
  const btnCloseMemberModal = document.getElementById('btn-close-member-modal');
  const btnCancelMemberModal = document.getElementById('btn-cancel-member-modal');

  if (btnOpenMemberModal && mModal) {
    btnOpenMemberModal.onclick = async () => {
      try {
        const units = await apiFetch<Unit[]>('/api/units');
        const select = document.getElementById('reg-unit') as HTMLSelectElement | null;
        if (select) {
          select.innerHTML = '<option value="">No Class / Faculty Assigned</option>' + 
            units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        }
      } catch (err) {
        console.error('Failed to load classes/faculties for registration modal:', err);
      }
      mModal.classList.add('active');
    };
  }

  if (btnCloseMemberModal && mModal) {
    btnCloseMemberModal.onclick = () => mModal.classList.remove('active');
  }
  if (btnCancelMemberModal && mModal) {
    btnCancelMemberModal.onclick = () => mModal.classList.remove('active');
  }

  // 2. Campus Inventory Modal
  const iModal = document.getElementById('inventory-modal');
  const btnOpenInventoryModal = document.getElementById('btn-open-inventory-modal');
  const btnCloseInventoryModal = document.getElementById('btn-close-inventory-modal');
  const btnCancelInventoryModal = document.getElementById('btn-cancel-inventory-modal');

  if (btnOpenInventoryModal && iModal) {
    btnOpenInventoryModal.onclick = async () => {
      try {
        const units = await apiFetch<Unit[]>('/api/units');
        const select = document.getElementById('inv-unit') as HTMLSelectElement | null;
        if (select) {
          select.innerHTML = '<option value="">No Specific Faculty / Dept</option>' +
            units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        }
      } catch (err) {
        console.error('Failed to load faculties for inventory modal:', err);
      }
      iModal.classList.add('active');
    };
  }

  if (btnCloseInventoryModal && iModal) {
    btnCloseInventoryModal.onclick = () => iModal.classList.remove('active');
  }
  if (btnCancelInventoryModal && iModal) {
    btnCancelInventoryModal.onclick = () => iModal.classList.remove('active');
  }

  // 3. Profile Details Inspector Modal
  const dModal = document.getElementById('profile-detail-modal');
  const btnCloseDetailModal = document.getElementById('btn-close-detail-modal');
  if (btnCloseDetailModal && dModal) {
    btnCloseDetailModal.onclick = () => dModal.classList.remove('active');
  }
}

export function setupRegistrationForms(): void {
  // Student / Staff Registration Submit
  const memberForm = document.getElementById('member-register-form') as HTMLFormElement | null;
  if (memberForm) {
    memberForm.onsubmit = async (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('reg-name') as HTMLInputElement | null;
      const emailInput = document.getElementById('reg-email') as HTMLInputElement | null;
      const phoneInput = document.getElementById('reg-phone') as HTMLInputElement | null;
      const addressInput = document.getElementById('reg-address') as HTMLInputElement | null;
      const dobMonthInput = document.getElementById('reg-dob-month') as HTMLInputElement | null;
      const dobDayInput = document.getElementById('reg-dob-day') as HTMLInputElement | null;
      const roleSelect = document.getElementById('reg-role') as HTMLSelectElement | null;
      const positionInput = document.getElementById('reg-position') as HTMLInputElement | null;
      const unitSelect = document.getElementById('reg-unit') as HTMLSelectElement | null;

      const role = roleSelect?.value || 'Student';
      const defaultPosition = role === 'Student' ? 'Student' : 'Faculty Staff';

      const body = {
        name: nameInput?.value || '',
        email: emailInput?.value || '',
        phone: phoneInput?.value || '',
        address: addressInput?.value || '',
        dob_month: Number(dobMonthInput?.value || 1),
        dob_day: Number(dobDayInput?.value || 1),
        role: role,
        position: positionInput?.value || defaultPosition,
        unit_id: unitSelect?.value || null,
      };

      try {
        await apiFetch('/api/members', {
          method: 'POST',
          body: JSON.stringify(body)
        });

        alert('Profile successfully registered in SchoolBook database.');
        document.getElementById('member-modal')?.classList.remove('active');
        memberForm.reset();
        await loadMembersData();

      } catch (err: any) {
        alert(`Registration failed: ${err.message}`);
      }
    };
  }

  // Inventory Item Submit
  const invForm = document.getElementById('inventory-add-form') as HTMLFormElement | null;
  if (invForm) {
    invForm.onsubmit = async (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('inv-name') as HTMLInputElement | null;
      const descInput = document.getElementById('inv-description') as HTMLInputElement | null;
      const statusSelect = document.getElementById('inv-status') as HTMLSelectElement | null;
      const unitSelect = document.getElementById('inv-unit') as HTMLSelectElement | null;

      const body = {
        item_name: nameInput?.value || '',
        description: descInput?.value || '',
        status: statusSelect?.value || 'Active',
        unit_id: unitSelect?.value || null,
      };

      try {
        await apiFetch('/api/inventory', {
          method: 'POST',
          body: JSON.stringify(body)
        });

        alert('Campus asset registered successfully in SchoolBook inventory.');
        document.getElementById('inventory-modal')?.classList.remove('active');
        invForm.reset();
        await loadInventoryData();

      } catch (err: any) {
        alert(`Inventory registration failed: ${err.message}`);
      }
    };
  }
}
