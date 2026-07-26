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
  emergencyReserve?: number;
};

export type MonthlyAssetRow = {
  month: number;
  cash: number;
  investment: number;
  total: number;
  available: number;
};

/**
 * Project assets from operating cash flow and investment growth.
 * Investment return stays in the investment balance and is never counted again as cash income.
 */
export function buildMonthlyAssetForecast(input: AssetForecastInput): MonthlyAssetRow[] {
  const months = Math.max(0, Math.floor(input.months));
  const annualRate = Math.max(-100, Number.isFinite(input.annualReturnRate) ? input.annualReturnRate : 0);
  const monthlyReturn = (1 + annualRate / 100) ** (1 / 12) - 1;
  const recurringSurplus = input.disposableIncomeMonthly - input.recurringExpenseMonthly;
  const committed = Math.max(0, input.committedDownPayments ?? 0);
  const reserve = Math.max(0, input.emergencyReserve ?? 0);
  let cash = input.cash;
  let investment = Math.max(0, input.investment);
  const rows: MonthlyAssetRow[] = [];

  for (let month = 0; month <= months; month += 1) {
    if (month > 0) {
      const operatingSurplus = recurringSurplus - (month === 1 ? input.oneTimeExpense : 0);
      const reinvestment = reinvestFromSurplus(Math.max(0, operatingSurplus), input.reinvest);
      investment += investment * monthlyReturn + reinvestment;
      cash += operatingSurplus - reinvestment;
    }
    const total = cash + investment;
    rows.push({
      month,
      cash,
      investment,
      total,
      available: Math.max(0, total - committed - reserve),
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
