/**
 * 数值输入 UX 口径：
 * - free：自由金额/普通数字 → 不设上界、不展示滚动条；Editable 原地 inline
 * - rangedPercent：有明确范围且与百分比联动 → 可出滚动条，按 [min,max] clamp；走 FloatPanel
 *
 * 非百分比但有业务上界（如应急月数）可传 max 且 kind 仍为 free：有 clamp、无滚动条、仍 inline。
 */

export type NumberFieldKind = 'free' | 'rangedPercent';

/** 仅 rangedPercent 展示 range/slider 滚动条 */
export function showsNumberSlider(kind: NumberFieldKind = 'free'): boolean {
  return kind === 'rangedPercent';
}

/** 简单数值：原地 input；需 slider 的 rangedPercent 仍弹层 */
export function usesInlineNumberEdit(kind: NumberFieldKind = 'free'): boolean {
  return !showsNumberSlider(kind);
}

/**
 * 有 max 则双边 clamp（含 free 的业务上界）；无 max 只保下限。
 * kind 不影响 clamp，只驱动 showsNumberSlider。
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
