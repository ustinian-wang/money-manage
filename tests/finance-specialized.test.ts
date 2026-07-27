import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateParentSupportExpense, calculateTax } from '../domain/tax/index';
import { calculateSocialSecurity } from '../domain/social-security/index';
import { calculateExpenseAmount, calculateMonthlyExpenses } from '../domain/expense/index';
import { clampNumberField } from '../app/numberFieldUi';
import { compareProfiles } from '../lib/scenario/compare';
import { createAutosave, LOCAL_REVISION_KEY, LOCAL_STATE_KEY } from '../lib/persistence/clientAutosave';
import type { PersistedState } from '../lib/persistence/types';
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

test('asset cash/invest stay within total via clampNumberField', () => {
    const totalAssets = 500_000;
    assert.equal(clampNumberField(-1, { min: 0, max: totalAssets }), 0);
    assert.equal(clampNumberField(totalAssets + 1, { min: 0, max: totalAssets }), totalAssets);
    assert.equal(clampNumberField(120_000, { min: 0, max: totalAssets }), 120_000);
    // 理财占比 0..100；金额侧由 UI 再 clamp 到 totalAssets
    assert.equal(clampNumberField(150, { min: 0, max: 100 }), 100);
    assert.equal(clampNumberField(-5, { min: 0, max: 100 }), 0);
});

test('annual return rate clamps to 0..100 inclusive', () => {
    assert.equal(clampNumberField(0, { min: 0, max: 100 }), 0);
    assert.equal(clampNumberField(100, { min: 0, max: 100 }), 100);
    assert.equal(clampNumberField(3.2, { min: 0, max: 100 }), 3.2);
    assert.equal(clampNumberField(-1, { min: 0, max: 100 }), 0);
    assert.equal(clampNumberField(101, { min: 0, max: 100 }), 100);
});

test('scenario before/after comparison yields baseline and override profiles', () => {
    const baseline = { socialSecurity: { housingFund: { personalRate: 5 } }, salary: 20000 };
    const overrides = [
        { path: 'socialSecurity.housingFund.personalRate', before: 5, after: 12 },
        { path: 'salary', before: 20000, after: 25000 },
    ];
    const { baseline: left, comparison, overrides: applied } = compareProfiles(baseline, overrides);
    assert.equal(left.salary, 20000);
    assert.equal((left.socialSecurity as { housingFund: { personalRate: number } }).housingFund.personalRate, 5);
    assert.equal(comparison.salary, 25000);
    assert.equal((comparison.socialSecurity as { housingFund: { personalRate: number } }).housingFund.personalRate, 12);
    assert.equal(applied.length, 2);
    assert.equal(baseline.salary, 20000); // 不改原对象
});

test('autosave persists on input/blur and flushes on pagehide', async () => {
    const writes: Array<{ url: string; body: string }> = [];
    const storage = new Map<string, string>();
    const listeners = new Map<string, Array<() => void>>();
    const oldWindow = globalThis.window;
    const oldFetch = globalThis.fetch;
    globalThis.window = {
        localStorage: {
            setItem(key: string, value: string) { storage.set(key, value); },
            getItem(key: string) { return storage.get(key) ?? null; },
        },
        addEventListener(type: string, handler: () => void) {
            const list = listeners.get(type) ?? [];
            list.push(handler);
            listeners.set(type, list);
        },
        removeEventListener(type: string, handler: () => void) {
            const list = listeners.get(type) ?? [];
            listeners.set(type, list.filter((h) => h !== handler));
        },
    } as unknown as Window & typeof globalThis;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
        writes.push({ url: String(url), body: String(init?.body) });
        return new Response(null, { status: 200 });
    }) as typeof fetch;

    try {
        const state = {
            schemaVersion: 1,
            revision: 4,
            updatedAt: '2026-07-20T00:00:00.000Z',
            profile: {},
            snapshots: [],
            scenarios: [],
        } as PersistedState;
        const autosave = createAutosave({ apiPath: '/api/profile', debounceMs: 10_000 });
        const unbind = autosave.bindLifecycle();
        autosave.onInput(state);
        assert.equal(storage.get(LOCAL_STATE_KEY), JSON.stringify(state));
        assert.equal(storage.get(LOCAL_REVISION_KEY), '4');
        await autosave.onBlur(state);
        assert.equal(writes.length, 1);
        assert.match(writes[0].body, /"revision":4/);
        writes.length = 0;
        autosave.onInput({ ...state, revision: 5 });
        assert.equal(storage.get(LOCAL_REVISION_KEY), '5');
        for (const handler of listeners.get('pagehide') ?? []) handler();
        await autosave.pending;
        assert.equal(writes.length, 1);
        assert.match(writes[0].body, /"revision":5/);
        unbind();
    } finally {
        globalThis.window = oldWindow;
        globalThis.fetch = oldFetch;
    }
});
