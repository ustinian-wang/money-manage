/**
 * 首访轻演示默认：支出仅房租/餐饮，资产 8 万
 * 需求：first-visit-audit P1-2
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LIGHT_DEMO_ASSETS,
  LIGHT_DEMO_EXPENSES,
  lightDemoMonthlyExpenseTotal,
} from './demoDefaults';

describe('LIGHT_DEMO 轻示例', () => {
  it('仅两笔固定支出且无分期/赡养', () => {
    assert.equal(LIGHT_DEMO_EXPENSES.length, 2);
    assert.deepEqual(
      LIGHT_DEMO_EXPENSES.map((e) => e.name),
      ['房租', '餐饮'],
    );
    assert.ok(LIGHT_DEMO_EXPENSES.every((e) => e.mode === 'fixed'));
    assert.equal(lightDemoMonthlyExpenseTotal(), 4600);
  });

  it('总资产 8 万且现金+理财恒等', () => {
    assert.equal(LIGHT_DEMO_ASSETS.totalAssets, 80000);
    assert.equal(LIGHT_DEMO_ASSETS.cash + LIGHT_DEMO_ASSETS.invest, LIGHT_DEMO_ASSETS.totalAssets);
  });
});
