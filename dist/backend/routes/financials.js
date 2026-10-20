import { Router } from 'express';
import { collections, saveDB } from '../db/db.js';
import { authMiddleware } from '../middleware/auth.js';
const router = Router();
// Helper to check if a user has access to financials (Only Principal and Bursar / Finance Unit)
function checkFinanceAccess(req) {
    if (!req.user)
        return false;
    if (req.user.role === 'Principal')
        return true;
    if (req.user.unit_id) {
        const units = collections.getUnits();
        const userUnit = units.find(u => u.id === req.user?.unit_id);
        if (userUnit && (userUnit.name.toLowerCase().includes('finance') || userUnit.name.toLowerCase().includes('bursar'))) {
            return true;
        }
    }
    return false;
}
// 1. Get financial records
// Specialized for Principal and Bursar / Finance Office
router.get('/', authMiddleware, (req, res) => {
    if (!checkFinanceAccess(req)) {
        return res.status(403).json({
            error: 'Access Denied: Financial registries are strictly specialized for the Principal and Bursar / Finance Office.'
        });
    }
    const tenantId = req.tenantId;
    const financials = collections.getFinancials().filter(f => f.tenant_id === tenantId);
    // Resolve member name for each record for display purposes
    const members = collections.getMembers();
    const recordsWithNames = financials.map(f => {
        const contributor = f.member_id ? members.find(m => m.id === f.member_id) : null;
        return {
            ...f,
            contributorName: contributor ? contributor.name : 'Anonymous Benefactor'
        };
    });
    return res.json(recordsWithNames);
});
// 2. Submit payment (Secure mock payment gateway for Tuition, Lab & Library Fees, PTA)
// Accessible by students, parents, or staff logged in to pay fees directly
router.post('/pay', authMiddleware, (req, res) => {
    const currentUser = req.user;
    const tenantId = req.tenantId;
    const { amount, category, payment_method, card_number, card_expiry, card_cvv, anonymous } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Please enter a valid amount greater than zero.' });
    }
    const validCategories = ['Tuition', 'Lab & Library Fees', 'PTA & Extracurricular', 'Donations'];
    if (!category || !validCategories.includes(category)) {
        return res.status(400).json({ error: `Category must be one of: ${validCategories.join(', ')}.` });
    }
    if (!payment_method) {
        return res.status(400).json({ error: 'Payment method is required.' });
    }
    // If card is used, simulate security validation (secure end-to-end payment demonstration)
    if (payment_method === 'Card') {
        if (!card_number || !card_expiry || !card_cvv) {
            return res.status(400).json({ error: 'Card details (Number, Expiry, CVV) are required for card transactions.' });
        }
        const cleanCardNum = card_number.replace(/\D/g, '');
        if (cleanCardNum.length < 13 || cleanCardNum.length > 19) {
            return res.status(400).json({ error: 'Secure Gateway Error: Invalid credit card number format.' });
        }
        if (card_cvv.replace(/\D/g, '').length < 3) {
            return res.status(400).json({ error: 'Secure Gateway Error: CVV code verification failed.' });
        }
    }
    const newRecord = {
        id: `fin_${tenantId}_${Date.now()}`,
        tenant_id: tenantId,
        member_id: anonymous ? null : currentUser.id,
        amount: Number(amount),
        category,
        payment_method,
        transaction_date: new Date().toISOString(),
        recorded_by: currentUser.id,
    };
    collections.getFinancials().push(newRecord);
    saveDB();
    return res.status(201).json({
        success: true,
        message: `Payment of $${amount} for ${category} successfully processed via Secure School Gateway.`,
        receipt: newRecord,
    });
});
// 3. Projections & Statistics calculations
// Restricted to Principal and Bursar / Finance Office
router.get('/projections', authMiddleware, (req, res) => {
    if (!checkFinanceAccess(req)) {
        return res.status(403).json({
            error: 'Access Denied: Financial projections are restricted to the Principal and Bursar / Finance Office.'
        });
    }
    const tenantId = req.tenantId;
    const financials = collections.getFinancials().filter(f => f.tenant_id === tenantId);
    // Group transactions by category
    const categories = {
        Tuition: 0,
        'Lab & Library Fees': 0,
        'PTA & Extracurricular': 0,
        Donations: 0,
        Total: 0,
    };
    financials.forEach(f => {
        if (categories[f.category] !== undefined) {
            categories[f.category] += f.amount;
        }
        categories.Total += f.amount;
    });
    // Calculate trends over the past 4 weeks (weekly projections)
    const today = new Date();
    const getWeekIndex = (dateStr) => {
        const txDate = new Date(dateStr);
        const diffTime = Math.abs(today.getTime() - txDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.floor(diffDays / 7); // 0 = this week, 1 = last week, 2 = 2 weeks ago, etc.
    };
    const weeklyTotals = [0, 0, 0, 0]; // Index 0: Week 1 (Oldest), Index 3: Week 4 (Current/Newest)
    financials.forEach(f => {
        const weekIdx = getWeekIndex(f.transaction_date);
        if (weekIdx >= 0 && weekIdx < 4) {
            const mapIdx = 3 - weekIdx;
            weeklyTotals[mapIdx] += f.amount;
        }
    });
    // Project next week's collections using average growth rate
    const growthRates = [];
    for (let i = 0; i < weeklyTotals.length - 1; i++) {
        const prev = weeklyTotals[i];
        const curr = weeklyTotals[i + 1];
        if (prev > 0) {
            growthRates.push((curr - prev) / prev);
        }
    }
    // Calculate average growth rate
    const avgGrowthRate = growthRates.length > 0
        ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length
        : 0.05; // Default 5% projected growth if data is sparse
    // Calculate project values
    const currentWeekValue = weeklyTotals[3];
    const projectedNextWeekValue = currentWeekValue > 0
        ? currentWeekValue * (1 + avgGrowthRate)
        : categories.Total > 0 ? (categories.Total / financials.length) * 1.05 : 500; // default estimate
    return res.json({
        summary: categories,
        weeklyHistorical: [
            { name: '3 Weeks Ago', amount: weeklyTotals[0] },
            { name: '2 Weeks Ago', amount: weeklyTotals[1] },
            { name: 'Last Week', amount: weeklyTotals[2] },
            { name: 'Current Week', amount: weeklyTotals[3] },
        ],
        growthRatePercent: Math.round(avgGrowthRate * 1000) / 10,
        projectedNextWeek: Math.round(projectedNextWeekValue * 100) / 100,
    });
});
export default router;
