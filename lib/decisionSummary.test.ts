/**
 * 首屏决策摘要：月可花 / 月支出 / 月结余 / 总资产
 * 需求：2026-07-26 多视角评估 P1→本轮 P0
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildDecisionSummary } from './decisionSummary';

describe('buildDecisionSummary', () => {
  it('组装四指标；结余≥0 无风险文案', () => {
    const s = buildDecisionSummary({
      monthlySpendable: 13535,
      monthlyExpense: 4600,
      monthlySurplus: 8935,
      totalAssets: 80000,
    });
    assert.equal(s.monthlySpendable, 13535);
    assert.equal(s.monthlyExpense, 4600);
    assert.equal(s.monthlySurplus, 8935);
    assert.equal(s.totalAssets, 80000);
    assert.equal(s.riskLine, null);
  });

  it('结余为负时给出一行风险文案', () => {
    const s = buildDecisionSummary({
      monthlySpendable: 8000,
      monthlyExpense: 10000,
      monthlySurplus: -2000,
      totalAssets: 50000,
    });
    assert.equal(s.monthlySurplus, -2000);
    assert.ok(s.riskLine);
    assert.match(s.riskLine!, /入不敷出|超支|结余为负/);
  });

  it('非法数字兜底为 0', () => {
    const s = buildDecisionSummary({
      monthlySpendable: Number.NaN,
      monthlyExpense: Number.POSITIVE_INFINITY,
      monthlySurplus: undefined as unknown as number,
      totalAssets: -1,
    });
    assert.equal(s.monthlySpendable, 0);
    assert.equal(s.monthlyExpense, 0);
    assert.equal(s.monthlySurplus, 0);
    assert.equal(s.totalAssets, 0);
    assert.equal(s.riskLine, null);
  });
});
