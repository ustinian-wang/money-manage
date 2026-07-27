/**
 * 统一本月/持续支出聚合：摘要、剩余%、现金流共用
 */

import { installmentMonthlyPayment, type PageRepaymentMode } from './installmentPayment';
import { defaultOneTimeDate, monthKey, todayMonthKey } from './expenseSpan';

export type AggregateExpense = {
  id?: string;
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

export type MonthlyExpenseAggregate = {
  /** 持续月支出（不含 one_time） */
  recurring: number;
  /** 本月一次性合计 */
  oneTime: number;
  /** 本月总支出 = recurring + oneTime */
  monthly: number;
  /** 本月分期月供合计（计入 recurring） */
  debt: number;
};

/** 非分期的持续月支出（固定 + 比例） */
export function nonInstallmentRecurring(
  expenses: AggregateExpense[],
  net: number,
  investmentIncome: number,
): number {
  return expenses.reduce((sum, expense) => {
    if (expense.mode === 'one_time' || expense.mode === 'installment') return sum;
    if (expense.mode === 'fixed') return sum + expense.amount;
    if (expense.mode === 'percentage') return sum + (net + investmentIncome) * (expense.rate || 0) / 100;
    return sum;
  }, 0);
}

/** 持续月支出：不含 one_time（预测 month≥1 只用这笔） */
export function recurringMonthlyExpenses(
  expenses: AggregateExpense[],
  net: number,
  investmentIncome: number,
): number {
  return expenses.reduce((sum, expense) => {
    if (expense.mode === 'one_time') return sum;
    if (expense.mode === 'fixed') return sum + expense.amount;
    if (expense.mode === 'percentage') return sum + (net + investmentIncome) * (expense.rate || 0) / 100;
    return sum + installmentMonthlyPayment(expense);
  }, 0);
}

/** 一次性合计：默认计入 startDate 所在月（缺省=当前月） */
export function oneTimeTotal(expenses: AggregateExpense[], asOfMonth = todayMonthKey()) {
  const month = asOfMonth.slice(0, 7);
  return expenses.reduce((sum, expense) => {
    if (expense.mode !== 'one_time') return sum;
    const startMonth = monthKey(expense.startDate || defaultOneTimeDate());
    return startMonth === month ? sum + expense.amount : sum;
  }, 0);
}

/** 本月分期月供合计 */
export function installmentDebtTotal(expenses: AggregateExpense[]): number {
  return expenses
    .filter((expense) => expense.mode === 'installment')
    .reduce((sum, expense) => sum + installmentMonthlyPayment(expense), 0);
}

/** 统一聚合：与顶栏剩余% / 决策摘要同源 */
export function aggregateMonthlyExpenses(
  expenses: AggregateExpense[],
  net: number,
  investmentIncome: number,
  asOfMonth = todayMonthKey(),
): MonthlyExpenseAggregate {
  const recurring = recurringMonthlyExpenses(expenses, net, investmentIncome);
  const oneTime = oneTimeTotal(expenses, asOfMonth);
  const debt = installmentDebtTotal(expenses);
  return {
    recurring,
    oneTime,
    monthly: recurring + oneTime,
    debt,
  };
}
