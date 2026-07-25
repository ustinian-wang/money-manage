/**
 * 支出域：固定/比例/一次性/分期按期、endDate 缩短期数、followRetirement
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateExpenseAmount, calculateMonthlyExpenses } from './index';

const baseContext = { month: '2027-02', grossIncome: 20000, netIncome: 16000, totalIncome: 16500 };

describe('expense domain 支出', () => {
    it('计算固定、比例与一次性支出', () => {
        assert.equal(
            calculateExpenseAmount(
                {
                    id: 'a',
                    name: '父母上交',
                    category: 'family_support',
                    paymentMode: 'fixed_monthly',
                    enabled: true,
                    amount: 3000,
                    createdAt: '',
                    updatedAt: '',
                },
                baseContext,
            ),
            3000,
        );
        assert.equal(
            calculateExpenseAmount(
                {
                    id: 'b',
                    name: '家庭支持',
                    category: 'family_support',
                    paymentMode: 'percentage',
                    enabled: true,
                    amount: 10,
                    percentageBase: 'net_income',
                    createdAt: '',
                    updatedAt: '',
                },
                baseContext,
            ),
            1600,
        );
        assert.equal(
            calculateExpenseAmount(
                {
                    id: 'c',
                    name: '旅行',
                    category: 'other',
                    paymentMode: 'one_time',
                    enabled: true,
                    amount: 12000,
                    startMonth: '2027-02',
                    createdAt: '',
                    updatedAt: '',
                },
                baseContext,
            ),
            12000,
        );
    });

    it('分期按实际期数计费，期满为 0', () => {
        const item = {
            id: 'loan',
            name: '车贷',
            category: 'transport' as const,
            paymentMode: 'installment' as const,
            enabled: true,
            amount: 0,
            startMonth: '2027-01',
            createdAt: '',
            updatedAt: '',
            installment: {
                totalPrice: 12000,
                downPaymentAmount: 0,
                termMonths: 12,
                interestPlans: [
                    { id: 'plan', type: 'general' as const, principal: 12000, annualRate: 0, termMonths: 12 },
                ],
            },
        };
        const first = calculateExpenseAmount(item, { ...baseContext, month: '2027-01' });
        const second = calculateExpenseAmount(item, { ...baseContext, month: '2027-02' });
        assert.ok(first > 0);
        assert.ok(second > 0);
        assert.equal(calculateMonthlyExpenses([item], { ...baseContext, month: '2028-01' }), 0);
    });

    it('endDate 缩短有效期后重算月供', () => {
        const item = {
            id: 'dated-loan',
            name: '短期分期',
            category: 'transport' as const,
            paymentMode: 'installment' as const,
            enabled: true,
            amount: 0,
            effectiveDate: '2027-03-15',
            createdAt: '',
            updatedAt: '',
            installment: {
                totalPrice: 12000,
                downPaymentAmount: 0,
                term: { value: 2, unit: 'year' as const },
                startDate: '2027-03-15',
                endDate: '2027-08-31',
                interestPlans: [
                    { id: 'plan', type: 'general' as const, principal: 12000, annualRate: 0, termMonths: 24 },
                ],
            },
        };
        const before = calculateExpenseAmount(item, { ...baseContext, month: '2027-02' });
        const first = calculateExpenseAmount(item, { ...baseContext, month: '2027-03' });
        const last = calculateExpenseAmount(item, { ...baseContext, month: '2027-08' });
        const after = calculateExpenseAmount(item, { ...baseContext, month: '2027-09' });
        assert.equal(before, 0);
        assert.equal(first, 2000);
        assert.equal(last, 2000);
        assert.equal(after, 0);
    });

    it('仅在 followRetirement 时按退休日截断', () => {
        const item = {
            id: 'retirement-loan',
            name: '退休前分期',
            category: 'other' as const,
            paymentMode: 'installment' as const,
            enabled: true,
            amount: 0,
            createdAt: '',
            updatedAt: '',
            installment: {
                totalPrice: 12000,
                downPaymentAmount: 0,
                termMonths: 24,
                followRetirement: true,
                startDate: '2027-01-01',
                interestPlans: [
                    { id: 'plan', type: 'general' as const, principal: 12000, annualRate: 0, termMonths: 24 },
                ],
            },
        };
        assert.equal(
            calculateExpenseAmount(item, {
                ...baseContext,
                month: '2027-12',
                retirementDate: '2027-06-01',
            }),
            0,
        );
        assert.ok(calculateExpenseAmount(item, { ...baseContext, month: '2027-05' }) > 0);
    });
});
