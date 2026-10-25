/**
 * SchoolBook SMS - Financial Vault & Tuition Gateway Controller
 */

import { apiFetch } from '../api.js';
import { state } from '../state.js';
import { escapeHtml } from '../html.js';
import { FinancialLedgerItem, FinancialProjections } from '../types.js';

export async function loadFinancialsData(): Promise<void> {
  if (!state.canAccessFinance()) return;

  const [ledgerResult, projectionResult] = await Promise.allSettled([
    apiFetch<FinancialLedgerItem[]>('/api/financials'),
    apiFetch<FinancialProjections>('/api/financials/projections'),
  ]);

  const tbody = document.getElementById('finance-ledger-tbody');

  if (ledgerResult.status === 'fulfilled') {
    const ledger = ledgerResult.value;

    if (tbody) {
      if (ledger.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">No tuition or fee transactions logged under active campus.</td></tr>`;
      } else {
        tbody.innerHTML = ledger
          .map(
            (entry) => `
              <tr>
                <td>${new Date(entry.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td><strong>${escapeHtml(entry.contributorName)}</strong></td>
                <td><span class="badge badge-role">${escapeHtml(entry.category)}</span></td>
                <td>${escapeHtml(entry.payment_method)}</td>
                <td><strong>$${entry.amount.toFixed(2)}</strong></td>
              </tr>
            `,
          )
          .join('');
      }
    }
  } else {
    console.error('Failed loading financial ledger:', ledgerResult.reason);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">The ledger could not be loaded. Try again shortly.</td></tr>`;
    }
  }

  const elGrowthRate = document.getElementById('finance-growth-rate');
  const elNextProj = document.getElementById('finance-next-projection');

  if (projectionResult.status === 'fulfilled') {
    const projections = projectionResult.value;

    if (elGrowthRate) {
      elGrowthRate.textContent = `${projections.growthRatePercent}%`;
    }
    if (elNextProj) {
      elNextProj.textContent = `$${projections.projectedNextWeek.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  } else {
    console.error(
      'Failed loading financial projections:',
      projectionResult.reason,
    );
    if (elGrowthRate) elGrowthRate.textContent = 'Unavailable';
    if (elNextProj) elNextProj.textContent = 'Unavailable';
  }
}

export async function handlePaymentSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const payForm = document.getElementById('payment-gateway-form') as HTMLFormElement | null;
  const payCategory = document.getElementById('pay-category') as HTMLSelectElement | null;
  const payAmount = document.getElementById('pay-amount') as HTMLInputElement | null;
  const payMethod = document.getElementById('pay-method') as HTMLSelectElement | null;
  const payAnonymous = document.getElementById('pay-anonymous') as HTMLInputElement | null;
  const payReference = document.getElementById('pay-reference') as HTMLInputElement | null;
  const cardFields = document.getElementById('card-fields');

  const method = payMethod?.value || 'Card';
  const reference = payReference?.value.trim() || '';

  if (method === 'Card' && !reference) {
    alert('Card payments require the reference supplied by your payment gateway. Raw card numbers are never accepted.');
    payReference?.focus();
    return;
  }

  const body = {
    amount: Number(payAmount?.value || 0),
    category: payCategory?.value || 'Tuition',
    payment_method: method,
    reference: reference || undefined,
    anonymous: payAnonymous?.checked || false,
  };

  try {
    const res = await apiFetch<{ message: string }>('/api/financials/pay', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    alert(res.message);
    if (payForm) payForm.reset();
    if (cardFields) cardFields.style.display = 'block';
    await loadFinancialsData();

  } catch (err: any) {
    alert(`Transaction Rejected: ${err.message}`);
  }
}
