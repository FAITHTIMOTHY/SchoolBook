/**
 * SchoolBook SMS - Students & Staff Directory Controller
 * STRICT REQUIREMENTS:
 * "-For Identification, academic performances will have a green, yellow and red circle, green for performamces greater than 70, yellow for between 69-50, and red for the rest."
 * "Core Admin and academic staff have profiles on the site."
 */

import { apiFetch } from '../api.js';
import { state } from '../state.js';
import {
  escapeAttribute,
  escapeHtml,
  safeImageUrl,
} from '../html.js';
import { Member } from '../types.js';
import { getPerformanceBadge } from './portalTab.js';

let lastMemberDetail: Member | null = null;

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
      } else if (m.role === 'Principal') {
        perfDisplay = `<span class="notion-tag tag-purple">Core Admin</span>`;
      } else {
        perfDisplay = `<span class="notion-tag tag-blue">Academic Staff</span>`;
      }

      return `
        <tr>
          <td><img src="${safeImageUrl(m.profile_picture_url)}" alt="" class="table-avatar"></td>
          <td><strong>${escapeHtml(m.name)}</strong></td>
          <td><span class="badge badge-role">${escapeHtml(m.role)}</span></td>
          <td>${escapeHtml(m.position || (m.role === 'Student' ? 'Student' : 'Faculty Staff'))}</td>
          <td>${perfDisplay}</td>
          <td><span class="badge ${m.status === 'Active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(m.status)}</span></td>
          <td>
            <div class="flex-row gap-1 justify-end">
              <button class="btn btn-secondary btn-sm" onclick="window.viewMemberDetail('${escapeAttribute(m.id)}')">👤 Profile</button>
              ${m.role === 'Student' ? `<button class="btn btn-primary btn-sm" onclick="window.switchToStudentPortal('${escapeAttribute(m.id)}')">🎓 Portal</button>` : ''}
              ${state.isPrincipal() ? `<button class="btn btn-danger btn-sm" onclick="window.deleteMemberProfile('${escapeAttribute(m.id)}')">✖</button>` : ''}
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
    lastMemberDetail = member;

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

    if (detAvatar) detAvatar.src = safeImageUrl(member.profile_picture_url);
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
      if (member.role === 'Principal') {
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
            <strong>${escapeHtml(member.office_location || 'Executive Quadrangle Suite')}</strong>
          </div>
          <div class="detail-row notion-prop-row">
            <span class="prop-name"><span class="prop-icon">⏰</span> Office Hours</span>
            <strong>${escapeHtml(member.office_hours || 'Mon-Thu 9:00 AM - 1:00 PM')}</strong>
          </div>
          <div class="detail-row notion-prop-row">
            <span class="prop-name"><span class="prop-icon">🎯</span> Leadership Scope</span>
            <strong>${escapeHtml(member.specialization || 'Campus Governance & Standards')}</strong>
          </div>
          ${member.bio ? `
            <div class="mt-2 p-2 notion-callout-panel" style="font-size:0.9rem">
              <strong>Professional Biography:</strong><br>
              <p class="text-secondary mt-1">${escapeHtml(member.bio)}</p>
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
            <strong>${escapeHtml(member.office_location || 'Faculty Hall Office')}</strong>
          </div>
          <div class="detail-row notion-prop-row">
            <span class="prop-name"><span class="prop-icon">⏰</span> Advisory Hours</span>
            <strong>${escapeHtml(member.office_hours || 'Daily 3:00 PM - 4:30 PM')}</strong>
          </div>
          <div class="detail-row notion-prop-row">
            <span class="prop-name"><span class="prop-icon">📖</span> Specialization</span>
            <strong>${escapeHtml(member.specialization || 'Secondary Curriculum & Mentorship')}</strong>
          </div>
          ${member.bio ? `
            <div class="mt-2 p-2 notion-callout-panel" style="font-size:0.9rem">
              <strong>Faculty Background:</strong><br>
              <p class="text-secondary mt-1">${escapeHtml(member.bio)}</p>
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
            <strong>${escapeHtml(member.guardian_name || 'Guardian on file')} (${escapeHtml(member.guardian_email || 'No email registered')})</strong>
          </div>
          <div class="mt-2">
            <button class="btn btn-primary btn-full" onclick="window.switchToStudentPortal('${escapeAttribute(member.id)}')">
              🎓 View Official Student Portal
            </button>
          </div>
        `;
      }

      detCustomSection.innerHTML += renderAccessPanel(member);
    }

    const modal = document.getElementById('profile-detail-modal');
    if (modal) modal.classList.add('active');

  } catch (err: any) {
    alert(err.message || 'Failed to view profile details');
  }
}

export async function deleteMemberProfile(id: string): Promise<void> {
  if (!confirm('Archive this profile? The person will no longer appear in active registers, but their attendance, grades, and finance history are preserved.')) {
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

function renderAccessPanel(member: Member): string {
  if (!state.isPrincipal()) return '';

  const rows: string[] = [];

  if (member.role === 'Student') {
    rows.push(
      loginRow(
        'Student login',
        member.email,
        Boolean(member.user_id),
        member.id,
        'student',
        member.id,
      ),
    );

    if (member.guardian_id) {
      rows.push(
        loginRow(
          'Guardian login',
          member.guardian_email || '',
          Boolean(member.guardian_user_id),
          member.guardian_id,
          'guardian',
          member.id,
        ),
      );
    } else {
      rows.push(`
        <div class="detail-row notion-prop-row">
          <span class="prop-name"><span class="prop-icon">🔑</span> Guardian login</span>
          <span class="text-secondary">No guardian linked</span>
        </div>
      `);
    }
  } else {
    rows.push(
      loginRow(
        'Workspace login',
        member.email,
        Boolean(member.user_id),
        member.id,
        'staff',
        member.id,
      ),
    );
  }

  return `
    <div class="notion-callout mt-2">
      <span class="callout-emoji">🔐</span>
      <div class="callout-text">
        <strong>Access &amp; Login</strong><br>
        <span class="text-secondary">Create a workspace account linked to this profile. Passwords are shown once.</span>
      </div>
    </div>
    ${rows.join('')}
  `;
}

function loginRow(
  label: string,
  email: string,
  linked: boolean,
  linkId: string,
  kind: 'staff' | 'student' | 'guardian',
  returnId: string,
): string {
  const action = linked
    ? '<span class="notion-tag tag-green">Login linked</span>'
    : `<button type="button" class="btn btn-secondary btn-sm" onclick="window.openAccessModal('${escapeAttribute(linkId)}', '${kind}', '${escapeAttribute(returnId)}')">Create login</button>`;

  return `
    <div class="detail-row notion-prop-row">
      <span class="prop-name"><span class="prop-icon">🔑</span> ${escapeHtml(label)}</span>
      <div class="flex-row align-center gap-1">
        <span class="text-secondary">${escapeHtml(email || 'No email on file')}</span>
        ${action}
      </div>
    </div>
  `;
}

function inferStaffRole(member: Member): string {
  const position = (member.position || '').toLowerCase();

  if (member.role === 'Principal') return 'PRINCIPAL';
  if (
    position.includes('bursar') ||
    position.includes('account') ||
    position.includes('finance')
  ) {
    return 'ACCOUNTANT';
  }
  if (position.includes('librarian') || position.includes('library')) {
    return 'LIBRARIAN';
  }
  return 'TEACHER';
}

function staffRoleOptions(member: Member): Array<[string, string]> {
  const position = (member.position || '').toLowerCase();
  const options: Array<[string, string]> = [];

  if (member.role === 'Principal') {
    options.push(['PRINCIPAL', 'Principal']);
  }
  options.push(['TEACHER', 'Teacher']);
  if (
    position.includes('bursar') ||
    position.includes('account') ||
    position.includes('finance')
  ) {
    options.push(['ACCOUNTANT', 'Accountant']);
  }
  if (position.includes('librarian') || position.includes('library')) {
    options.push(['LIBRARIAN', 'Librarian']);
  }
  options.push(['VICE_PRINCIPAL', 'Vice Principal']);

  const seen = new Set<string>();
  return options.filter(([value]) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function generateTempPassword(): string {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const random = new Uint32Array(12);
  crypto.getRandomValues(random);
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join('');
}

export function openAccessModal(
  linkId: string,
  kind: 'staff' | 'student' | 'guardian',
  returnId: string,
): void {
  const member = lastMemberDetail;
  if (!member) {
    alert('Open the profile again before creating a login.');
    return;
  }

  const isGuardian = kind === 'guardian';
  const name = isGuardian
    ? member.guardian_name || 'Guardian'
    : member.name || 'User';
  const email = isGuardian
    ? member.guardian_email || ''
    : member.email || '';
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(' ') || 'User';

  const linkInput = document.getElementById('access-link-id') as HTMLInputElement | null;
  const returnInput = document.getElementById('access-return-id') as HTMLInputElement | null;
  const kindInput = document.getElementById('access-profile-kind') as HTMLInputElement | null;
  const firstInput = document.getElementById('access-first-name') as HTMLInputElement | null;
  const lastInput = document.getElementById('access-last-name') as HTMLInputElement | null;
  const emailInput = document.getElementById('access-email') as HTMLInputElement | null;
  const roleSelect = document.getElementById('access-role') as HTMLSelectElement | null;
  const passwordInput = document.getElementById('access-password') as HTMLInputElement | null;
  const profileName = document.getElementById('access-profile-name');
  const profileNote = document.getElementById('access-profile-note');

  if (linkInput) linkInput.value = linkId;
  if (returnInput) returnInput.value = returnId;
  if (kindInput) kindInput.value = kind;
  if (firstInput) firstInput.value = firstName;
  if (lastInput) lastInput.value = lastName;
  if (emailInput) emailInput.value = email;
  if (passwordInput) passwordInput.value = generateTempPassword();

  if (roleSelect) {
    const options =
      kind === 'student'
        ? ([['STUDENT', 'Student']] as Array<[string, string]>)
        : kind === 'guardian'
          ? ([['GUARDIAN', 'Guardian']] as Array<[string, string]>)
          : staffRoleOptions(member);
    roleSelect.innerHTML = options
      .map(
        ([value, label]) =>
          `<option value="${escapeAttribute(value)}">${escapeHtml(label)}</option>`,
      )
      .join('');
    roleSelect.value =
      kind === 'student'
        ? 'STUDENT'
        : kind === 'guardian'
          ? 'GUARDIAN'
          : inferStaffRole(member);
  }

  if (profileName) {
    profileName.textContent = `${name} · ${isGuardian ? 'Guardian account' : member.role === 'Student' ? 'Student account' : 'Staff account'}`;
  }
  if (profileNote) {
    profileNote.textContent = isGuardian
      ? 'This login will be linked to the guardian record so the family can see the linked student portal.'
      : member.role === 'Student'
        ? 'This login will be linked to the student record so the student sees their own portal.'
        : 'This login will be linked to the staff record and the selected workspace role.';
  }

  const modal = document.getElementById('access-modal');
  if (modal) modal.classList.add('active');
  emailInput?.focus();
}

export function closeAccessModal(): void {
  const modal = document.getElementById('access-modal');
  if (modal) modal.classList.remove('active');
}

export async function submitAccessForm(e: Event): Promise<void> {
  e.preventDefault();

  const linkId = (document.getElementById('access-link-id') as HTMLInputElement | null)?.value || '';
  const returnId = (document.getElementById('access-return-id') as HTMLInputElement | null)?.value || '';
  const kind = (document.getElementById('access-profile-kind') as HTMLInputElement | null)?.value || '';
  const firstName = (document.getElementById('access-first-name') as HTMLInputElement | null)?.value || '';
  const lastName = (document.getElementById('access-last-name') as HTMLInputElement | null)?.value || '';
  const email = (document.getElementById('access-email') as HTMLInputElement | null)?.value.trim() || '';
  const role = (document.getElementById('access-role') as HTMLSelectElement | null)?.value || '';
  const password = (document.getElementById('access-password') as HTMLInputElement | null)?.value || '';

  if (!linkId || !email || !role || password.length < 8) {
    alert('Enter a login email and a temporary password of at least 8 characters.');
    return;
  }

  const payload: Record<string, unknown> = {
    email,
    firstName,
    lastName,
    role,
    password,
    isActive: true,
  };

  if (kind === 'staff') payload.staffId = linkId;
  else if (kind === 'student') payload.studentId = linkId;
  else if (kind === 'guardian') payload.guardianId = linkId;

  try {
    await apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    alert(
      `Login created.\n\nEmail: ${email}\nTemporary password: ${password}\n\nShare this privately. The person should change it after signing in.`,
    );

    closeAccessModal();
    if (returnId) await viewMemberDetail(returnId);
    await loadMembersData();
  } catch (err: any) {
    alert(err.message || 'Failed to create workspace login');
  }
}

export function setupAccessModal(): void {
  const form = document.getElementById('access-form') as HTMLFormElement | null;
  if (form) form.onsubmit = submitAccessForm;

  const closeBtn = document.getElementById('btn-close-access-modal');
  if (closeBtn) closeBtn.onclick = () => closeAccessModal();

  const cancelBtn = document.getElementById('btn-cancel-access-modal');
  if (cancelBtn) cancelBtn.onclick = () => closeAccessModal();

  const generateBtn = document.getElementById('btn-generate-password');
  if (generateBtn) {
    generateBtn.onclick = () => {
      const passwordInput = document.getElementById('access-password') as HTMLInputElement | null;
      if (passwordInput) passwordInput.value = generateTempPassword();
    };
  }
}

// Window actions
(window as any).viewMemberDetail = viewMemberDetail;
(window as any).deleteMemberProfile = deleteMemberProfile;
(window as any).openAccessModal = openAccessModal;
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
