/**
 * SchoolBook SMS - Financial Vault & Tuition Gateway Controller
 */

import { apiFetch } from '../api.js';
import { state } from '../state.js';
import { FinancialLedgerItem, FinancialProjections } from '../types.js';

export async function loadFinancialsData(): Promise<void> {
  if (!state.canAccessFinance()) return;

  try {
    // 1. Load Ledger History
    const ledger = await apiFetch<FinancialLedgerItem[]>('/api/financials');
    const tbody = document.getElementById('finance-ledger-tbody');

    if (tbody) {
      if (ledger.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">No tuition or fee transactions logged under active campus.</td></tr>`;
      } else {
        tbody.innerHTML = ledger.map(l => `
          <tr>
            <td>${new Date(l.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            <td><strong>${l.contributorName}</strong></td>
            <td><span class="badge badge-role">${l.category}</span></td>
            <td>${l.payment_method}</td>
            <td><strong>$${l.amount.toFixed(2)}</strong></td>
          </tr>
        `).join('');
      }
    }

    // 2. Load Projections & Growth Rates
    const projections = await apiFetch<FinancialProjections>('/api/financials/projections');
    const elGrowthRate = document.getElementById('finance-growth-rate');
    const elNextProj = document.getElementById('finance-next-projection');

    if (elGrowthRate) elGrowthRate.textContent = `${projections.growthRatePercent}%`;
    if (elNextProj) {
      elNextProj.textContent = `$${projections.projectedNextWeek.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

  } catch (err) {
    console.error('Failed loading financials ledger reports:', err);
  }
}

export async function handlePaymentSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const payForm = document.getElementById('payment-gateway-form') as HTMLFormElement | null;
  const payCategory = document.getElementById('pay-category') as HTMLSelectElement | null;
  const payAmount = document.getElementById('pay-amount') as HTMLInputElement | null;
  const payMethod = document.getElementById('pay-method') as HTMLSelectElement | null;
  const payAnonymous = document.getElementById('pay-anonymous') as HTMLInputElement | null;
  const payCardNumber = document.getElementById('pay-card-number') as HTMLInputElement | null;
  const payCardExpiry = document.getElementById('pay-card-expiry') as HTMLInputElement | null;
  const payCardCvv = document.getElementById('pay-card-cvv') as HTMLInputElement | null;
  const cardFields = document.getElementById('card-fields');

  const body = {
    amount: Number(payAmount?.value || 0),
    category: payCategory?.value || 'Tuition',
    payment_method: payMethod?.value || 'Card',
    card_number: payCardNumber?.value || '',
    card_expiry: payCardExpiry?.value || '',
    card_cvv: payCardCvv?.value || '',
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
