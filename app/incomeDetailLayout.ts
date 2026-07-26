/**
 * 「关心五险一金」(detail) 主区 / 面板字段契约
 * 主区只露三类：税前 → 五险一金和个税（合并）→ 到手收入；明细进同一 FloatPanel
 * 退休规划「社保基数+城市快捷」经一级面板入口进二级 FloatPanel，不回流主卡/退休外层
 */

/** 主区可见行标签（顺序：税前 → 扣减合并项 → 到手） */
export const INCOME_DETAIL_MAIN_LABELS = ['税前工资', '五险一金和个税', '到手收入'] as const;

/** 五险一金 + 个税 合并 FloatPanel 标题 */
export const INCOME_DETAIL_DEDUCTION_PANEL_TITLE = '五险一金和个税';

/** 一级面板内「社保设置」入口 → 二级弹窗标题 */
export const INCOME_DETAIL_SOCIAL_SETTINGS_ENTRY = '社保设置';
export const INCOME_DETAIL_SOCIAL_SETTINGS_PANEL_TITLE = '社保设置';

/** 一级面板「本月预估个税」旁入口 → 二级个税明细（分档税额 + 税率表） */
export const INCOME_DETAIL_TAX_DETAIL_ENTRY = '查看明细';
export const INCOME_DETAIL_TAX_DETAIL_PANEL_TITLE = '个税明细';

/**
 * 已从主区迁入合并面板的项（契约锁定，防回流主卡）
 * social / tax 为面板内分区块，非两个独立主区入口
 * socialSettings：二级面板内容（退休规划基数，与收入区五险基数独立）
 * taxDetail：二级面板（各区间实际税额 + 税率区间表）
 */
export const INCOME_DETAIL_PANEL_ITEMS = {
  social: ['五险基数', '公积金基数', '缴纳开关', '公积金比例', '负担占比', '险种明细表', '社保设置'],
  socialSettings: ['社保基数', '城市快捷'],
  tax: ['专项附加扣除勾选', '预估个税查看明细'],
  taxDetail: ['各区间实际税额', '税率区间表'],
} as const;

/** 主区标签不得出现在面板迁出清单中 */
export function isIncomeDetailMainOnlyLabel(label: string): boolean {
  return (INCOME_DETAIL_MAIN_LABELS as readonly string[]).includes(label);
}
