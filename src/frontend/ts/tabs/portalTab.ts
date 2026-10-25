/**
 * SchoolBook SMS - Student Portal Controller
 * STRICT REQUIREMENT:
 * "Student portals should be created and edited by teachers and management, can only be viewed by students/guardian."
 * "-For Identification, academic performances will have a green, yellow and red circle, green for performamces greater than 70, yellow for between 69-50, and red for the rest."
 */

import { apiFetch } from '../api.js';
import { state } from '../state.js';
import { escapeAttribute, escapeHtml } from '../html.js';
import { StudentPortal, CourseGrade, Member } from '../types.js';

let currentPortal: StudentPortal | null = null;
let currentStudentId: string = '';

export function getPerformanceBadge(score: number | undefined): {
  color: 'green' | 'yellow' | 'red';
  circleHtml: string;
  badgeHtml: string;
  standingText: string;
} {
  const num = typeof score === 'number' ? score : 0;
  if (num > 70) {
    return {
      color: 'green',
      circleHtml: `<span class="perf-circle perf-green" title="Academic Standing: ${num}% (Superior >70%)"></span>`,
      badgeHtml: `<span class="perf-tag perf-tag-green"><span class="perf-circle perf-green"></span> ${num}% · Honors (>70%)</span>`,
      standingText: 'Honors Standing (>70%)'
    };
  } else if (num >= 50) {
    return {
      color: 'yellow',
      circleHtml: `<span class="perf-circle perf-yellow" title="Academic Standing: ${num}% (Satisfactory 50-69%)"></span>`,
      badgeHtml: `<span class="perf-tag perf-tag-yellow"><span class="perf-circle perf-yellow"></span> ${num}% · Satisfactory (50-69%)</span>`,
      standingText: 'Satisfactory Academic Standing (50-69%)'
    };
  } else {
    return {
      color: 'red',
      circleHtml: `<span class="perf-circle perf-red" title="Academic Standing: ${num}% (Intervention Required <50%)"></span>`,
      badgeHtml: `<span class="perf-tag perf-tag-red"><span class="perf-circle perf-red"></span> ${num}% · Intervention (<50%)</span>`,
      standingText: 'Academic Intervention Required (<50%)'
    };
  }
}

export async function loadPortalData(): Promise<void> {
  try {
    const canBrowse = state.canBrowsePortals();
    const isStudent = state.isStudent();

    // 1. If Teacher/Management/Library: populate student picker
    const select = document.getElementById('portal-student-select') as HTMLSelectElement | null;
    const studentSelectorWrap = document.getElementById('portal-student-selector-wrap');

    if (canBrowse) {
      if (studentSelectorWrap) studentSelectorWrap.style.display = 'flex';
      const students = await apiFetch<Member[]>('/api/members?role=Student');

      if (select && students.length > 0) {
        select.innerHTML = students.map(s => {
          const perf = getPerformanceBadge(s.academic_score);
          const icon = perf.color === 'green' ? '🟢' : perf.color === 'yellow' ? '🟡' : '🔴';
          return `<option value="${escapeAttribute(s.id)}" ${s.id === currentStudentId ? 'selected' : ''}>${icon} ${escapeHtml(s.name)} (${escapeHtml(s.position || 'Student')}) - ${s.academic_score || 0}%</option>`;
        }).join('');

        if (!currentStudentId || !students.some(s => s.id === currentStudentId)) {
          currentStudentId = students[0].id;
        }

        select.value = currentStudentId;
        select.onchange = () => {
          currentStudentId = select.value;
          fetchAndRenderPortal(currentStudentId);
        };
      }
    } else {
      if (studentSelectorWrap) studentSelectorWrap.style.display = 'none';
      currentStudentId = state.activeUser?.id || '';
    }

    if (!currentStudentId) return;

    await fetchAndRenderPortal(currentStudentId);

  } catch (err) {
    console.error('Failed loading student portal context:', err);
  }
}

async function fetchAndRenderPortal(studentId: string): Promise<void> {
  try {
    const portal = await apiFetch<StudentPortal>(`/api/portal/${studentId}`);
    currentPortal = portal;
    renderPortalView(portal);
  } catch (err: any) {
    console.error(`Failed to fetch portal for student ${studentId}:`, err);
  }
}

function renderPortalView(portal: StudentPortal): void {
  const isEditable = state.canEditPortal();

  // Header Elements
  const elName = document.getElementById('portal-student-name');
  const elGrade = document.getElementById('portal-student-grade');
  const elTerm = document.getElementById('portal-current-term');
  const elPerfBadge = document.getElementById('portal-perf-indicator');
  const elLastUpdated = document.getElementById('portal-last-updated');
  const elOverallScoreInput = document.getElementById('portal-overall-score-input') as HTMLInputElement | null;

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
    const updatedDate = new Date(portal.updated_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
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

  // Course Grades Table
  const tbody = document.getElementById('portal-grades-tbody');
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
                ${isEditable
            ? `<input type="number" class="notion-input input-score-sm" min="0" max="100" value="${g.score}" onchange="window.updateGradeScore(${idx}, this.value)">`
            : `<strong>${g.score}%</strong>`}
              </div>
            </td>
            <td>
              ${isEditable
            ? `<input type="text" class="notion-input input-comment-sm" value="${escapeAttribute(g.comments || '')}" onchange="window.updateGradeComment(${idx}, this.value)">`
            : `<span class="text-secondary">${escapeHtml(g.comments || 'Satisfactory work.')}</span>`}
            </td>
            ${isEditable ? `<td><button type="button" class="notion-icon-btn text-danger" onclick="window.removeGradeRow(${idx})" title="Remove course grade">✕</button></td>` : ''}
          </tr>
        `;
      }).join('');
    }
  }

  // Teacher Remarks
  const elRemarks = document.getElementById('portal-teacher-remarks') as HTMLTextAreaElement | null;
  if (elRemarks) {
    elRemarks.value = portal.teacher_remarks || '';
    elRemarks.disabled = !isEditable;
  }

  // Guardian Information
  const elGuardianName = document.getElementById('portal-guardian-name') as HTMLInputElement | null;
  const elGuardianEmail = document.getElementById('portal-guardian-email') as HTMLInputElement | null;
  const elGuardianPhone = document.getElementById('portal-guardian-phone') as HTMLInputElement | null;
  const elGuardianRelation = document.getElementById('portal-guardian-relation') as HTMLInputElement | null;

  if (elGuardianName) {
    elGuardianName.value = portal.guardian_name || '';
    elGuardianName.disabled = !isEditable;
  }
  if (elGuardianEmail) {
    elGuardianEmail.value = portal.guardian_email || '';
    elGuardianEmail.disabled = !isEditable;
  }
  if (elGuardianPhone) {
    elGuardianPhone.value = portal.guardian_phone || '';
    elGuardianPhone.disabled = !isEditable;
  }
  if (elGuardianRelation) {
    elGuardianRelation.value = portal.guardian_relation || 'Parent/Guardian';
    elGuardianRelation.disabled = !isEditable;
  }

  // Uploaded Syllabus & Curriculum Section
  const syllabusList = document.getElementById('portal-syllabus-list');
  if (syllabusList) {
    if (portal.syllabus_attachments.length === 0) {
      syllabusList.innerHTML = `<p class="text-muted" style="font-size:0.85rem">No syllabus documents attached yet.</p>`;
    } else {
      syllabusList.innerHTML = portal.syllabus_attachments.map(att => `
        <div class="syllabus-item-pill">
          <div class="syllabus-item-info">
            <span class="syllabus-icon">📄</span>
            <div class="syllabus-text">
              <strong>${escapeHtml(att.title)}</strong>
              <span class="syllabus-sub">${escapeHtml(att.filename)} · Uploaded by ${escapeHtml(att.uploaded_by)} (${escapeHtml(att.date)})</span>
            </div>
          </div>
          <span class="notion-tag tag-gray" title="This deployment records attachment metadata. File delivery is managed by the school office.">On file</span>
        </div>
      `).join('');
    }
  }
}

// Global actions exposed to window for inline onclick handlers
(window as any).updateGradeScore = (index: number, newScore: string) => {
  if (!currentPortal || !currentPortal.grades[index]) return;
  const val = Math.min(100, Math.max(0, Number(newScore) || 0));
  currentPortal.grades[index].score = val;

  // Recompute average overall score automatically
  const total = currentPortal.grades.reduce((sum, g) => sum + g.score, 0);
  const avg = Math.round(total / currentPortal.grades.length);
  currentPortal.overall_score = avg;

  const overallInput = document.getElementById('portal-overall-score-input') as HTMLInputElement | null;
  if (overallInput) overallInput.value = String(avg);

  const elPerfBadge = document.getElementById('portal-perf-indicator');
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

(window as any).updateGradeComment = (index: number, newComment: string) => {
  if (!currentPortal || !currentPortal.grades[index]) return;
  currentPortal.grades[index].comments = newComment;
};

(window as any).removeGradeRow = (index: number) => {
  if (!currentPortal) return;
  currentPortal.grades.splice(index, 1);
  renderPortalView(currentPortal);
};

export function addSubjectRow(): void {
  if (!currentPortal) return;
  const newCourse: CourseGrade = {
    id: `g_${Date.now()}`,
    subject: 'New Academic Subject',
    score: 75,
    teacher: state.activeUser?.name || 'Class Teacher',
    term: currentPortal.term || 'Fall 2026',
    comments: 'Regular performance'
  };
  currentPortal.grades.push(newCourse);
  renderPortalView(currentPortal);
}

export async function savePortalChanges(): Promise<void> {
  if (!currentPortal || !currentStudentId) return;

  if (!state.canEditPortal()) {
    alert('Access Denied: Student portals can only be edited by Teachers and Campus Management.');
    return;
  }

  const elOverallScore = document.getElementById('portal-overall-score-input') as HTMLInputElement | null;
  const elRemarks = document.getElementById('portal-teacher-remarks') as HTMLTextAreaElement | null;
  const elGuardianName = document.getElementById('portal-guardian-name') as HTMLInputElement | null;
  const elGuardianEmail = document.getElementById('portal-guardian-email') as HTMLInputElement | null;
  const elGuardianPhone = document.getElementById('portal-guardian-phone') as HTMLInputElement | null;
  const elGuardianRelation = document.getElementById('portal-guardian-relation') as HTMLInputElement | null;

  const payload = {
    overall_score: Number(elOverallScore?.value || currentPortal.overall_score),
    term: currentPortal.term,
    grades: currentPortal.grades,
    teacher_remarks: elRemarks?.value || '',
    guardian_name: elGuardianName?.value || '',
    guardian_email: elGuardianEmail?.value || '',
    guardian_phone: elGuardianPhone?.value || '',
    guardian_relation: elGuardianRelation?.value || '',
    syllabus_attachments: currentPortal.syllabus_attachments
  };

  try {
    const res = await apiFetch<{ message: string; portal: StudentPortal }>(`/api/portal/${currentStudentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    currentPortal = res.portal;
    alert(`Success: ${res.message}`);
    renderPortalView(res.portal);

  } catch (err: any) {
    alert(`Error updating student portal: ${err.message}`);
  }
}

export function bulkEmailGuardian(): void {
  if (!currentPortal) return;

  const email = (currentPortal.guardian_email || '').trim();
  if (!email) {
    alert('No guardian email is registered for this student.');
    return;
  }

  const name = currentPortal.guardian_name || 'Guardian';
  const subject = encodeURIComponent(
    `Academic evaluation report for ${currentPortal.student_name}`,
  );
  const body = encodeURIComponent(
    `Dear ${name},\n\n` +
      `This is the current academic summary for ${currentPortal.student_name} ` +
      `(${currentPortal.grade_level || 'Student'}, ${currentPortal.term || 'current term'}).\n\n` +
      `Overall score: ${currentPortal.overall_score}%\n` +
      `Teacher remarks: ${currentPortal.teacher_remarks || 'None recorded.'}\n\n` +
      `Please contact the school office if you would like to discuss this report.\n\n` +
      `Regards,\n${state.activeUser?.name || 'SchoolBook'}`,
  );

  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
}
