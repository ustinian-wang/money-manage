/**
 * 按月支出扣款（分期：首月仅首付，次月起月供）
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  expenseOutflowInMonth,
  installmentOutflowInMonth,
  isInstallmentStartMonth,
} from './monthlyExpenseOutflow';

describe('installmentOutflowInMonth', () => {
  const loan = {
    mode: 'installment' as const,
    amount: 0,
    total: 1_000_000,
    downPayment: 300_000,
    term: 360,
    interest: 0,
    startDate: '2026-07-01',
  };

  it('开始月：只扣首付，不含月供', () => {
    const out = installmentOutflowInMonth(loan, '2026-07-01', '2026-07', '2026-07-01');
    assert.equal(out, 300_000);
    assert.equal(isInstallmentStartMonth(loan, '2026-07', '2026-07-01'), true);
  });

  it('第二个月起：仅月供', () => {
    const monthly = (1_000_000 - 300_000) / 360;
    const out = installmentOutflowInMonth(loan, '2026-08-01', '2026-08', '2026-07-01');
    assert.ok(Math.abs(out - monthly) < 0.01);
  });

  it('开始前：0', () => {
    assert.equal(installmentOutflowInMonth(loan, '2026-06-01', '2026-06', '2026-07-01'), 0);
  });
});

describe('expenseOutflowInMonth', () => {
  it('汇总固定 + 一次性 + 分期首月仅首付', () => {
    const out = expenseOutflowInMonth({
      expenses: [
        { mode: 'fixed', amount: 5_000, startDate: '2026-01-01' },
        { mode: 'one_time', amount: 10_000, startDate: '2026-07-01' },
        {
          mode: 'installment',
          amount: 0,
          total: 100_000,
          downPayment: 20_000,
          term: 10,
          interest: 0,
          startDate: '2026-07-01',
        },
      ],
      yearMonth: '2026-07',
      dateKey: '2026-07-01',
      net: 20_000,
      investmentIncome: 0,
    });
    // 固定 5000 + 一次性 10000 + 首付 20000（首月无月供）
    assert.equal(out, 5_000 + 10_000 + 20_000);
  });
});
