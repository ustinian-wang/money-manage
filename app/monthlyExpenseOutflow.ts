/**
 * 按自然月汇总「当月应从资产扣除」的支出
 * - 固定/比例：生效月扣除
 * - 一次性：发生月扣除
 * - 分期：开始月只扣首付；次月起扣当月月供
 */
import { calendarMonthsBetween, installmentPaymentAtPeriod, type PageRepaymentMode } from './installmentPayment';
import { defaultOneTimeDate, isActiveInMonth, monthKey, todayDateKey } from './expenseSpan';

export type OutflowExpense = {
  mode: 'fixed' | 'percentage' | 'installment' | 'one_time';
  amount: number;
  rate?: number;
  total?: number;
  downPayment?: number;
  term?: number;
  interest?: number;
  repaymentMode?: PageRepaymentMode;
  startDate?: string;
  endDate?: string;
  followRetirement?: boolean;
};

export type ExpenseOutflowInput = {
  expenses: OutflowExpense[];
  /** YYYY-MM */
  yearMonth: string;
  /** 用于分期期数定位的日期（通常取该月 1 号） */
  dateKey: string;
  net: number;
  investmentIncome: number;
  retirementDate?: string;
  /** 分期无 startDate 时的锚点（通常今天） */
  anchorDate?: string;
};

/** 分期开始月是否等于 yearMonth */
export function isInstallmentStartMonth(expense: OutflowExpense, yearMonth: string, anchorDate: string): boolean {
  const start = monthKey(expense.startDate || anchorDate);
  return start === yearMonth.slice(0, 7);
}

/**
 * 单笔分期当月扣款：
 * - 开始月：只扣首付
 * - 次月起：扣第 1、2、… 期月供（开始月不算第 1 期）
 */
export function installmentOutflowInMonth(
  expense: OutflowExpense,
  dateKey: string,
  yearMonth: string,
  anchorDate: string,
): number {
  if (isInstallmentStartMonth(expense, yearMonth, anchorDate)) {
    return Math.max(0, expense.downPayment || 0);
  }
  const start = (expense.startDate || anchorDate).slice(0, 10);
  const asOf = dateKey.slice(0, 10);
  if (asOf <= start) return 0;
  // 开始月的下一月 = 第 1 期（calendarMonthsBetween 同月为 0，次月为 1）
  const period = calendarMonthsBetween(start, asOf);
  return installmentPaymentAtPeriod(expense, period);
}

/** 指定自然月应从资产扣除的支出合计 */
export function expenseOutflowInMonth(input: ExpenseOutflowInput): number {
  const ym = input.yearMonth.slice(0, 7);
  const anchor = (input.anchorDate || todayDateKey()).slice(0, 10);
  const dateKey = input.dateKey.slice(0, 10);
  const retirementOpts = { retirementDate: input.retirementDate };

  let sum = 0;
  for (const expense of input.expenses) {
    if (expense.mode === 'installment') {
      sum += installmentOutflowInMonth(expense, dateKey, ym, anchor);
      continue;
    }
    if (expense.mode === 'one_time') {
      const startMonth = monthKey(expense.startDate || defaultOneTimeDate());
      if (startMonth === ym) sum += Math.max(0, expense.amount || 0);
      continue;
    }
    if (!isActiveInMonth({ ...expense, id: 'x' }, ym, retirementOpts)) continue;
    if (expense.mode === 'fixed') {
      sum += Math.max(0, expense.amount || 0);
      continue;
    }
    if (expense.mode === 'percentage') {
      sum += Math.max(0, (input.net + input.investmentIncome) * (expense.rate || 0) / 100);
    }
  }
  return sum;
}
