/**
 * 「关心五险一金」(detail) 主区 / 面板字段契约
 * 主区只露三类：税前 → 五险一金和个税（合并）→ 到手收入；明细进同一 FloatPanel
 * 退休与社保规划在合并面板内直接展开，不回流财务参数主卡
 */

/** 主区可见行标签（顺序：税前 → 扣减合并项 → 到手） */
export const INCOME_DETAIL_MAIN_LABELS = ['税前工资', '五险一金和个税', '到手收入'] as const;

/** 五险一金 + 个税 合并 FloatPanel 标题 */
export const INCOME_DETAIL_DEDUCTION_PANEL_TITLE = '五险一金和个税';

/** 一级面板内直接展开的退休与社保设置入口 */
export const INCOME_DETAIL_SOCIAL_SETTINGS_ENTRY = '退休与社保';

/** 一级面板「本月预估个税」旁入口 → 二级个税明细（分档税额 + 税率表） */
export const INCOME_DETAIL_TAX_DETAIL_ENTRY = '查看明细';
export const INCOME_DETAIL_TAX_DETAIL_PANEL_TITLE = '个税明细';

/**
 * 已从主区迁入合并面板的项（契约锁定，防回流主卡）
 * social / tax 为面板内分区块，非两个独立主区入口
 * socialSettings：一级面板内展开的退休规划内容（规划基数与收入区五险基数独立）
 * taxDetail：二级面板（各区间实际税额 + 税率区间表）
 */
export const INCOME_DETAIL_PANEL_ITEMS = {
  social: ['五险基数', '公积金基数', '缴纳开关', '公积金比例', '负担占比', '险种明细表', '退休与社保'],
  socialSettings: ['关联计算', '出生日期', '身份', '参保开始日期', '计划缴费年限', '规划社保基数', '城市快捷', '预计退休'],
  tax: ['专项附加扣除勾选', '预估个税查看明细'],
  taxDetail: ['各区间实际税额', '税率区间表'],
} as const;

/** 主区标签不得出现在面板迁出清单中 */
export function isIncomeDetailMainOnlyLabel(label: string): boolean {
  return (INCOME_DETAIL_MAIN_LABELS as readonly string[]).includes(label);
}
