/** 页面分期月供口径（与健康分 DTI / 健康曲线共用） */
export type PageRepaymentMode = 'equal_principal_interest' | 'equal_principal';

export type PageInstallmentInput = {
  total?: number;
  downPayment?: number;
  term?: number;
  interest?: number;
  repaymentMode?: PageRepaymentMode;
  startDate?: string;
  endDate?: string;
};

export function installmentTermMonths(expense: PageInstallmentInput): number {
  const maxByDate = expense.endDate && expense.startDate
    ? Math.max(1, Math.round((new Date(`${expense.endDate}T00:00:00`).getTime() - new Date(`${expense.startDate}T00:00:00`).getTime()) / (30.4375 * 86400000)) + 1)
    : 360;
  return Math.min(Math.max(1, expense.term || 1), maxByDate);
}

/** 日历月差（按年月），同月为 0 */
export function calendarMonthsBetween(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate.slice(0, 10)}T00:00:00`);
  const to = new Date(`${toDate.slice(0, 10)}T00:00:00`);
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/**
 * 第 period 期月供（1-based）。超出期数返回 0。
 * 等额本息固定；等额本金随剩余本金递减。
 */
export function installmentPaymentAtPeriod(expense: PageInstallmentInput, period: number): number {
  const principal = Math.max(0, (expense.total || 0) - (expense.downPayment || 0));
  const months = installmentTermMonths(expense);
  if (principal <= 0 || !Number.isInteger(period) || period < 1 || period > months) return 0;
  const monthlyRate = (expense.interest || 0) / 1200;
  const mode = expense.repaymentMode || 'equal_principal_interest';
  if (mode === 'equal_principal') {
    const principalPart = principal / months;
    const remaining = principal - principalPart * (period - 1);
    return principalPart + remaining * monthlyRate;
  }
  if (!monthlyRate) return principal / months;
  const factor = (1 + monthlyRate) ** months;
  return principal * monthlyRate * factor / (factor - 1);
}

/** 仪表盘当期：等额本息固定；等额本金取首月（压力最大） */
export function installmentMonthlyPayment(expense: PageInstallmentInput): number {
  return installmentPaymentAtPeriod(expense, 1);
}

/**
 * 预测日 `asOfDate` 的月供。无 startDate 时视为已从 `anchorDate`（通常今天）起贷。
 * 未开始 / 已还清 → 0。
 */
export function installmentPaymentAsOf(expense: PageInstallmentInput, asOfDate: string, anchorDate: string): number {
  const start = (expense.startDate || anchorDate).slice(0, 10);
  const asOf = asOfDate.slice(0, 10);
  if (asOf < start) return 0;
  const period = calendarMonthsBetween(start, asOf) + 1;
  return installmentPaymentAtPeriod(expense, period);
}

export function healthFromDebt(debt: number, net: number, investmentIncome: number, emergencyMonths: number): number {
  return Math.min(100, Math.max(0, Math.round(
    92 - debt / Math.max(1, net + investmentIncome) * 105 - Math.max(0, 4 - emergencyMonths) * 5,
  )));
}
