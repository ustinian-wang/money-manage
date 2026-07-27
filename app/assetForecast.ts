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
   * 理财比例 0–100；若提供，每月结算后按「剩余总资产 × 比例」再平衡现金/理财
   * （应急水位优先：先保证 cash≥floor，再拆比例）
   */
  investRatio?: number;
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
   * 若同时提供 expenseOutflowAtMonth，则忽略本回调（改用收入−当月扣款）。
   */
  recurringSurplusAtMonth?: (month: number) => number;
  /**
   * 可选：按投影月覆盖年化收益率（%）；month ≥ 1。
   * 未提供则用固定 annualReturnRate。计划变更 annualReturn 用。
   */
  annualReturnRateAtMonth?: (month: number) => number;
  /**
   * 可选：按投影月覆盖可支配收入（到手）；与 expenseOutflowAtMonth 联用。
   */
  incomeAtMonth?: (month: number) => number;
  /**
   * 可选：按投影月覆盖「当月应从资产扣除」的支出合计（含分期首月首付、次月起月供等）。
   * 提供后不再使用 recurringExpenseMonthly / oneTimeExpense / committedDownPayments 占用口径。
   */
  expenseOutflowAtMonth?: (month: number) => number;
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

/** 按理财比例再平衡；优先满足 cash ≥ floor */
export function rebalanceByInvestRatio(
  cash: number,
  investment: number,
  investRatioPct: number,
  cashFloor: number,
): { cash: number; investment: number } {
  const total = cash + investment;
  const ratio = Math.min(100, Math.max(0, investRatioPct)) / 100;
  const floor = Math.max(0, cashFloor);
  if (total <= 0) return { cash: total, investment: 0 };
  if (total <= floor) return { cash: total, investment: 0 };
  let nextCash = total * (1 - ratio);
  let nextInvest = total - nextCash;
  if (nextCash < floor) {
    nextCash = floor;
    nextInvest = total - floor;
  }
  return { cash: nextCash, investment: nextInvest };
}

/**
 * Project assets from operating cash flow and investment growth.
 * Investment return stays in the investment balance and is never counted again as cash income.
 *
 * 恒等式：任意月 total === cash + investment（图表「最终=理财+闲置」；备用金=cash）。
 * 每月：结余/再投入后，若 cash < floor，从理财赎回 min(invest, floor−cash) 补备用金。
 * 若设 investRatio：再按剩余总资产 × 比例拆分现金/理财（仍优先 floor）。
 * 理财赎光仍不够时，才允许 cash < floor（含穿零），此时可出现 total < investment。
 */
export function buildMonthlyAssetForecast(input: AssetForecastInput): MonthlyAssetRow[] {
  const months = Math.max(0, Math.floor(input.months));
  const fixedAnnualRate = Math.max(-100, Number.isFinite(input.annualReturnRate) ? input.annualReturnRate : 0);
  const monthlyReturnFromAnnual = (annualPct: number) => (1 + annualPct / 100) ** (1 / 12) - 1;
  const fixedRecurringSurplus = input.disposableIncomeMonthly - input.recurringExpenseMonthly;
  const committed = Math.max(0, input.committedDownPayments ?? 0);
  const fixedReserve = Math.max(0, input.emergencyReserve ?? 0);
  const useOutflow = typeof input.expenseOutflowAtMonth === 'function';
  const hasRatio = Number.isFinite(input.investRatio);
  let cash = input.cash;
  let investment = Math.max(0, input.investment);
  const rows: MonthlyAssetRow[] = [];

  for (let month = 0; month <= months; month += 1) {
    if (month > 0) {
      const annualRate = input.annualReturnRateAtMonth
        ? Math.max(-100, Number(input.annualReturnRateAtMonth(month)) || 0)
        : fixedAnnualRate;
      const monthlyReturn = monthlyReturnFromAnnual(annualRate);

      let operatingSurplus: number;
      if (useOutflow) {
        const income = input.incomeAtMonth
          ? input.incomeAtMonth(month)
          : input.disposableIncomeMonthly;
        const outflow = input.expenseOutflowAtMonth!(month);
        operatingSurplus = income - outflow;
      } else if (input.recurringSurplusAtMonth) {
        operatingSurplus = input.recurringSurplusAtMonth(month) - (month === 1 ? input.oneTimeExpense : 0);
      } else {
        operatingSurplus = fixedRecurringSurplus - (month === 1 ? input.oneTimeExpense : 0);
      }

      investment += investment * monthlyReturn;
      if (hasRatio) {
        // 比例再平衡模式：结余先进现金，再按剩余总资产 × 比例拆分
        cash += operatingSurplus;
      } else {
        const reinvestment = reinvestFromSurplus(Math.max(0, operatingSurplus), input.reinvest);
        investment += reinvestment;
        cash += operatingSurplus - reinvestment;
      }

      const floor = resolveCashFloor(input, month, fixedReserve);
      if (cash < floor && investment > 0) {
        const redeem = Math.min(investment, floor - cash);
        investment -= redeem;
        cash += redeem;
      }
      if (hasRatio) {
        const next = rebalanceByInvestRatio(cash, investment, input.investRatio as number, floor);
        cash = next.cash;
        investment = next.investment;
      }
    }
    const floor = resolveCashFloor(input, month, fixedReserve);
    const total = cash + investment;
    // 真实按月扣款后不再用 committed 双重占用；旧路径仍减 committed
    const available = useOutflow
      ? Math.max(0, total - floor)
      : Math.max(0, total - committed - floor);
    rows.push({
      month,
      cash,
      investment,
      total,
      available,
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
