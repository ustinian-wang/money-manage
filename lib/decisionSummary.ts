/**
 * 首屏决策摘要：月可花 / 月支出 / 月结余 / 总资产
 * 需求：2026-07-26 多视角评估 — 首屏紧凑结论
 */

export type DecisionSummaryInput = {
  /** 月可花 = 可支配收入 net */
  monthlySpendable: number;
  monthlyExpense: number;
  monthlySurplus: number;
  totalAssets: number;
};

export type DecisionSummary = {
  monthlySpendable: number;
  monthlyExpense: number;
  monthlySurplus: number;
  totalAssets: number;
  /** 结余为负时一行风险提示；否则 null */
  riskLine: string | null;
};

const safeNum = (value: number) => (Number.isFinite(value) ? value : 0);

/** 组装摘要四指标；结余为负时附风险文案 */
export function buildDecisionSummary(input: DecisionSummaryInput): DecisionSummary {
  const monthlySpendable = Math.max(0, safeNum(input.monthlySpendable));
  const monthlyExpense = Math.max(0, safeNum(input.monthlyExpense));
  const monthlySurplus = safeNum(input.monthlySurplus);
  const totalAssets = Math.max(0, safeNum(input.totalAssets));
  const riskLine = monthlySurplus < 0
    ? '本月结余为负：支出已超过可花收入，入不敷出'
    : null;
  return { monthlySpendable, monthlyExpense, monthlySurplus, totalAssets, riskLine };
}
