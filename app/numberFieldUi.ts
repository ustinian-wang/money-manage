/**
 * 数值输入 UX 口径：
 * - free / rangedPercent：一律原地 inline（点 → input → blur 保存），不为 slider 弹 FloatPanel
 * - rangedPercent：有明确 [min,max] 时 blur clamp；不再出滚动条浮层
 *
 * 非百分比但有业务上界（如应急月数）可传 max 且 kind 仍为 free：有 clamp、无滚动条、仍 inline。
 * 单位（%、个月、年等）一律外置，不拼进展示串、不进 input。
 *
 * 多字段 / select / 日期 / 城市快捷等仍走 FloatPanel（不在本模块）。
 */

export type NumberFieldKind = 'free' | 'rangedPercent';

/** 行内展示数值（不含单位） */
export function formatEditableNumber(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString('zh-CN') : value.toFixed(1);
}

/**
 * 曾用于 rangedPercent 浮层滚动条；产品改为「只改数值不弹窗」后恒为 false。
 * 保留函数供调用方/单测锁口径，避免再为 slider 开面板。
 */
export function showsNumberSlider(_kind: NumberFieldKind = 'free'): boolean {
  return false;
}

/** 简单数值（含原 rangedPercent）：一律原地 input，不弹层 */
export function usesInlineNumberEdit(_kind: NumberFieldKind = 'free'): boolean {
  return true;
}

/**
 * 有 max 则双边 clamp（含 free 的业务上界）；无 max 只保下限。
 * kind 不影响 clamp。
 */
export function clampNumberField(
  value: number,
  opts: { min?: number; max?: number } = {},
): number {
  const lo = opts.min ?? 0;
  const n = Number.isFinite(value) ? value : lo;
  if (opts.max == null) return Math.max(lo, n);
  return Math.min(opts.max, Math.max(lo, n));
}
