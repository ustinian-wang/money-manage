/**
 * 现金流比率：DTI / 支出率 / 储蓄率（相对可支配收入+理财月收益）
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { cashFlowRatios, remainDisposableSharePct, roundPct } from './cashFlowRatios.ts';

test('无分期时 DTI 为 0，支出率与储蓄率互补约 100%', () => {
  const r = cashFlowRatios({ debt: 0, otherExpenses: 4000, income: 10000 });
  assert.equal(r.dtiPct, 0);
  assert.equal(r.expensePct, 40);
  assert.equal(r.savingsPct, 60);
  assert.equal(roundPct(r.expensePct + r.savingsPct), 100);
});

test('分期抬高 DTI 与支出率、压低储蓄率', () => {
  const before = cashFlowRatios({ debt: 0, otherExpenses: 4000, income: 10000 });
  const after = cashFlowRatios({ debt: 2000, otherExpenses: 4000, income: 10000 });
  assert.equal(after.dtiPct, 20);
  assert.ok(after.expensePct > before.expensePct);
  assert.ok(after.savingsPct < before.savingsPct);
});

test('月供下降后储蓄率上升（模拟等额本金/期满）', () => {
  const highDebt = cashFlowRatios({ debt: 3000, otherExpenses: 5000, income: 10000 });
  const lowDebt = cashFlowRatios({ debt: 1000, otherExpenses: 5000, income: 10000 });
  assert.ok(lowDebt.dtiPct < highDebt.dtiPct);
  assert.ok(lowDebt.savingsPct > highDebt.savingsPct);
});

// 剩余可支配 = 100 − 支出占比；超支允许为负（与占比图压力走势一致）
test('剩余可支配占比 = 100 − 支出占比，超支可为负', () => {
  assert.equal(remainDisposableSharePct(40), 60);
  assert.equal(remainDisposableSharePct(120), -20);
  const withDebt = cashFlowRatios({ debt: 3000, otherExpenses: 5000, income: 10000 });
  const noDebt = cashFlowRatios({ debt: 0, otherExpenses: 5000, income: 10000 });
  assert.ok(remainDisposableSharePct(noDebt.expensePct) > remainDisposableSharePct(withDebt.expensePct));
});
