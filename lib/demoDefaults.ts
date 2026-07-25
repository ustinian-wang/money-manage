/**
 * 首访轻量演示默认值（支出/资产）
 * 需求：first-visit-audit P1-2 — 示例过重 → 仅房租/餐饮、资产更小
 */

export type DemoExpenseSeed = {
  id: string;
  name: string;
  category: string;
  mode: 'fixed';
  amount: number;
};

/** 轻演示：房租 + 餐饮；无车贷/赡养 */
export const LIGHT_DEMO_EXPENSES: DemoExpenseSeed[] = [
  { id: 'rent', name: '房租', category: '居住', mode: 'fixed', amount: 2800 },
  { id: 'food', name: '餐饮', category: '生活', mode: 'fixed', amount: 1800 },
];

/** 轻演示资产：总 8 万（现金 5 万 + 理财 3 万） */
export const LIGHT_DEMO_ASSETS = {
  totalAssets: 80000,
  cash: 50000,
  invest: 30000,
  investRatio: 37.5,
} as const;

export function lightDemoMonthlyExpenseTotal(expenses = LIGHT_DEMO_EXPENSES): number {
  return expenses.reduce((sum, row) => sum + (row.amount || 0), 0);
}
