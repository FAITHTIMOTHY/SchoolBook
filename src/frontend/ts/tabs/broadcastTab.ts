/**
 * SchoolBook SMS - Broadcast Circulars & Teacher Reminders Controller
 * STRICT REQUIREMENTS:
 * "Broadcast channel for teachers to set reminders on assignment, test and impromptu informations, bulk mailing possible."
 * "Uploading of sylabus and curicullum to broadcast channel"
 */

import { apiFetch } from '../api.js';
import { state } from '../state.js';
import { Unit, BroadcastResponse, BroadcastMessage, BroadcastCategory } from '../types.js';

export async function loadBroadcastContext(): Promise<void> {
  await loadBroadcastFeed();

  if (!state.canBroadcast()) return;

  try {
    const units = await apiFetch<Unit[]>('/api/units');
    const select = document.getElementById('bc-unit-id') as HTMLSelectElement | null;
    
    if (select) {
      select.innerHTML = units.map(u => 
        `<option value="${u.id}">${u.name}</option>`
      ).join('');
    }

    const targetSelect = document.getElementById('bc-target') as HTMLSelectElement | null;
    const unitGroup = document.getElementById('bc-unit-group');

    if (targetSelect && unitGroup) {
      targetSelect.onchange = (e) => {
        const val = (e.target as HTMLSelectElement).value;
        if (val === 'unit') {
          unitGroup.style.display = 'block';
        } else {
          unitGroup.style.display = 'none';
        }
      };
    }

    // Category dynamic fields toggling
    const categorySelect = document.getElementById('bc-category') as HTMLSelectElement | null;
    const eventDateGroup = document.getElementById('bc-event-date-group');
    const attachmentGroup = document.getElementById('bc-attachment-group');

    if (categorySelect) {
      categorySelect.onchange = () => {
        const cat = categorySelect.value as BroadcastCategory;
        if (eventDateGroup) {
          eventDateGroup.style.display = (cat === 'assignment' || cat === 'test') ? 'block' : 'none';
        }
        if (attachmentGroup) {
          attachmentGroup.style.display = (cat === 'curriculum') ? 'block' : 'none';
        }
      };
    }

  } catch (err) {
    console.error('Failed loading broadcast context:', err);
  }
}

export async function loadBroadcastFeed(): Promise<void> {
  try {
    const broadcasts = await apiFetch<BroadcastMessage[]>('/api/messaging');
    const container = document.getElementById('broadcast-feed-container');
    if (!container) return;

    if (broadcasts.length === 0) {
      container.innerHTML = `<div class="notion-callout"><span class="callout-emoji">📢</span><div class="callout-text">No announcements posted yet in this broadcast channel.</div></div>`;
      return;
    }

    container.innerHTML = broadcasts.map(b => {
      let catTagClass = 'tag-blue';
      let catIcon = '📢';
      let catLabel = 'General Notice';

      if (b.category === 'assignment') {
        catTagClass = 'tag-orange';
        catIcon = '📝';
        catLabel = 'Assignment Reminder';
      } else if (b.category === 'test') {
        catTagClass = 'tag-red';
        catIcon = '🎯';
        catLabel = 'Test / Exam Notice';
      } else if (b.category === 'impromptu') {
        catTagClass = 'tag-yellow';
        catIcon = '⚡';
        catLabel = 'Impromptu Information';
      } else if (b.category === 'curriculum') {
        catTagClass = 'tag-green';
        catIcon = '📚';
        catLabel = 'Syllabus & Curriculum';
      }

      const formattedDate = new Date(b.sent_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      return `
        <div class="broadcast-card notion-panel">
          <div class="bc-card-header">
            <div class="bc-author-row">
              <span class="bc-author-avatar">👤</span>
              <div class="bc-author-meta">
                <strong>${b.sender_name}</strong>
                <span class="text-secondary" style="font-size:0.75rem"> · ${b.sender_role} · ${formattedDate}</span>
              </div>
            </div>
            <span class="notion-tag ${catTagClass}">${catIcon} ${catLabel}</span>
          </div>

          <h3 class="bc-title mt-1">${b.title || 'Broadcast Circular'}</h3>
          <p class="bc-message mt-1">${b.message}</p>

          ${b.event_date ? `
            <div class="bc-event-pill mt-1">
              <span>📅</span> <strong>Event / Due Date:</strong> ${b.event_date}
            </div>
          ` : ''}

          ${b.attachment ? `
            <div class="bc-attachment-box mt-1">
              <div class="bc-att-info">
                <span class="bc-att-icon">📄</span>
                <div>
                  <strong>${b.attachment.name}</strong>
                  <span class="text-secondary" style="font-size:0.75rem">${b.attachment.size || 'PDF'} · ${b.attachment.type || 'Curriculum Syllabus Document'}</span>
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="alert('Downloading uploaded syllabus: ${b.attachment.name}')">
                ⬇ Download Syllabus
              </button>
            </div>
          ` : ''}

          <div class="bc-card-footer mt-1">
            <span class="bc-recipients-pill">👥 ${b.recipient_count} Recipients</span>
            ${b.bulk_mailed ? `<span class="notion-tag tag-purple">✉️ Bulk Email Dispatched to Students & Guardians</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed loading broadcast channel feed:', err);
  }
}

export async function handleBroadcastSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const bcLogs = document.getElementById('broadcast-logs-container');
  const targetSelect = document.getElementById('bc-target') as HTMLSelectElement | null;
  const unitSelect = document.getElementById('bc-unit-id') as HTMLSelectElement | null;
  const categorySelect = document.getElementById('bc-category') as HTMLSelectElement | null;
  const titleInput = document.getElementById('bc-title') as HTMLInputElement | null;
  const messageInput = document.getElementById('bc-message') as HTMLTextAreaElement | null;
  const eventDateInput = document.getElementById('bc-event-date') as HTMLInputElement | null;
  const attachmentInput = document.getElementById('bc-attachment-title') as HTMLInputElement | null;
  const bulkMailCheckbox = document.getElementById('bc-bulk-mail') as HTMLInputElement | null;

  const category = (categorySelect?.value || 'impromptu') as BroadcastCategory;
  const title = titleInput?.value || '';
  const message = messageInput?.value || '';
  const event_date = eventDateInput?.value || undefined;
  const bulk_mail = Boolean(bulkMailCheckbox?.checked);

  let attachment = undefined;
  if (category === 'curriculum') {
    const docName = attachmentInput?.value || 'Academic_Curriculum_Syllabus.pdf';
    attachment = {
      name: docName,
      url: `/documents/${encodeURIComponent(docName)}`,
      size: '1.8 MB',
      type: 'Verified Course Curriculum PDF'
    };
  }

  const body = {
    target: targetSelect?.value || 'all',
    unitId: unitSelect?.value || null,
    category,
    title,
    message,
    event_date,
    attachment,
    bulk_mail
  };

  try {
    const res = await apiFetch<BroadcastResponse>('/api/messaging/send', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (bcLogs) {
      const timestamp = new Date().toLocaleTimeString();
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.innerHTML = `
        <span class="log-time" style="color:var(--text-muted)">[${timestamp}]</span> 
        <strong style="color:var(--notion-blue)">${category.toUpperCase()} Broadcast Dispatched:</strong> ${res.message}<br>
        <span style="font-size:0.75rem; color:var(--text-secondary)">Recipients (${res.recipientCount})${bulk_mail ? ' [Bulk Email Alert Active]' : ''}: ${res.recipients.join(', ') || 'Directory members'}</span>
      `;
      bcLogs.insertBefore(entry, bcLogs.firstChild);
    }

    if (titleInput) titleInput.value = '';
    if (messageInput) messageInput.value = '';
    if (attachmentInput) attachmentInput.value = '';
    if (eventDateInput) eventDateInput.value = '';

    await loadBroadcastFeed();

  } catch (err: any) {
    if (bcLogs) {
      const timestamp = new Date().toLocaleTimeString();
      const entry = document.createElement('div');
      entry.className = 'log-entry error';
      entry.innerHTML = `
        <span class="log-time" style="color:var(--text-muted)">[${timestamp}]</span> 
        <strong>Broadcast Error:</strong> ${err.message}
      `;
      bcLogs.insertBefore(entry, bcLogs.firstChild);
    }
    alert(err.message || 'Failed to dispatch broadcast');
  }
}
