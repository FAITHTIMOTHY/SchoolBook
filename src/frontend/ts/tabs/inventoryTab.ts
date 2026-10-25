/**
 * SchoolBook SMS - Campus Inventory Controller
 */

import { apiFetch } from '../api.js';
import { state } from '../state.js';
import { escapeAttribute, escapeHtml } from '../html.js';
import { InventoryItem, InventoryStatus } from '../types.js';

export async function loadInventoryData(): Promise<void> {
  try {
    const items = await apiFetch<InventoryItem[]>('/api/inventory');
    const grid = document.getElementById('inventory-items-grid');
    if (!grid) return;

    const isAuthorizedToEdit = state.isAuthorizedToEditInventory();

    if (items.length === 0) {
      grid.innerHTML = `<div class="text-center" style="grid-column: 1/-1;">No equipment or facilities registered on this campus.</div>`;
      return;
    }

    grid.innerHTML = items.map(item => {
      const isSelected = (val: string) => item.status === val ? 'selected' : '';
      const badgeClass = item.status === 'Active' ? 'badge-active' : (item.status === 'Faulty' ? 'badge-faulty' : 'badge-inactive');

      return `
        <div class="inventory-card">
          <div>
            <h3>${escapeHtml(item.item_name)}</h3>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:4px;">${escapeHtml(item.description || 'No description provided.')}</p>
          </div>
          
          <div class="inv-meta">
            <span class="inv-dept">${escapeHtml(state.getUnitLabel(item.unit_id))}</span>
            <span class="badge ${badgeClass}">${escapeHtml(item.status)}</span>
          </div>

          ${isAuthorizedToEdit ? `
            <div class="inv-controls">
              <select onchange="window.updateInventoryStatus('${escapeAttribute(item.id)}', this.value)" class="form-input select-input btn-sm flex-1">
                <option value="Active" ${isSelected('Active')}>Active</option>
                <option value="Faulty" ${isSelected('Faulty')}>Faulty</option>
                <option value="Unavailable" ${isSelected('Unavailable')}>Unavailable</option>
              </select>
              ${state.isPrincipal() ? `
                <button class="btn btn-danger btn-sm" onclick="window.deleteInventoryItem('${escapeAttribute(item.id)}')">✖ Delete</button>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load campus inventory assets:', err);
  }
}

export async function updateInventoryStatus(id: string, status: string): Promise<void> {
  try {
    await apiFetch(`/api/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    await loadInventoryData();
  } catch (err: any) {
    alert(err.message || 'Failed to update equipment status');
  }
}

export async function deleteInventoryItem(id: string): Promise<void> {
  if (!confirm('Remove this equipment from the campus inventory permanently?')) return;

  try {
    const res = await apiFetch<{ message: string }>(`/api/inventory/${id}`, { method: 'DELETE' });
    alert(res.message);
    await loadInventoryData();
  } catch (err: any) {
    alert(err.message || 'Failed to delete inventory item');
  }
}
