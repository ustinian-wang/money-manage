/**
 * claimSummaryFromDraft：鉴权页认领摘要不依赖主页算式
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { claimSnapshotFromDraft } from './claimSummaryFromDraft';
import { LIGHT_DEMO_ASSETS } from '../demoDefaults';

describe('claimSnapshotFromDraft', () => {
  it('无草稿时回落轻演示资产与支出名', () => {
    const snap = claimSnapshotFromDraft(null);
    assert.equal(snap.totalAssets, LIGHT_DEMO_ASSETS.totalAssets);
    assert.ok(snap.expenseNames.includes('房租'));
    assert.ok(snap.expenseMonthlyApprox > 0);
  });

  it('有草稿时读 takeHome / 资产 / 固定支出', () => {
    const snap = claimSnapshotFromDraft({
      takeHomeIncome: 9000,
      totalAssets: 120000,
      expenses: [
        { name: '房租', mode: 'fixed', amount: 3000 },
        { name: '车贷', mode: 'installment', amount: 2000 },
      ],
    });
    assert.equal(snap.takeHomeOrNet, 9000);
    assert.equal(snap.totalAssets, 120000);
    assert.deepEqual(snap.expenseNames, ['房租', '车贷']);
    // installment 不计入月固定近似
    assert.equal(snap.expenseMonthlyApprox, 3000);
  });
});
