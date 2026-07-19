import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateParentSupportExpense, calculateTax } from '../domain/tax/index';
import { calculateSocialSecurity } from '../domain/social-security/index';
import { calculateExpenseAmount, calculateMonthlyExpenses } from '../domain/expense/index';
import type { ExpenseItem } from '../types/expense';

const expense = (overrides: Partial<ExpenseItem>): ExpenseItem => ({
    id: 'expense-test',
    name: '测试支出',
    category: 'other',
    paymentMode: 'fixed_monthly',
    enabled: true,
    amount: 0,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
});

test('tax and social security produce the wage-to-card inputs', () => {
    const social = calculateSocialSecurity({
        contributionBase: 20000,
        rates: { housingFund: { personal: 12, company: 5 } },
    });
    const tax = calculateTax({
        grossMonthlyIncome: 20000,
        personalSocialSecurityMonthly: social.personalTotal,
        deductions: {
            rent: { enabled: true, deductionRate: 100, deductionBaseMonthly: 1500 },
            elderlySupport: { enabled: true, deductionRate: 50, deductionBaseMonthly: 2000 },
        },
    });

    assert.equal(social.items.find((item) => item.item === 'housingFund')?.personalAmount, 2400);
    assert.equal(tax.deductions.find((item) => item.key === 'rent')?.actualMonthlyAmount, 1500);
    assert.equal(tax.deductions.find((item) => item.key === 'elderlySupport')?.actualMonthlyAmount, 1000);
    assert.equal(tax.parentSupportExcludedFromDeductions, true);
    assert.equal(tax.estimatedMonthlyNetIncome, 20000 - social.personalTotal - tax.estimatedMonthlyTax);
});

test('parent support is cashflow only and never changes tax deductions', () => {
    const base = calculateTax({ grossMonthlyIncome: 20000, personalSocialSecurityMonthly: 3000, deductions: {} });
    const fixed = calculateParentSupportExpense({ mode: 'fixed', fixedMonthlyAmount: 3000 }, 17000);
    const percentage = calculateParentSupportExpense({ mode: 'percentage', incomePercentage: 10 }, 17000);

    assert.equal(fixed, 3000);
    assert.equal(percentage, 1700);
    assert.equal(base.parentSupportExcludedFromDeductions, true);
    assert.equal(base.estimatedMonthlyTax, calculateTax({ grossMonthlyIncome: 20000, personalSocialSecurityMonthly: 3000, deductions: {} }).estimatedMonthlyTax);
});

test('expense items calculate fixed, percentage, one-time and disabled spending', () => {
    const context = { month: '2027-06', grossIncome: 20000, netIncome: 16000, totalIncome: 17000 };
    assert.equal(calculateExpenseAmount(expense({ paymentMode: 'fixed_monthly', amount: 3000 }), context), 3000);
    assert.equal(calculateExpenseAmount(expense({ paymentMode: 'percentage', amount: 10, percentageBase: 'net_income' }), context), 1600);
    assert.equal(calculateExpenseAmount(expense({ paymentMode: 'one_time', amount: 24000, startMonth: '2027-06' }), context), 24000);
    assert.equal(calculateExpenseAmount(expense({ paymentMode: 'one_time', amount: 24000, startMonth: '2027-07' }), context), 0);
    assert.equal(calculateExpenseAmount(expense({ enabled: false, amount: 3000 }), context), 0);
    assert.equal(calculateMonthlyExpenses([
        expense({ id: 'a', amount: 3000 }),
        expense({ id: 'b', paymentMode: 'percentage', amount: 10, percentageBase: 'net_income' }),
    ], context), 4600);
});

test('ExpenseItem CRUD contract is not implemented yet', { skip: 'No production CRUD repository/service/API exists yet.' }, () => {
    assert.fail('Expected ExpenseItem create/update/delete operations to be exported.');
});

test('asset amount and percentage constraints are not implemented yet', { skip: 'No production asset domain or validation export exists yet.' }, () => {
    assert.fail('Expected cash assets 0..2000000 and managed assets <= total assets.');
});

test('annual return rate 0..100 validation is not implemented yet', { skip: 'No production asset/yield validation export exists yet.' }, () => {
    assert.fail('Expected annual return rate to accept 0..100 inclusive and reject outside values.');
});

test('scenario before/after comparison is not implemented yet', { skip: 'No production scenario model or comparison engine exists yet.' }, () => {
    assert.fail('Expected baseline and override scenario trajectories with metric deltas.');
});

test('autosave on input, blur and pagehide is not implemented yet', { skip: 'No production persistence manager or autosave hooks exist yet.' }, () => {
    assert.fail('Expected local save on interaction and flushed server persistence.');
});
