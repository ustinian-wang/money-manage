/**
 * 软数字输入：聚焦编辑允许空串；空视同 0；非法串不可解析。
 * UI 契约：change 只改 draft；blur 才 softNumberCommit + 提交父状态（摘要/图表联动）并落盘。
 * softNumberLive 仅作解析辅助（空→0 / 非法→null），页面不再用它在 change 时改父 state。
 */

/** 解析过程中的合法数：空 → 0（视同）；非法 → null */
export function softNumberLive(raw: string): number | null {
  if (raw.trim() === '') return 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

/**
 * blur / 确认。
 * @param fallback 非法输入时恢复的原值；缺省 0（兼容旧 SoftNumberInput 空/非法落 0）
 */
export function softNumberCommit(raw: string, fallback = 0): number {
  if (raw.trim() === '') return 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

/** 非空且无法解析为有限数 → 视为非法（应恢复原值） */
export function softNumberIsInvalid(raw: string): boolean {
  return raw.trim() !== '' && !Number.isFinite(Number(raw));
}
