import { calculateExpenseAmount, calculateMonthlyExpenses } from './index';

const baseContext = { month: '2027-02', grossIncome: 20000, netIncome: 16000, totalIncome: 16500 };

describe('expense domain', () => {
    it('calculates fixed, percentage and one-time expenses', () => {
        expect(calculateExpenseAmount({ id: 'a', name: '父母上交', category: 'family_support', paymentMode: 'fixed_monthly', enabled: true, amount: 3000, createdAt: '', updatedAt: '' }, baseContext)).toBe(3000);
        expect(calculateExpenseAmount({ id: 'b', name: '家庭支持', category: 'family_support', paymentMode: 'percentage', enabled: true, amount: 10, percentageBase: 'net_income', createdAt: '', updatedAt: '' }, baseContext)).toBe(1600);
        expect(calculateExpenseAmount({ id: 'c', name: '旅行', category: 'other', paymentMode: 'one_time', enabled: true, amount: 12000, startMonth: '2027-02', createdAt: '', updatedAt: '' }, baseContext)).toBe(12000);
    });

    it('calculates a later installment period instead of always using period one', () => {
        const item = {
            id: 'loan', name: '车贷', category: 'transport' as const, paymentMode: 'installment' as const, enabled: true, amount: 0, startMonth: '2027-01', createdAt: '', updatedAt: '',
            installment: { totalPrice: 12000, downPaymentAmount: 0, termMonths: 12, interestPlans: [{ id: 'plan', type: 'general' as const, principal: 12000, annualRate: 0, termMonths: 12 }] },
        };
        const first = calculateExpenseAmount(item, { ...baseContext, month: '2027-01' });
        const second = calculateExpenseAmount(item, { ...baseContext, month: '2027-02' });
        expect(first).toBeGreaterThan(0);
        expect(second).toBeGreaterThan(0);
        expect(calculateMonthlyExpenses([item], { ...baseContext, month: '2028-01' })).toBe(0);
    });

    it('uses the effective date and recalculates the payment when the end date shortens the term', () => {
        const item = {
            id: 'dated-loan', name: '短期分期', category: 'transport' as const, paymentMode: 'installment' as const,
            enabled: true, amount: 0, effectiveDate: '2027-03-15', createdAt: '', updatedAt: '',
            installment: {
                totalPrice: 12000, downPaymentAmount: 0, term: { value: 2, unit: 'year' as const },
                startDate: '2027-03-15', endDate: '2027-08-31',
                interestPlans: [{ id: 'plan', type: 'general' as const, principal: 12000, annualRate: 0, termMonths: 24 }],
            },
        };
        const before = calculateExpenseAmount(item, { ...baseContext, month: '2027-02' });
        const first = calculateExpenseAmount(item, { ...baseContext, month: '2027-03' });
        const last = calculateExpenseAmount(item, { ...baseContext, month: '2027-08' });
        const after = calculateExpenseAmount(item, { ...baseContext, month: '2027-09' });
        expect(before).toBe(0);
        expect(first).toBe(2000);
        expect(last).toBe(2000);
        expect(after).toBe(0);
    });

    it('follows the supplied retirement date only when enabled', () => {
        const item = {
            id: 'retirement-loan', name: '退休前分期', category: 'other' as const, paymentMode: 'installment' as const,
            enabled: true, amount: 0, createdAt: '', updatedAt: '',
            installment: {
                totalPrice: 12000, downPaymentAmount: 0, termMonths: 24, followRetirement: true,
                startDate: '2027-01-01',
                interestPlans: [{ id: 'plan', type: 'general' as const, principal: 12000, annualRate: 0, termMonths: 24 }],
            },
        };
        expect(calculateExpenseAmount(item, { ...baseContext, month: '2027-12', retirementDate: '2027-06-01' })).toBe(0);
        expect(calculateExpenseAmount(item, { ...baseContext, month: '2027-05' })).toBeGreaterThan(0);
    });
});
