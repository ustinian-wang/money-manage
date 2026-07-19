import assert from 'node:assert/strict';
import test from 'node:test';
import type { FinancialSnapshot, SnapshotState } from '../../types/snapshot.ts';
import {
    compareSnapshotWithPrevious,
    confirmSnapshotSave,
    getPreviousSnapshot,
    getSnapshotsForSimulation,
    resolveSimulationWindow,
    validateSnapshotSave,
} from './index.ts';

const state: SnapshotState = {
    grossMonthlySalary: 20000,
    otherMonthlyIncome: 0,
    parentSupportMonthly: 3000,
    livingExpenseMonthly: 5000,
    cashAssets: 100000,
    investmentAssets: 50000,
    investmentReturnRate: 3,
    committedDownPayments: 0,
};

const snapshot = (id: string, effectiveDate: string, salary: number): FinancialSnapshot => ({
    id,
    name: id,
    effectiveDate,
    changes: [{ id: `${id}-salary`, path: 'grossMonthlySalary', value: salary }],
    createdAt: `${effectiveDate}T00:00:00Z`,
    updatedAt: `${effectiveDate}T00:00:00Z`,
});

test('defaults to a 30-year window from the current date', () => {
    assert.deepEqual(resolveSimulationWindow({ asOfDate: '2026-07-20' }), {
        asOfDate: '2026-07-20',
        horizonMonths: 360,
        endDate: '2056-07-20',
    });
});

test('filters and sorts snapshots by concrete effective date', () => {
    const snapshots = [snapshot('later', '2027-06-01', 5000), snapshot('earlier', '2027-01-15', 18000)];
    assert.deepEqual(getSnapshotsForSimulation(snapshots, { asOfDate: '2027-01-01', horizonMonths: 12 }).map((item) => item.id), ['earlier', 'later']);
    assert.equal(getPreviousSnapshot(snapshots, '2027-06-01')?.id, 'earlier');
});

test('compares the current snapshot with the most recent prior snapshot', () => {
    const previous = snapshot('previous', '2030-01-01', 20000);
    const current = snapshot('current', '2035-01-01', 5000);
    assert.deepEqual(compareSnapshotWithPrevious(current, previous)[0], {
        path: 'grossMonthlySalary', previous: 20000, next: 5000, mode: 'set',
    });
});

test('blocks a snapshot that breaks available assets until explicitly confirmed', () => {
    const risky = snapshot('risky', '2035-01-01', 5000);
    risky.changes.push({ id: 'cash', path: 'cashAssets', value: -200000 });
    const blocked = validateSnapshotSave(state, risky);
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.requiresConfirmation, true);
    assert.equal(confirmSnapshotSave(state, risky, true).blocked, false);
    assert.equal(confirmSnapshotSave(state, risky, false).blocked, true);
});
