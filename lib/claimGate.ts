/**
 * 注册认领闸门：摘要文案 + 清空示例画像
 * 需求：first-visit-audit P0-1 — 注册前二次确认 / 认领 vs 清空
 */

export type ClaimMode = 'keep' | 'clear';

export type ClaimSnapshot = {
  takeHomeOrNet: number;
  totalAssets: number;
  expenseNames: string[];
  expenseMonthlyApprox: number;
};

const money = (value: number) => `¥${Math.round(value).toLocaleString('zh-CN')}`;

/** 注册浮层展示的认领摘要行（短、可扫） */
export function buildClaimSummaryLines(snap: ClaimSnapshot): string[] {
  const names = snap.expenseNames.filter(Boolean);
  const expenseLine = names.length
    ? `支出 ${names.slice(0, 3).join('、')}${names.length > 3 ? '…' : ''}（约 ${money(snap.expenseMonthlyApprox)}/月）`
    : '支出（空）';
  return [
    `月可支配收入约 ${money(snap.takeHomeOrNet)}`,
    `总资产约 ${money(snap.totalAssets)}`,
    expenseLine,
  ];
}

/** 「清空示例后再注册」：最小空画像字段（页面再 apply） */
export function emptyClaimProfilePatch(): {
  salary: number;
  cash: number;
  emergencyMonths: number;
  totalAssets: number;
  invest: number;
  investRatio: number;
  expenses: [];
  takeHomeIncome: number;
  rentEnabled: boolean;
  elderlyEnabled: boolean;
} {
  return {
    salary: 0,
    cash: 0,
    emergencyMonths: 0,
    totalAssets: 0,
    invest: 0,
    investRatio: 0,
    expenses: [],
    takeHomeIncome: 0,
    rentEnabled: false,
    elderlyEnabled: false,
  };
}

export function parseClaimMode(value: unknown): ClaimMode {
  return value === 'clear' ? 'clear' : 'keep';
}
