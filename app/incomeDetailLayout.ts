/**
 * 「关心五险一金」(detail) 主区 / 面板字段契约
 * 主区只露三类：税前 → 五险一金和个税（合并）→ 到手收入；明细进同一 FloatPanel
 */

/** 主区可见行标签（顺序：税前 → 扣减合并项 → 到手） */
export const INCOME_DETAIL_MAIN_LABELS = ['税前工资', '五险一金和个税', '到手收入'] as const;

/** 五险一金 + 个税 合并 FloatPanel 标题 */
export const INCOME_DETAIL_DEDUCTION_PANEL_TITLE = '五险一金和个税';

/**
 * 已从主区迁入合并面板的项（契约锁定，防回流主卡）
 * social / tax 为面板内分区块，非两个独立主区入口
 */
export const INCOME_DETAIL_PANEL_ITEMS = {
  social: ['五险基数', '公积金基数', '缴纳开关', '公积金比例', '负担占比', '险种明细表'],
  tax: ['专项附加扣除勾选', '税率区间表'],
} as const;

/** 主区标签不得出现在面板迁出清单中 */
export function isIncomeDetailMainOnlyLabel(label: string): boolean {
  return (INCOME_DETAIL_MAIN_LABELS as readonly string[]).includes(label);
}
