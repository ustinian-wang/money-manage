/**
 * 页面分期月供：等额本息固定、等额本金按期递减；供 DTI / 健康曲线使用
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calendarMonthsBetween,
  healthFromDebt,
  installmentMonthlyPayment,
  installmentPaymentAsOf,
  installmentPaymentAtPeriod,
} from './installmentPayment.ts';

test('等额本息零利率等于本金均摊', () => {
  const payment = installmentMonthlyPayment({
    total: 12000, downPayment: 0, term: 12, interest: 0, repaymentMode: 'equal_principal_interest',
  });
  assert.equal(payment, 1000);
});

test('等额本金首月 = 本金/期数 + 首月利息', () => {
  const payment = installmentMonthlyPayment({
    total: 12000, downPayment: 0, term: 12, interest: 12, repaymentMode: 'equal_principal',
  });
  assert.equal(payment, 1120);
});

test('同条件等额本金首月高于等额本息（有息时）', () => {
  const base = { total: 105000, downPayment: 0, term: 36, interest: 4.2 };
  const equalPi = installmentMonthlyPayment({ ...base, repaymentMode: 'equal_principal_interest' });
  const equalP = installmentMonthlyPayment({ ...base, repaymentMode: 'equal_principal' });
  assert.ok(equalP > equalPi);
});

test('等额本金逐期递减且期满归零', () => {
  const loan = { total: 12000, downPayment: 0, term: 12, interest: 12, repaymentMode: 'equal_principal' as const };
  const p1 = installmentPaymentAtPeriod(loan, 1);
  const p6 = installmentPaymentAtPeriod(loan, 6);
  const p12 = installmentPaymentAtPeriod(loan, 12);
  assert.ok(p1 > p6 && p6 > p12);
  assert.equal(installmentPaymentAtPeriod(loan, 13), 0);
});

test('等额本息期内固定、期满归零', () => {
  const loan = { total: 12000, downPayment: 0, term: 12, interest: 12, repaymentMode: 'equal_principal_interest' as const };
  assert.equal(installmentPaymentAtPeriod(loan, 1), installmentPaymentAtPeriod(loan, 12));
  assert.equal(installmentPaymentAtPeriod(loan, 13), 0);
});

test('按日期：未开始为 0，起贷当月为第 1 期', () => {
  const loan = { total: 12000, downPayment: 0, term: 3, interest: 0, repaymentMode: 'equal_principal_interest' as const, startDate: '2026-03-01' };
  assert.equal(installmentPaymentAsOf(loan, '2026-02-15', '2026-01-01'), 0);
  assert.equal(installmentPaymentAsOf(loan, '2026-03-01', '2026-01-01'), 4000);
  assert.equal(installmentPaymentAsOf(loan, '2026-06-01', '2026-01-01'), 0);
  assert.equal(calendarMonthsBetween('2026-03-01', '2026-05-01'), 2);
});

test('分期月供下降会抬高健康分', () => {
  const withDebt = healthFromDebt(3000, 10000, 0, 6);
  const noDebt = healthFromDebt(0, 10000, 0, 6);
  assert.ok(noDebt > withDebt);
});
