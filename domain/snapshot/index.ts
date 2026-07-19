import type {
    FinancialSnapshot,
    SimulationOptions,
    SnapshotChange,
    SnapshotRiskReport,
    SnapshotState,
} from '../../types/snapshot';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function snapshotDate(snapshot: FinancialSnapshot): string {
    if (snapshot.effectiveDate && DATE_PATTERN.test(snapshot.effectiveDate) && !Number.isNaN(Date.parse(`${snapshot.effectiveDate}T00:00:00Z`))) return snapshot.effectiveDate;
    if (snapshot.effectiveMonth && /^\d{4}-\d{2}$/.test(snapshot.effectiveMonth)) return `${snapshot.effectiveMonth}-01`;
    throw new RangeError('快照生效日期必须是 YYYY-MM-DD，或提供 YYYY-MM 月份');
}

export function toMonthCount(value: number, unit: 'month' | 'year'): number {
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.round(value * (unit === 'year' ? 12 : 1));
}

export function resolveSimulationWindow(options: SimulationOptions = {}) {
    const asOfDate = options.asOfDate || new Date().toISOString().slice(0, 10);
    if (!DATE_PATTERN.test(asOfDate) || Number.isNaN(Date.parse(`${asOfDate}T00:00:00Z`))) throw new RangeError('模拟起始日期必须是 YYYY-MM-DD');
    const horizonMonths = options.horizonMonths !== undefined
        ? Math.max(0, Math.round(options.horizonMonths))
        : Math.max(0, Math.round((options.horizonYears ?? 30) * 12));
    const end = new Date(`${asOfDate}T00:00:00Z`);
    end.setUTCMonth(end.getUTCMonth() + horizonMonths);
    return { asOfDate, horizonMonths, endDate: end.toISOString().slice(0, 10) };
}

export function classifySnapshotDate(snapshot: FinancialSnapshot, asOfDate = new Date().toISOString().slice(0, 10)) {
    if (!DATE_PATTERN.test(asOfDate) || Number.isNaN(Date.parse(`${asOfDate}T00:00:00Z`))) throw new RangeError('比较日期必须是 YYYY-MM-DD');
    const date = snapshotDate(snapshot);
    return date < asOfDate ? 'history' : date === asOfDate ? 'current' : 'future';
}

export function getSnapshotsForSimulation(snapshots: FinancialSnapshot[], options: SimulationOptions = {}) {
    const window = resolveSimulationWindow(options);
    return [...snapshots]
        .filter((snapshot) => {
            const date = snapshotDate(snapshot);
            return date >= window.asOfDate && date <= window.endDate;
        })
        .sort((a, b) => snapshotDate(a).localeCompare(snapshotDate(b)) || a.id.localeCompare(b.id));
}

export function applySnapshotChanges(previous: SnapshotState, changes: SnapshotChange[]): SnapshotState {
    const next = { ...previous };
    for (const change of changes) {
        if (change.path === 'installmentConsumptions') continue;
        const key = change.path as Exclude<SnapshotChange['path'], 'installmentConsumptions'>;
        const current = Number(next[key] || 0);
        const value = Number(change.value);
        if (!Number.isFinite(value)) continue;
        next[key] = change.mode === 'add' ? current + value : change.mode === 'remove' ? current - value : value;
    }
    return next;
}

export function getPreviousSnapshot(snapshots: FinancialSnapshot[], effectiveDate: string): FinancialSnapshot | undefined {
    if (!DATE_PATTERN.test(effectiveDate) || Number.isNaN(Date.parse(`${effectiveDate}T00:00:00Z`))) throw new RangeError('比较日期必须是 YYYY-MM-DD');
    return [...snapshots]
        .filter((item) => snapshotDate(item) < effectiveDate)
        .sort((a, b) => snapshotDate(b).localeCompare(snapshotDate(a)) || b.id.localeCompare(a.id))[0];
}

export function compareSnapshotWithPrevious(snapshot: FinancialSnapshot, previous: FinancialSnapshot | undefined) {
    return snapshot.changes.map((change) => ({
        path: change.path,
        previous: previous?.changes.find((item) => item.path === change.path)?.value,
        next: change.value,
        mode: change.mode || 'set',
    }));
}

function riskMessages(state: SnapshotState): string[] {
    const messages: string[] = [];
    const availableAssets = state.cashAssets + state.investmentAssets - state.committedDownPayments;
    if (state.cashAssets < 0) messages.push('快照后现金资产为负数。');
    if (availableAssets < 0) messages.push('快照后调整后可用资产被击穿。');
    if (state.grossMonthlySalary + state.otherMonthlyIncome - state.parentSupportMonthly - state.livingExpenseMonthly < 0) {
        messages.push('快照后基础月度现金流为负数。');
    }
    return messages;
}

export function validateSnapshotSave(
    state: SnapshotState,
    snapshot: FinancialSnapshot,
    allowNegativeAssets = false,
    previousSnapshots: FinancialSnapshot[] = [],
): SnapshotRiskReport {
    const effectiveDate = snapshotDate(snapshot);
    const next = applySnapshotChanges(state, snapshot.changes);
    const messages = riskMessages(next);
    const previous = getPreviousSnapshot(previousSnapshots, effectiveDate);
    const confirmed = allowNegativeAssets || snapshot.confirmedNegativeAssets === true;
    return {
        blocked: messages.length > 0 && !confirmed,
        requiresConfirmation: messages.length > 0 && !confirmed,
        negativeMonths: messages.length ? [effectiveDate] : [],
        minimumCashAssets: next.cashAssets,
        minimumAvailableAssets: next.cashAssets + next.investmentAssets - next.committedDownPayments,
        comparedWith: previous,
        messages,
    };
}

export function confirmSnapshotSave(
    state: SnapshotState,
    snapshot: FinancialSnapshot,
    confirmed: boolean,
    previousSnapshots: FinancialSnapshot[] = [],
): SnapshotRiskReport {
    return validateSnapshotSave(state, { ...snapshot, confirmedNegativeAssets: confirmed }, confirmed, previousSnapshots);
}
