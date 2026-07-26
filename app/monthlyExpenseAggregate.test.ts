/**
 * 本月/持续支出聚合：摘要「月支出」与剩余% / 现金流同源
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cashFlowRatios, remainDisposableSharePct } from './cashFlowRatios';
import {
  aggregateMonthlyExpenses,
  oneTimeTotal,
  recurringMonthlyExpenses,
} from './monthlyExpenseAggregate';
import { buildDecisionSummary } from '../lib/decisionSummary';
import { LIGHT_DEMO_EXPENSES, lightDemoMonthlyExpenseTotal } from '../lib/demoDefaults';

type Exp = Parameters<typeof aggregateMonthlyExpenses>[0][number];

describe('aggregateMonthlyExpenses', () => {
  it('轻演示：房租+餐饮合计 = 月支出，无一次性/分期', () => {
    const expenses = LIGHT_DEMO_EXPENSES.map((row) => ({ ...row })) as Exp[];
    const agg = aggregateMonthlyExpenses(expenses, 13535, 0);
    assert.equal(agg.monthly, lightDemoMonthlyExpenseTotal());
    assert.equal(agg.recurring, 4600);
    assert.equal(agg.oneTime, 0);
    assert.equal(agg.debt, 0);
  });

  it('本月一次性计入 monthly；次月 oneTimeTotal 为 0', () => {
    const expenses: Exp[] = [
      { id: 'a', mode: 'fixed', amount: 1000 },
      { id: 'b', mode: 'one_time', amount: 5000, startDate: '2026-07-01' },
    ];
    const jul = aggregateMonthlyExpenses(expenses, 10000, 0, '2026-07');
    assert.equal(jul.oneTime, 5000);
    assert.equal(jul.monthly, 6000);
    const aug = oneTimeTotal(expenses, '2026-08');
    assert.equal(aug, 0);
  });

  it('比例支出按 net+理财收益基数', () => {
    const expenses: Exp[] = [{ id: 'p', mode: 'percentage', amount: 0, rate: 10 }];
    assert.equal(recurringMonthlyExpenses(expenses, 10000, 2000), 1200);
  });
});

describe('支出口径契约：摘要月支出 ↔ 剩余可支配%', () => {
  it('同源 monthly 推算 remain% 与摘要一致（golden）', () => {
    const net = 10000;
    const investmentIncome = 0;
    const expenses: Exp[] = [
      { id: 'rent', mode: 'fixed', amount: 3000 },
      { id: 'food', mode: 'fixed', amount: 2000 },
      {
        id: 'loan',
        mode: 'installment',
        amount: 0,
        total: 120000,
        downPayment: 0,
        term: 60,
        interest: 0,
        repaymentMode: 'equal_principal_interest',
        startDate: '2026-01-01',
      },
    ];
    const agg = aggregateMonthlyExpenses(expenses, net, investmentIncome, '2026-07');
    const { expensePct } = cashFlowRatios({
      debt: agg.debt,
      otherExpenses: Math.max(0, agg.monthly - agg.debt),
      income: net,
    });
    const remainPct = remainDisposableSharePct(expensePct);
    const surplus = net + investmentIncome - agg.monthly;
    const summary = buildDecisionSummary({
      monthlySpendable: net,
      monthlyExpense: agg.monthly,
      monthlySurplus: surplus,
      totalAssets: 80000,
    });

    assert.equal(summary.monthlyExpense, agg.monthly);
    // 剩余% = 100 − 支出占可支配收入；与摘要月支出同源，不应自相矛盾
    const impliedExpensePct = (agg.monthly / Math.max(1, net)) * 100;
    assert.ok(Math.abs(expensePct - impliedExpensePct) < 0.05);
    assert.equal(remainPct, remainDisposableSharePct(impliedExpensePct));
    if (surplus < 0) {
      assert.ok(remainPct < 0 || summary.riskLine);
    }
  });
});
