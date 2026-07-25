/**
 * 收入视图：默认 takehome、两套独立存储、统一出口 resolveDisposableIncome
 * 需求：访客/缺字段默认只看到手；切换不丢另一套；结余/预测只吃出口
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_INCOME_VIEW_MODE,
  exportDisposableAfterEdits,
  parseIncomeViewMode,
  resolveDisposableIncome,
  seedTakeHomeIncome,
} from './index';

describe('DEFAULT / parseIncomeViewMode 默认只看到手', () => {
  it('常量默认为 takehome', () => {
    assert.equal(DEFAULT_INCOME_VIEW_MODE, 'takehome');
  });

  it('缺字段 / 未知 / takehome → takehome；仅显式 detail', () => {
    assert.equal(parseIncomeViewMode(undefined), 'takehome');
    assert.equal(parseIncomeViewMode(null), 'takehome');
    assert.equal(parseIncomeViewMode(''), 'takehome');
    assert.equal(parseIncomeViewMode('takehome'), 'takehome');
    assert.equal(parseIncomeViewMode('other'), 'takehome');
    assert.equal(parseIncomeViewMode('detail'), 'detail');
  });
});

describe('resolveDisposableIncome 统一出口', () => {
  it('detail 只用 detailNet，忽略 takeHome（两套独立）', () => {
    assert.equal(resolveDisposableIncome('detail', 9000, 12000), 12000);
    assert.equal(resolveDisposableIncome('detail', null, 12000), 12000);
  });

  it('takehome 只用 takeHome；缺省/非法为 0，不回退 detailNet', () => {
    assert.equal(resolveDisposableIncome('takehome', 8800, 12000), 8800);
    assert.equal(resolveDisposableIncome('takehome', 0, 12000), 0);
    assert.equal(resolveDisposableIncome('takehome', null, 12000), 0);
    assert.equal(resolveDisposableIncome('takehome', undefined, 12000), 0);
    assert.equal(resolveDisposableIncome('takehome', Number.NaN, 12000), 0);
  });

  it('负值钳为 0', () => {
    assert.equal(resolveDisposableIncome('takehome', -100, 5000), 0);
    assert.equal(resolveDisposableIncome('detail', null, -50), 0);
  });

  it('切换 mode 后出口跟当前方式；两套原值仍在', () => {
    const takeHome = 8000;
    const detailNet = 12000;
    assert.equal(resolveDisposableIncome('takehome', takeHome, detailNet), 8000);
    assert.equal(resolveDisposableIncome('detail', takeHome, detailNet), 12000);
    // 再切回简便，仍用原 takeHome
    assert.equal(resolveDisposableIncome('takehome', takeHome, detailNet), 8000);
  });
});

describe('seedTakeHomeIncome 只写简便套', () => {
  it('已有合法到手则保留；否则用详细净收入四舍五入播种', () => {
    assert.equal(seedTakeHomeIncome(7777, 12000.4), 7777);
    assert.equal(seedTakeHomeIncome(null, 12000.6), 12001);
    assert.equal(seedTakeHomeIncome(undefined, 9999.2), 9999);
  });

  it('负当前值钳 0；负详细净收入播种为 0', () => {
    assert.equal(seedTakeHomeIncome(-1, 5000), 0);
    assert.equal(seedTakeHomeIncome(null, -10), 0);
  });
});

describe('exportDisposableAfterEdits 各自编辑互不覆盖', () => {
  it('改详细净收入不影响 takeHome；takehome 出口仍用旧到手', () => {
    const after = exportDisposableAfterEdits({
      mode: 'takehome',
      detailNet: 10000,
      takeHome: 8000,
      nextDetailNet: 15000,
    });
    assert.equal(after.detailNet, 15000);
    assert.equal(after.takeHome, 8000);
    assert.equal(after.disposable, 8000);
  });

  it('改简便到手不影响 detailNet；detail 出口仍用旧详细净收入', () => {
    const after = exportDisposableAfterEdits({
      mode: 'detail',
      detailNet: 10000,
      takeHome: 8000,
      nextTakeHome: 6000,
    });
    assert.equal(after.detailNet, 10000);
    assert.equal(after.takeHome, 6000);
    assert.equal(after.disposable, 10000);
  });
});
