/**
 * detail 收入主区契约：税前 / 五险一金和个税 / 到手收入；明细进合并面板
 * 退休「社保基数+城市快捷」经一级入口进二级弹窗，不回流主卡/退休外层
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INCOME_DETAIL_DEDUCTION_PANEL_TITLE,
  INCOME_DETAIL_MAIN_LABELS,
  INCOME_DETAIL_PANEL_ITEMS,
  INCOME_DETAIL_SOCIAL_SETTINGS_ENTRY,
  INCOME_DETAIL_SOCIAL_SETTINGS_PANEL_TITLE,
  INCOME_DETAIL_TAX_DETAIL_ENTRY,
  INCOME_DETAIL_TAX_DETAIL_PANEL_TITLE,
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
    assert.ok(panel.includes('社保设置'));
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

  // 二级：退休规划社保基数；与收入区五险基数独立；入口文案=面板标题
  it('社保设置入口进二级，含基数与城市快捷', () => {
    assert.equal(INCOME_DETAIL_SOCIAL_SETTINGS_ENTRY, '社保设置');
    assert.equal(INCOME_DETAIL_SOCIAL_SETTINGS_PANEL_TITLE, '社保设置');
    assert.deepEqual([...INCOME_DETAIL_PANEL_ITEMS.socialSettings], ['社保基数', '城市快捷']);
    assert.ok(INCOME_DETAIL_PANEL_ITEMS.social.includes(INCOME_DETAIL_SOCIAL_SETTINGS_ENTRY));
  });

  // 二级：预估个税旁「查看明细」→ 分档税额 + 税率表
  it('个税明细入口进二级，含分档税额与税率表', () => {
    assert.equal(INCOME_DETAIL_TAX_DETAIL_ENTRY, '查看明细');
    assert.equal(INCOME_DETAIL_TAX_DETAIL_PANEL_TITLE, '个税明细');
    assert.ok(INCOME_DETAIL_PANEL_ITEMS.tax.includes('预估个税查看明细'));
    assert.deepEqual([...INCOME_DETAIL_PANEL_ITEMS.taxDetail], ['各区间实际税额', '税率区间表']);
  });
});
