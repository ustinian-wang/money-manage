/**
 * 超支警告 markLine：按峰值稀疏档位，避免首月重度超支时 110/120/150 挤在 Y 轴底部
 */

/** 支出占比图候选档（含可支配 100%） */
export const EXPENSE_SHARE_WARN_Y_AXES = [100, 110, 120, 150] as const;

/** 剩余可支配图候选档（满额 / 打满 / 负区警告） */
export const REMAIN_SHARE_WARN_Y_AXES = [100, 0, -10, -20, -50] as const;

/**
 * 按支出占比峰值挑选要画的 Y 档。
 * 轻度超支保留细档；严重/极端超支省略挤成一团的中间档，只留可读锚点。
 */
export function pickExpenseShareWarnYAxes(peakPct: number): number[] {
  const peak = Number.isFinite(peakPct) ? peakPct : 100;
  if (peak <= 105) return [100];
  if (peak <= 115) return [100, 110];
  if (peak <= 135) return [100, 110, 120];
  if (peak <= 200) return [100, 110, 120, 150];
  // 严重超支：110/120 相对整轴过近，只留 100 + 150
  if (peak <= 400) return [100, 150];
  // 极端首月（如大额首付）：中间档无辨识度
  return [100];
}

/**
 * 按剩余可支配最低点挑选 Y 档。
 * 深度负区时省略 −10/−20，避免与 0/−50 挤在顶部。
 */
export function pickRemainShareWarnYAxes(minPct: number): number[] {
  const min = Number.isFinite(minPct) ? minPct : 0;
  if (min >= -5) return [100, 0];
  if (min >= -15) return [100, 0, -10];
  if (min >= -35) return [100, 0, -10, -20];
  if (min >= -80) return [100, 0, -10, -20, -50];
  if (min >= -200) return [100, 0, -50];
  return [100, 0];
}

/**
 * 逐月现金流建议线（DTI≤35% / 储蓄≥20%）：
 * 首月重度超支时轴跨过大，建议线挤在中下部无辨识度 → 省略。
 */
export function pickCashFlowGuideFlags(opts: {
  peakPct: number;
  troughPct: number;
}): { showDti: boolean; showSavings: boolean } {
  const peak = Number.isFinite(opts.peakPct) ? opts.peakPct : 100;
  const trough = Number.isFinite(opts.troughPct) ? opts.troughPct : 0;
  if (peak > 200 || trough < -100) return { showDti: false, showSavings: false };
  if (peak > 150 || trough < -50) return { showDti: true, showSavings: false };
  return { showDti: true, showSavings: true };
}
