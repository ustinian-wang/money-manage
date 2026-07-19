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
});
