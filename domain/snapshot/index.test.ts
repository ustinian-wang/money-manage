import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applySnapshotChanges,
    classifySnapshotDate,
    compareSnapshotWithPrevious,
    confirmSnapshotSave,
    getPreviousSnapshot,
    getSnapshotsForSimulation,
    resolveSimulationWindow,
    validateSnapshotSave,
} from './index.ts';
import type { FinancialSnapshot, SnapshotState } from '../../types/snapshot.ts';

const state: SnapshotState = {
    grossMonthlySalary: 20000, otherMonthlyIncome: 0, parentSupportMonthly: 3000,
    livingExpenseMonthly: 5000, cashAssets: 100000, investmentAssets: 50000,
    investmentReturnRate: 3, committedDownPayments: 20000,
};

const makeSnapshot = (overrides: Partial<FinancialSnapshot>): FinancialSnapshot => ({
    id: 's-1', name: '收入变化', effectiveDate: '2030-01-15', changes: [],
    createdAt: '2026-07-20T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z', ...overrides,
});

test('builds a 30-year window and classifies exact snapshot dates', () => {
    const window = resolveSimulationWindow({ asOfDate: '2026-07-20' });
    assert.equal(window.horizonMonths, 360);
    assert.equal(window.endDate, '2056-07-20');
    assert.equal(classifySnapshotDate(makeSnapshot({ effectiveDate: '2026-07-20' }), '2026-07-20'), 'current');
    assert.equal(classifySnapshotDate(makeSnapshot({ effectiveDate: '2030-01-15' }), '2026-07-20'), 'future');
});

test('filters snapshots to the future window and compares with the latest previous snapshot', () => {
    const snapshots = [
        makeSnapshot({ id: 'past', effectiveDate: '2025-01-01' }),
        makeSnapshot({ id: 'near', effectiveDate: '2028-01-01', changes: [{ id: 'salary', path: 'grossMonthlySalary', value: 18000 }] }),
        makeSnapshot({ id: 'far', effectiveDate: '2057-01-01' }),
    ];
    assert.deepEqual(getSnapshotsForSimulation(snapshots, { asOfDate: '2026-07-20' }).map((item) => item.id), ['near']);
    assert.equal(getPreviousSnapshot(snapshots, '2030-01-01')?.id, 'near');
    assert.deepEqual(compareSnapshotWithPrevious(snapshots[1], snapshots[0]), [{ path: 'grossMonthlySalary', previous: undefined, next: 18000, mode: 'set' }]);
});

test('requires explicit confirmation before allowing a negative asset snapshot', () => {
    const risky = makeSnapshot({ changes: [{ id: 'cash', path: 'cashAssets', value: -200000 }] });
    const blocked = validateSnapshotSave(state, risky);
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.requiresConfirmation, true);
    assert.equal(confirmSnapshotSave(state, risky, true).blocked, false);
});

test('applies set, add, and remove snapshot changes', () => {
    assert.deepEqual(applySnapshotChanges(state, [
        { id: 'salary', path: 'grossMonthlySalary', value: 5000 },
        { id: 'support', path: 'parentSupportMonthly', value: 1000, mode: 'add' },
        { id: 'living', path: 'livingExpenseMonthly', value: 500, mode: 'remove' },
    ]), { ...state, grossMonthlySalary: 5000, parentSupportMonthly: 4000, livingExpenseMonthly: 4500 });
});
