/**
 * 页面分期月供：等额本息固定、等额本金按期递减；供 DTI / 支出占比曲线使用
 * 含 hydrate 迁移：年误存为月（房贷 term=30）→ 写回 360
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calendarMonthsBetween,
  explainInstallmentPayment,
  installmentMonthlyPayment,
  installmentPaymentAsOf,
  installmentPaymentAtPeriod,
  installmentTermMonths,
  migrateInstallmentTerms,
  normalizeInstallmentTermMonths,
} from './installmentPayment';

// term≤40 且无息粗算月供>2万 → 视作年；否则按月（避免 36 期车贷被 ×12）
test('normalize：房贷误填 30 年 → 360 月', () => {
  assert.equal(normalizeInstallmentTermMonths(30, { total: 1.8e6, downPayment: 0 }), 360);
});

test('normalize：车贷 36 期本金 10.5 万仍按月', () => {
  assert.equal(normalizeInstallmentTermMonths(36, { total: 105000, downPayment: 0 }), 36);
});

// hydrate 写回：数据本身变成 360，不只是计算时偷偷 ×12
test('migrate：房贷 term=30 → 写回 360；车贷 36 不变', () => {
  const [mortgage, car] = migrateInstallmentTerms([
    { mode: 'installment', total: 1.8e6, downPayment: 0, term: 30 },
    { mode: 'installment', total: 105000, downPayment: 0, term: 36 },
  ]);
  assert.equal(mortgage.term, 360);
  assert.equal(car.term, 36);
});

test('migrate：同步拉长陈旧 endDate，避免 360 被裁成短期', () => {
  const [loan] = migrateInstallmentTerms([
    {
      mode: 'installment',
      total: 3e6,
      downPayment: 9e5,
      term: 30,
      startDate: '2026-07-01',
      endDate: '2029-06-01',
    },
  ]);
  assert.equal(loan.term, 360);
  assert.equal(loan.endDate?.slice(0, 7), '2056-06');
});

test('term=360 不被陈旧 endDate 截成 ~36 月', () => {
  const months = installmentTermMonths({
    total: 3e6,
    downPayment: 9e5,
    term: 360,
    startDate: '2026-07-01',
    endDate: '2029-06-01',
  });
  assert.equal(months, 360);
  const payment = installmentMonthlyPayment({
    total: 3e6,
    downPayment: 9e5,
    term: 360,
    interest: 3.5,
    repaymentMode: 'equal_principal_interest',
    startDate: '2026-07-01',
    endDate: '2029-06-01',
  });
  assert.ok(payment > 8000 && payment < 12000, `got ${payment}`);
});

test('房贷迁移后 term=360、约 3% 等额本息月供约 7–9 千', () => {
  const [loan] = migrateInstallmentTerms([
    { mode: 'installment', total: 1.8e6, downPayment: 0, term: 30, interest: 3, repaymentMode: 'equal_principal_interest' as const },
  ]);
  assert.equal(loan.term, 360);
  // 本金已按月存储后，installmentTermMonths 直接读 360
  assert.equal(installmentTermMonths(loan), 360);
  const payment = installmentMonthlyPayment(loan);
  assert.ok(payment > 7000 && payment < 9000, `got ${payment}`);
});

test('房贷 term=30 本金 180 万（未迁移残留）：normalize 双保险仍约 6k–8k 级', () => {
  const payment = installmentMonthlyPayment({
    total: 1.8e6, downPayment: 0, term: 30, interest: 3.5, repaymentMode: 'equal_principal_interest',
  });
  assert.equal(installmentTermMonths({ total: 1.8e6, term: 30 }), 360);
  assert.ok(payment > 6000 && payment < 10000, `got ${payment}`);
});

test('车贷 term=36 本金 10.5 万：仍按 36 月算', () => {
  assert.equal(installmentTermMonths({ total: 105000, term: 36 }), 36);
  const payment = installmentMonthlyPayment({
    total: 105000, downPayment: 0, term: 36, interest: 4.2, repaymentMode: 'equal_principal_interest',
  });
  // 约 3110/月量级，远小于按 36 年摊的几百元
  assert.ok(payment > 2500 && payment < 4000, `got ${payment}`);
});

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

// explain：代入字段后给出公式 + 步骤，monthly 与月供口径一致
test('explainInstallmentPayment 等额本息含月供与总利息步骤', () => {
  const loan = { total: 12000, downPayment: 0, term: 12, interest: 12, repaymentMode: 'equal_principal_interest' as const };
  const exp = explainInstallmentPayment(loan);
  assert.match(exp.formula, /等额本息/);
  assert.equal(exp.monthly, installmentMonthlyPayment(loan));
  assert.ok(exp.steps.some((s) => s.includes('本金 P')));
  assert.ok(exp.steps.some((s) => s.includes('月供 M')));
  assert.ok(exp.steps.some((s) => s.includes('总利息')));
});

test('explain：360 月展示为 30 年，不被 endDate 裁成 36', () => {
  const exp = explainInstallmentPayment({
    total: 3e6,
    downPayment: 9e5,
    term: 360,
    interest: 3.5,
    startDate: '2026-07-01',
    endDate: '2029-06-01',
  });
  assert.ok(exp.steps.some((s) => s.includes('360 月') && s.includes('30 年')));
  assert.ok(!exp.steps.some((s) => /有效 36/.test(s)));
  assert.ok(exp.monthly > 8000 && exp.monthly < 12000, `got ${exp.monthly}`);
});

test('explainInstallmentPayment 等额本金含首月与总利息', () => {
  const loan = { total: 12000, downPayment: 0, term: 12, interest: 12, repaymentMode: 'equal_principal' as const };
  const exp = explainInstallmentPayment(loan);
  assert.match(exp.formula, /等额本金/);
  assert.equal(exp.monthly, 1120);
  assert.ok(exp.steps.some((s) => s.includes('首月月供')));
  assert.ok(exp.steps.some((s) => s.includes('总利息')));
});
