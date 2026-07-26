/**
 * 软数字输入：聚焦编辑允许空串；空视同 0；非法不 live 改父状态。
 * blur：空 → 0；非法 → 恢复 fallback（编辑前原值）；合法数原样返回。
 * 解决受控 type=number + Number('')===0 导致「0 删不掉」。
 */

/** 输入过程：空 → 0（视同）；非法 → null（不改父状态，保留 draft） */
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
