import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applySnapshotChanges,
    compareSnapshotWithPrevious,
    confirmSnapshotSave,
    getPreviousSnapshot,
    resolveSimulationWindow,
    toMonthCount,
    validateSnapshotSave,
} from '../domain/snapshot/index';
import { termToMonths } from '../types/installment';
import { compareProfiles } from '../lib/scenario/compare';
import { applyOverrides } from '../lib/scenario/applyOverrides';
import { createAutosave, LOCAL_REVISION_KEY, LOCAL_STATE_KEY } from '../lib/persistence/clientAutosave';
import type { FinancialSnapshot, SnapshotState } from '../types/snapshot';
import type { PersistedState } from '../lib/persistence/types';

const state = (overrides: Partial<SnapshotState> = {}): SnapshotState => ({
    grossMonthlySalary: 20000,
    otherMonthlyIncome: 0,
    parentSupportMonthly: 3000,
    livingExpenseMonthly: 5000,
    cashAssets: 200000,
    investmentAssets: 300000,
    investmentReturnRate: 3,
    committedDownPayments: 0,
    ...overrides,
});

const snapshot = (overrides: Partial<FinancialSnapshot> = {}): FinancialSnapshot => ({
    id: 'snapshot-test',
    name: '测试快照',
    effectiveDate: '2031-06-01',
    changes: [{ id: 'salary', path: 'grossMonthlySalary', value: 5000, mode: 'set' }],
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
});

test('snapshot applies a salary change without mutating the previous state', () => {
    const before = state();
    const after = applySnapshotChanges(before, snapshot().changes);
    assert.equal(after.grossMonthlySalary, 5000);
    assert.equal(before.grossMonthlySalary, 20000);
});

test('simulation defaults to 30 years and supports an explicit month horizon', () => {
    assert.deepEqual(resolveSimulationWindow({ asOfDate: '2026-07-20' }), {
        asOfDate: '2026-07-20',
        horizonMonths: 360,
        endDate: '2056-07-20',
    });
    assert.equal(resolveSimulationWindow({ asOfDate: '2026-07-20', horizonMonths: 18 }).horizonMonths, 18);
});

test('snapshot comparison uses the most recent earlier date', () => {
    const earlier = snapshot({ id: 'earlier', effectiveDate: '2028-01-01', changes: [{ id: 'salary', path: 'grossMonthlySalary', value: 18000 }] });
    const current = snapshot({ changes: [{ id: 'salary', path: 'grossMonthlySalary', value: 5000 }] });
    assert.equal(getPreviousSnapshot([earlier], current.effectiveDate)?.id, 'earlier');
    assert.deepEqual(compareSnapshotWithPrevious(current, earlier)[0], {
        path: 'grossMonthlySalary', previous: 18000, next: 5000, mode: 'set',
    });
});

test('negative-asset snapshot requires explicit confirmation before saving', () => {
    const risky = snapshot({ changes: [{ id: 'cash', path: 'cashAssets', value: -250000 }] });
    const blocked = validateSnapshotSave(state(), risky);
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.requiresConfirmation, true);
    assert.equal(confirmSnapshotSave(state(), risky, true).blocked, false);
    assert.equal(confirmSnapshotSave(state(), risky, true).minimumCashAssets, -250000);
});

test('installment terms accept months and years', () => {
    assert.equal(termToMonths({ value: 36, unit: 'month' }), 36);
    assert.equal(termToMonths({ value: 3, unit: 'year' }), 36);
    assert.equal(toMonthCount(2.5, 'year'), 30);
});

test('scenario comparison does not mutate the baseline profile', () => {
    const profile = { socialSecurity: { housingFund: { personalRate: 5 } } };
    const comparison = applyOverrides(profile, [{ path: 'socialSecurity.housingFund.personalRate', before: 5, after: 12 }]);
    assert.equal(profile.socialSecurity.housingFund.personalRate, 5);
    assert.equal(comparison.socialSecurity.housingFund.personalRate, 12);
    const compared = compareProfiles(profile, [{ path: 'socialSecurity.housingFund.personalRate', before: 5, after: 12 }]);
    assert.equal((compared.comparison as any).socialSecurity.housingFund.personalRate, 12);
});

test('autosave writes every interaction to localStorage and flushes on blur', async () => {
    const writes: Array<{ url: string; body: string }> = [];
    const storage = new Map<string, string>();
    const oldWindow = globalThis.window;
    const oldFetch = globalThis.fetch;
    globalThis.window = {
        localStorage: {
            setItem(key: string, value: string) { storage.set(key, value); },
            getItem(key: string) { return storage.get(key) ?? null; },
        },
        addEventListener() {},
        removeEventListener() {},
    } as unknown as Window & typeof globalThis;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
        writes.push({ url, body: String(init?.body) });
        return new Response(null, { status: 200 });
    }) as typeof fetch;

    try {
        const profile = { schemaVersion: 1, revision: 7, updatedAt: '2026-07-20T00:00:00.000Z', profile: {}, snapshots: [], scenarios: [] } as PersistedState;
        const autosave = createAutosave({ apiPath: '/api/profile', debounceMs: 1000 });
        autosave.onInput(profile);
        assert.equal(storage.get(LOCAL_STATE_KEY), JSON.stringify(profile));
        assert.equal(storage.get(LOCAL_REVISION_KEY), '7');
        await autosave.onBlur(profile);
        assert.equal(writes.length, 1);
        assert.match(writes[0].body, /"revision":7/);
    } finally {
        globalThis.window = oldWindow;
        globalThis.fetch = oldFetch;
    }
});

test('asset and percentage slider constraints are explicit contracts until production exports exist', { skip: 'No production asset validator or slider conversion export exists yet.' }, () => {
    assert.fail('Expected cash 0..2000000, investment <= total assets, return 0..100, and percentage/value conversion.');
});
