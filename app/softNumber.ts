/**
 * 软数字输入：聚焦编辑允许空串；空视同 0；blur/commit 时空或非法落成 0。
 * 解决受控 type=number + Number('')===0 导致「0 删不掉」。
 */

/** 输入过程：空 → 0（视同）；非法 → null（不改父状态，保留 draft） */
export function softNumberLive(raw: string): number | null {
  if (raw.trim() === '') return 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

/** blur / 确认：空或非法 → 0 */
export function softNumberCommit(raw: string): number {
  if (raw.trim() === '') return 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}
