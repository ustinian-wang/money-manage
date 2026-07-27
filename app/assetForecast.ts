import { reinvestFromSurplus, type ReinvestSetting } from '../domain/reinvest';

export type AssetForecastInput = {
  cash: number;
  investment: number;
  annualReturnRate: number;
  disposableIncomeMonthly: number;
  recurringExpenseMonthly: number;
  oneTimeExpense: number;
  reinvest: ReinvestSetting;
  months: number;
  committedDownPayments?: number;
  /**
   * 最低备用金水位（元）= 生效现金目标（应急月数推算或直接填写）。
   * 缺省 0：仅保证 cash 不穿零（尽力从理财赎回）。
   */
  emergencyReserve?: number;
  /**
   * 可选：按投影月覆盖最低备用金水位；month ≥ 1。
   * 未提供则用固定 emergencyReserve。计划变更导致目标变化时使用。
   */
  emergencyReserveAtMonth?: (month: number) => number;
  /**
   * 可选：按投影月覆盖「可支配收入 − 持续支出」（不含一次性）。
   * month ≥ 1；未提供则用固定 disposableIncomeMonthly − recurringExpenseMonthly。
   * 计划变更等导致到手按月变化时使用。
   */
  recurringSurplusAtMonth?: (month: number) => number;
  /**
   * 可选：按投影月覆盖年化收益率（%）；month ≥ 1。
   * 未提供则用固定 annualReturnRate。计划变更 annualReturn 用。
   */
  annualReturnRateAtMonth?: (month: number) => number;
};

export type MonthlyAssetRow = {
  month: number;
  cash: number;
  investment: number;
  total: number;
  available: number;
};

export function assetAxisBounds(values: number[]): { min: number; max: number } {
  const finite = values.filter(Number.isFinite);
  const minValue = finite.length ? Math.min(0, ...finite) : 0;
  const maxValue = finite.length ? Math.max(0, ...finite) : 0;
  const interval = 100_000;
  return {
    min: Math.min(0, Math.floor(minValue / interval) * interval),
    max: Math.max(interval, Math.ceil(maxValue / interval) * interval),
  };
}

function resolveCashFloor(
  input: AssetForecastInput,
  month: number,
  fixedReserve: number,
): number {
  if (input.emergencyReserveAtMonth) {
    return Math.max(0, Number(input.emergencyReserveAtMonth(month)) || 0);
  }
  return fixedReserve;
}

/**
 * Project assets from operating cash flow and investment growth.
 * Investment return stays in the investment balance and is never counted again as cash income.
 *
 * 恒等式：任意月 total === cash + investment（图表「最终=理财+闲置」；备用金=cash）。
 * 每月：结余/再投入后，若 cash < floor，从理财赎回 min(invest, floor−cash) 补备用金。
 * 理财赎光仍不够时，才允许 cash < floor（含穿零），此时可出现 total < investment。
 */
export function buildMonthlyAssetForecast(input: AssetForecastInput): MonthlyAssetRow[] {
  const months = Math.max(0, Math.floor(input.months));
  const fixedAnnualRate = Math.max(-100, Number.isFinite(input.annualReturnRate) ? input.annualReturnRate : 0);
  const monthlyReturnFromAnnual = (annualPct: number) => (1 + annualPct / 100) ** (1 / 12) - 1;
  const fixedRecurringSurplus = input.disposableIncomeMonthly - input.recurringExpenseMonthly;
  const committed = Math.max(0, input.committedDownPayments ?? 0);
  const fixedReserve = Math.max(0, input.emergencyReserve ?? 0);
  let cash = input.cash;
  let investment = Math.max(0, input.investment);
  const rows: MonthlyAssetRow[] = [];

  for (let month = 0; month <= months; month += 1) {
    if (month > 0) {
      const recurringSurplus = input.recurringSurplusAtMonth
        ? input.recurringSurplusAtMonth(month)
        : fixedRecurringSurplus;
      const annualRate = input.annualReturnRateAtMonth
        ? Math.max(-100, Number(input.annualReturnRateAtMonth(month)) || 0)
        : fixedAnnualRate;
      const monthlyReturn = monthlyReturnFromAnnual(annualRate);
      const operatingSurplus = recurringSurplus - (month === 1 ? input.oneTimeExpense : 0);
      const reinvestment = reinvestFromSurplus(Math.max(0, operatingSurplus), input.reinvest);
      investment += investment * monthlyReturn + reinvestment;
      cash += operatingSurplus - reinvestment;
      // 保最低备用金：cash 不足则从理财赎回（尽力；理财不够则耗尽为止）
      const floor = resolveCashFloor(input, month, fixedReserve);
      if (cash < floor && investment > 0) {
        const redeem = Math.min(investment, floor - cash);
        investment -= redeem;
        cash += redeem;
      }
    }
    const floor = resolveCashFloor(input, month, fixedReserve);
    const total = cash + investment;
    rows.push({
      month,
      cash,
      investment,
      total,
      available: Math.max(0, total - committed - floor),
    });
  }

  return rows;
}

export function yearlyTotalsFromMonthly(
  input: Omit<AssetForecastInput, 'months'> & { years: number },
): Array<{ year: number; total: number }> {
  const years = Math.max(0, Math.floor(input.years));
  const monthly = buildMonthlyAssetForecast({ ...input, months: years * 12 });
  return Array.from({ length: years + 1 }, (_, year) => ({
    year,
    total: monthly[year * 12].total,
  }));
}
