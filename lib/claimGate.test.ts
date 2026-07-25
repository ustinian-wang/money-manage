/**
 * 注册认领闸门：摘要与清空画像
 * 需求：first-visit-audit P0-1
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildClaimSummaryLines,
  emptyClaimProfilePatch,
  parseClaimMode,
} from './claimGate';

describe('buildClaimSummaryLines', () => {
  it('列出到手、总资产与最多三笔支出名', () => {
    const lines = buildClaimSummaryLines({
      takeHomeOrNet: 12000,
      totalAssets: 80000,
      expenseNames: ['房租', '餐饮', '交通', '娱乐'],
      expenseMonthlyApprox: 4600,
    });
    assert.equal(lines.length, 3);
    assert.match(lines[0], /12,000/);
    assert.match(lines[1], /80,000/);
    assert.match(lines[2], /房租、餐饮、交通…/);
    assert.match(lines[2], /4,600/);
  });

  it('无支出时标明空', () => {
    const lines = buildClaimSummaryLines({
      takeHomeOrNet: 0,
      totalAssets: 0,
      expenseNames: [],
      expenseMonthlyApprox: 0,
    });
    assert.match(lines[2], /支出（空）/);
  });
});

describe('emptyClaimProfilePatch / parseClaimMode', () => {
  it('清空画像支出为空、资产为 0', () => {
    const patch = emptyClaimProfilePatch();
    assert.deepEqual(patch.expenses, []);
    assert.equal(patch.totalAssets, 0);
    assert.equal(patch.takeHomeIncome, 0);
  });

  it('仅 clear 为清空；其余 keep', () => {
    assert.equal(parseClaimMode('clear'), 'clear');
    assert.equal(parseClaimMode('keep'), 'keep');
    assert.equal(parseClaimMode(undefined), 'keep');
  });
});
