/**
 * SchoolBook SMS - Attendance Center Controller
 */

import { apiFetch } from '../api.js';
import { state } from '../state.js';
import { AttendanceSheetResponse, AttendanceStatsResponse } from '../types.js';

export async function loadAttendanceSheet(): Promise<void> {
  const tbody = document.getElementById('attendance-sheet-tbody');
  const btnClose = document.getElementById('btn-close-service') as HTMLButtonElement | null;
  const sheetTitle = document.getElementById('active-sheet-title');

  // Attendance marking sheets are restricted to Teachers and Principals
  if (!state.isTeacherOrPrincipal()) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center">Attendance registers are restricted to Teaching Staff and Principals.</td></tr>`;
    }
    if (btnClose) btnClose.disabled = true;
    return;
  }

  try {
    const serviceNameInput = document.getElementById('att-service-name') as HTMLSelectElement | null;
    const serviceDateInput = document.getElementById('att-service-date') as HTMLInputElement | null;

    const serviceName = serviceNameInput?.value || 'Morning Roll Call';
    const date = serviceDateInput?.value || new Date().toISOString().split('T')[0];

    const data = await apiFetch<AttendanceSheetResponse>(`/api/attendance/sheet?date=${date}&serviceName=${encodeURIComponent(serviceName)}`);

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

    tbody.innerHTML = data.sheet.map(m => `
      <tr>
        <td><strong>${m.memberName}</strong></td>
        <td><span class="badge badge-role">${m.role}</span> (${m.position || (m.role === 'Student' ? 'Student' : 'Staff')})</td>
        <td>
          <div class="flex-row gap-2 align-center">
            <input type="checkbox" id="check-${m.memberId}" ${m.status === 'Present' ? 'checked' : ''} 
              onchange="window.markMemberAttendance('${m.memberId}', '${data.serviceDate}', '${data.serviceName}', this.checked ? 'Present' : 'Absent')">
            <label for="check-${m.memberId}">${m.status}</label>
          </div>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Failed to load attendance checklist sheet:', err);
  }
}

export async function markMemberAttendance(
  memberId: string,
  serviceDate: string,
  serviceName: string,
  status: 'Present' | 'Absent'
): Promise<void> {
  try {
    await apiFetch('/api/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({ memberId, serviceDate, serviceName, status })
    });

    // Update the label text dynamically
    const label = document.querySelector(`label[for="check-${memberId}"]`);
    if (label) label.textContent = status;

  } catch (err: any) {
    alert(`Failed to save attendance: ${err.message}`);
  }
}

export async function closeServiceAttendance(): Promise<void> {
  const serviceNameInput = document.getElementById('att-service-name') as HTMLSelectElement | null;
  const serviceDateInput = document.getElementById('att-service-date') as HTMLInputElement | null;

  const serviceName = serviceNameInput?.value || 'Morning Roll Call';
  const serviceDate = serviceDateInput?.value || new Date().toISOString().split('T')[0];

  if (!confirm(`Are you sure you want to close the attendance register for ${serviceName} on ${serviceDate}? Anyone unmarked will be automatically recorded as Absent.`)) {
    return;
  }

  try {
    const res = await apiFetch<{ message: string }>('/api/attendance/close-service', {
      method: 'POST',
      body: JSON.stringify({ serviceDate, serviceName })
    });

    alert(res.message);
    await loadAttendanceSheet();
    await loadWorkersPerformance();

  } catch (err: any) {
    alert(err.message || 'Failed to close session');
  }
}

export async function loadWorkersPerformance(): Promise<void> {
  const tbody = document.getElementById('workers-performance-tbody');
  const elRate = document.getElementById('workers-activeness-rate');

  const isStatsLeader = ['Principal', 'Counselor'].includes(state.activeUser?.role || '');

  if (!isStatsLeader) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center">Reports restricted to academic administrators.</td></tr>`;
    }
    if (elRate) elRate.textContent = 'Locked';
    return;
  }

  try {
    const data = await apiFetch<AttendanceStatsResponse>('/api/attendance/stats?type=faculty');
    if (elRate) elRate.textContent = `${data.avgAttendanceRate}%`;

    if (!tbody) return;

    if (data.memberPerformance.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center">No staff or student attendance logs recorded.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.memberPerformance.map(w => `
      <tr>
        <td><strong>${w.name}</strong></td>
        <td><span class="badge badge-role">${w.role}</span></td>
        <td>${w.presentCount}/${w.totalServices}</td>
        <td><strong>${w.attendanceRate}%</strong></td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Failed loading attendance consistency statistics:', err);
  }
}
