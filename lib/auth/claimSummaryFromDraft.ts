/**
 * 鉴权页认领摘要：从本机草稿或轻演示默认拼 ClaimSnapshot
 * 不依赖主页 computeFinanceResult（避免把整页算式拖进鉴权页）
 */
import { buildClaimSummaryLines, type ClaimSnapshot } from '../claimGate';
import { LIGHT_DEMO_ASSETS, LIGHT_DEMO_EXPENSES, lightDemoMonthlyExpenseTotal } from '../demoDefaults';
import { loadGuestDraft } from '../persistence/guestDraft';

type ExpenseLike = { name?: string; mode?: string; amount?: number };

function expenseMonthlyApprox(expenses: ExpenseLike[]): number {
  return expenses.reduce((sum, row) => {
    if (row.mode === 'one_time' || row.mode === 'installment') return sum;
    return sum + (Number(row.amount) || 0);
  }, 0);
}

/** 草稿 → 摘要快照；无草稿用轻演示 */
export function claimSnapshotFromDraft(raw: Record<string, unknown> | null): ClaimSnapshot {
  if (!raw || typeof raw !== 'object') {
    // 无草稿：轻演示资产/支出；到手字段首访未播种则为 0
    return {
      takeHomeOrNet: 0,
      totalAssets: LIGHT_DEMO_ASSETS.totalAssets,
      expenseNames: LIGHT_DEMO_EXPENSES.map((e) => e.name),
      expenseMonthlyApprox: lightDemoMonthlyExpenseTotal(),
    };
  }
  const expenses = Array.isArray(raw.expenses) ? (raw.expenses as ExpenseLike[]) : [];
  const takeHome = raw.takeHomeIncome != null && Number.isFinite(Number(raw.takeHomeIncome))
    ? Number(raw.takeHomeIncome)
    : 0;
  return {
    takeHomeOrNet: takeHome,
    totalAssets: Number(raw.totalAssets) || 0,
    expenseNames: expenses.map((e) => String(e.name || '')),
    expenseMonthlyApprox: expenseMonthlyApprox(expenses),
  };
}

export function claimSummaryLinesFromStorage(): string[] {
  // 鉴权页摘要只看访客草稿键
  return buildClaimSummaryLines(claimSnapshotFromDraft(loadGuestDraft()));
}
