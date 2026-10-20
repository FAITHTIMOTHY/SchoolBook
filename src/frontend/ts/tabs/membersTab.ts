/**
 * SchoolBook SMS - Students & Staff Directory Controller
 * STRICT REQUIREMENTS:
 * "-For Identification, academic performances will have a green, yellow and red circle, green for performamces greater than 70, yellow for between 69-50, and red for the rest."
 * "Core Admin and academic staff have profiles on the site."
 */

import { apiFetch } from '../api.js';
import { state } from '../state.js';
import { Member } from '../types.js';
import { getPerformanceBadge } from './portalTab.js';

export async function loadMembersData(): Promise<void> {
  try {
    const searchInput = document.getElementById('member-search-input') as HTMLInputElement | null;
    const roleSelect = document.getElementById('member-role-filter') as HTMLSelectElement | null;
    const statusSelect = document.getElementById('member-status-filter') as HTMLSelectElement | null;

    const search = searchInput?.value || '';
    const role = roleSelect?.value || '';
    const status = statusSelect?.value || '';

    let query = '?';
    if (search) query += `search=${encodeURIComponent(search)}&`;
    if (role) query += `role=${encodeURIComponent(role)}&`;
    if (status) query += `status=${encodeURIComponent(status)}&`;

    const members = await apiFetch<Member[]>(`/api/members${query}`);
    const tbody = document.getElementById('members-list-tbody');
    if (!tbody) return;

    if (members.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center">No matching students or faculty members found.</td></tr>`;
      return;
    }

    tbody.innerHTML = members.map(m => {
      // Academic Performance Identification Circle for Students
      let perfDisplay = `<span class="notion-tag tag-gray">Faculty / Staff</span>`;
      if (m.role === 'Student') {
        const perf = getPerformanceBadge(m.academic_score);
        perfDisplay = `
          <div class="perf-row-pill" title="Performance: ${m.academic_score || 0}% (${perf.standingText})">
            ${perf.circleHtml}
            <strong>${m.academic_score || 0}%</strong>
          </div>
        `;
      } else if (m.role === 'Principal' || m.role === 'Dean') {
        perfDisplay = `<span class="notion-tag tag-purple">Core Admin</span>`;
      } else {
        perfDisplay = `<span class="notion-tag tag-blue">Academic Staff</span>`;
      }

      return `
        <tr>
          <td><img src="${m.profile_picture_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}" alt="Avatar" class="table-avatar"></td>
          <td><strong>${m.name}</strong></td>
          <td><span class="badge badge-role">${m.role}</span></td>
          <td>${m.position || (m.role === 'Student' ? 'Student' : 'Faculty Staff')}</td>
          <td>${perfDisplay}</td>
          <td><span class="badge ${m.status === 'Active' ? 'badge-active' : 'badge-inactive'}">${m.status}</span></td>
          <td>
            <div class="flex-row gap-1 justify-end">
              <button class="btn btn-secondary btn-sm" onclick="window.viewMemberDetail('${m.id}')">👤 Profile</button>
              ${m.role === 'Student' ? `<button class="btn btn-primary btn-sm" onclick="window.switchToStudentPortal('${m.id}')">🎓 Portal</button>` : ''}
              ${state.isPrincipal() ? `<button class="btn btn-danger btn-sm" onclick="window.deleteMemberProfile('${m.id}')">✖</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed loading student/staff registry list:', err);
  }
}

export async function viewMemberDetail(id: string): Promise<void> {
  try {
    const member = await apiFetch<Member>(`/api/members/${id}`);

    const detAvatar = document.getElementById('det-avatar') as HTMLImageElement | null;
    const detName = document.getElementById('det-name');
    const detRoleBadge = document.getElementById('det-role-badge');
    const detPosition = document.getElementById('det-position');
    const statusEl = document.getElementById('det-status');
    const detUnit = document.getElementById('det-unit');
    const detEmail = document.getElementById('det-email');
    const detPhone = document.getElementById('det-phone');
    const detAddress = document.getElementById('det-address');
    const detDob = document.getElementById('det-dob');
    const detJoined = document.getElementById('det-joined');
    const detCustomSection = document.getElementById('det-custom-attributes');

    if (detAvatar) detAvatar.src = member.profile_picture_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';
    if (detName) detName.textContent = member.name;
    if (detRoleBadge) detRoleBadge.textContent = member.role;
    if (detPosition) detPosition.textContent = member.position || (member.role === 'Student' ? 'Student' : 'Faculty Staff');

    if (statusEl) {
      statusEl.textContent = member.status;
      statusEl.className = `status-indicator badge ${member.status === 'Active' ? 'badge-active' : 'badge-inactive'}`;
    }

    if (detUnit) detUnit.textContent = state.getUnitLabel(member.unit_id);
    if (detEmail) detEmail.textContent = member.email || '🔒 Pruned/Hidden for Privacy';
    if (detPhone) detPhone.textContent = member.phone || '🔒 Pruned/Hidden for Privacy';
    if (detAddress) detAddress.textContent = member.address || '🔒 Pruned/Hidden for Privacy';

    if (detDob) {
      if (member.dob_month && member.dob_day) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        detDob.textContent = `${months[member.dob_month - 1]} ${member.dob_day}`;
      } else {
        detDob.textContent = '🔒 Pruned/Hidden for Privacy';
      }
    }

    if (detJoined) {
      if (member.joined_date) {
        detJoined.textContent = new Date(member.joined_date).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric'
        });
      } else {
        detJoined.textContent = '🔒 Pruned/Hidden for Privacy';
      }
    }

    // Role-Specific Profile Sections for Core Admin, Academic Staff, and Students
    if (detCustomSection) {
      if (member.role === 'Principal' || member.role === 'Dean') {
        // Core Admin Profile
        detCustomSection.innerHTML = `
          <div class="notion-callout mt-2">
            <span class="callout-emoji">🏛️</span>
            <div class="callout-text">
              <strong>Core Institutional Leadership Profile</strong><br>
              <span class="text-secondary">Administrative clearance: Level 1 Executive Oversight</span>
            </div>
          </div>
          <div class="detail-row notion-prop-row mt-1">
            <span class="prop-name"><span class="prop-icon">🏢</span> Office Location</span>
            <strong>${member.office_location || 'Executive Quadrangle Suite'}</strong>
          </div>
          <div class="detail-row notion-prop-row">
            <span class="prop-name"><span class="prop-icon">⏰</span> Office Hours</span>
            <strong>${member.office_hours || 'Mon-Thu 9:00 AM - 1:00 PM'}</strong>
          </div>
          <div class="detail-row notion-prop-row">
            <span class="prop-name"><span class="prop-icon">🎯</span> Leadership Scope</span>
            <strong>${member.specialization || 'Campus Governance & Standards'}</strong>
          </div>
          ${member.bio ? `
            <div class="mt-2 p-2 notion-callout-panel" style="font-size:0.9rem">
              <strong>Professional Biography:</strong><br>
              <p class="text-secondary mt-1">${member.bio}</p>
            </div>
          ` : ''}
        `;
      } else if (member.role === 'Teacher' || member.role === 'Counselor') {
        // Academic Staff Profile
        detCustomSection.innerHTML = `
          <div class="notion-callout mt-2">
            <span class="callout-emoji">📚</span>
            <div class="callout-text">
              <strong>Academic Faculty & Staff Profile</strong><br>
              <span class="text-secondary">Departmental educator & student advisor</span>
            </div>
          </div>
          <div class="detail-row notion-prop-row mt-1">
            <span class="prop-name"><span class="prop-icon">🏢</span> Faculty Office</span>
            <strong>${member.office_location || 'Faculty Hall Office'}</strong>
          </div>
          <div class="detail-row notion-prop-row">
            <span class="prop-name"><span class="prop-icon">⏰</span> Advisory Hours</span>
            <strong>${member.office_hours || 'Daily 3:00 PM - 4:30 PM'}</strong>
          </div>
          <div class="detail-row notion-prop-row">
            <span class="prop-name"><span class="prop-icon">📖</span> Specialization</span>
            <strong>${member.specialization || 'Secondary Curriculum & Mentorship'}</strong>
          </div>
          ${member.bio ? `
            <div class="mt-2 p-2 notion-callout-panel" style="font-size:0.9rem">
              <strong>Faculty Background:</strong><br>
              <p class="text-secondary mt-1">${member.bio}</p>
            </div>
          ` : ''}
        `;
      } else {
        // Student Profile with Performance Circle Identification
        const perf = getPerformanceBadge(member.academic_score);
        detCustomSection.innerHTML = `
          <div class="notion-callout mt-2">
            <span class="callout-emoji">🎓</span>
            <div class="callout-text">
              <strong>Student Academic Standing</strong><br>
              <span class="text-secondary">Certified continuous evaluation record</span>
            </div>
          </div>
          <div class="detail-row notion-prop-row mt-1">
            <span class="prop-name"><span class="prop-icon">📊</span> Academic Performance</span>
            <div class="flex-row align-center gap-1">
              ${perf.circleHtml}
              <strong>${member.academic_score || 0}%</strong>
              <span class="perf-status-desc">(${perf.standingText})</span>
            </div>
          </div>
          <div class="detail-row notion-prop-row">
            <span class="prop-name"><span class="prop-icon">👥</span> Guardian Contact</span>
            <strong>${member.guardian_name || 'Guardian on file'} (${member.guardian_email || 'No email registered'})</strong>
          </div>
          <div class="mt-2">
            <button class="btn btn-primary btn-full" onclick="window.switchToStudentPortal('${member.id}')">
              🎓 View Official Student Portal
            </button>
          </div>
        `;
      }
    }

    const modal = document.getElementById('profile-detail-modal');
    if (modal) modal.classList.add('active');

  } catch (err: any) {
    alert(err.message || 'Failed to view profile details');
  }
}

export async function deleteMemberProfile(id: string): Promise<void> {
  if (!confirm('Are you sure you want to permanently delete this profile? This will remove all associated enrollment and attendance records.')) {
    return;
  }

  try {
    const res = await apiFetch<{ message: string }>(`/api/members/${id}`, { method: 'DELETE' });
    alert(res.message);
    loadMembersData();
  } catch (err: any) {
    alert(err.message || 'Failed to delete profile');
  }
}

// Window actions
(window as any).viewMemberDetail = viewMemberDetail;
(window as any).deleteMemberProfile = deleteMemberProfile;
(window as any).switchToStudentPortal = (studentId: string) => {
  const modal = document.getElementById('profile-detail-modal');
  if (modal) modal.classList.remove('active');

  // Trigger click on nav-portal
  const portalNav = document.getElementById('nav-portal');
  if (portalNav) {
    portalNav.click();
    // Set student in selector if present
    setTimeout(() => {
      const select = document.getElementById('portal-student-select') as HTMLSelectElement | null;
      if (select) {
        select.value = studentId;
        select.dispatchEvent(new Event('change'));
      }
    }, 100);
  }
};
