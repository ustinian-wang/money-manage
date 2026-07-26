/**
 * detail 收入主区契约：税前 / 五险一金和个税 / 到手收入；明细进合并面板
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INCOME_DETAIL_DEDUCTION_PANEL_TITLE,
  INCOME_DETAIL_MAIN_LABELS,
  INCOME_DETAIL_PANEL_ITEMS,
  isIncomeDetailMainOnlyLabel,
} from './incomeDetailLayout.ts';

describe('incomeDetailLayout detail 主区契约', () => {
  it('主区恰好三类且顺序固定', () => {
    assert.deepEqual([...INCOME_DETAIL_MAIN_LABELS], ['税前工资', '五险一金和个税', '到手收入']);
  });

  it('基数 / 专项等在面板清单，主区标签不回流', () => {
    const panel = [...INCOME_DETAIL_PANEL_ITEMS.social, ...INCOME_DETAIL_PANEL_ITEMS.tax];
    assert.ok(panel.includes('五险基数'));
    assert.ok(panel.includes('公积金基数'));
    assert.ok(panel.includes('专项附加扣除勾选'));
    assert.equal(panel.includes('可支配收入'), false);
    for (const label of INCOME_DETAIL_MAIN_LABELS) {
      assert.equal(panel.includes(label), false);
      assert.equal(isIncomeDetailMainOnlyLabel(label), true);
    }
    assert.equal(isIncomeDetailMainOnlyLabel('五险基数'), false);
  });

  it('合并面板标题清晰可辨', () => {
    assert.equal(INCOME_DETAIL_DEDUCTION_PANEL_TITLE, '五险一金和个税');
  });
});
