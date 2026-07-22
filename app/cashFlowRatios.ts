/** 逐月现金流比率（百分比）：DTI / 支出率 / 储蓄率 */

export type CashFlowRatios = {
  dtiPct: number;
  expensePct: number;
  savingsPct: number;
};

/**
 * income = 可支配收入 + 理财月收益
 * otherExpenses = 非分期持续支出（+ 可选当月一次性）
 * debt = 当月分期月供合计
 */
export function cashFlowRatios(input: {
  debt: number;
  otherExpenses: number;
  income: number;
}): CashFlowRatios {
  const income = Math.max(1, input.income);
  const debt = Math.max(0, input.debt);
  const expenses = debt + Math.max(0, input.otherExpenses);
  const dtiPct = (debt / income) * 100;
  const expensePct = (expenses / income) * 100;
  const savingsPct = ((income - expenses) / income) * 100;
  return { dtiPct, expensePct, savingsPct };
}

export function roundPct(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
