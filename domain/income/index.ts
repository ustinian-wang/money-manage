/**
 * 收入视图：两套独立设置 + 统一出口「可支配收入」
 *
 * 详细（detail）字段：salary / socialEnabled / contributionBase / housingFundBase / 专项扣除等
 * 简便（takehome）字段：takeHomeIncome
 * 切换 mode 只改 incomeViewMode，两套数值互不覆盖。
 * 结余 / 闲钱投资 / 预测等只消费 resolveDisposableIncome(...) 出口。
 *
 * 默认方式：takehome（只看到手）；访客 / 缺字段 / 旧画像无该字段 → 一律 takehome。
 */

export type IncomeViewMode = 'detail' | 'takehome';

/** 访客、新建、缺省回填共用 */
export const DEFAULT_INCOME_VIEW_MODE: IncomeViewMode = 'takehome';

/**
 * 画像解析：仅显式 `detail` 为关心五险；缺省 / 未知 / takehome → 只看到手
 */
export function parseIncomeViewMode(value: unknown): IncomeViewMode {
  return value === 'detail' ? 'detail' : DEFAULT_INCOME_VIEW_MODE;
}

/**
 * 统一出口：可支配收入（净收入）
 * @param mode 当前选中方式
 * @param takeHome 简便套独立字段（仅 takehome 使用）
 * @param detailNet 详细套算完税前/五险/个税后的净收入（仅 detail 使用）
 *
 * takehome：只用 takeHome（非法/缺省 → 0），绝不回退 detailNet（两套解耦）
 * detail：只用 detailNet，忽略 takeHome
 */
export function resolveDisposableIncome(
  mode: IncomeViewMode,
  takeHome: number | null | undefined,
  detailNet: number,
): number {
  if (mode === 'takehome') {
    if (takeHome != null && Number.isFinite(takeHome)) return Math.max(0, Number(takeHome));
    return 0;
  }
  return Math.max(0, Number.isFinite(detailNet) ? detailNet : 0);
}

/**
 * 切到简便且尚未声明到手时：用「详细净收入」播种一次（只写 takeHome 套，不改详细套）
 * 已有合法 takeHome → 原样保留（切换不丢简便数据）
 * 注意：播种输入必须是 detailNet，不能是出口 net（takehome 下 net≠详细）
 */
export function seedTakeHomeIncome(
  current: number | null | undefined,
  detailNet: number,
): number {
  if (current != null && Number.isFinite(current)) return Math.max(0, Number(current));
  const net = Number.isFinite(detailNet) ? detailNet : 0;
  return Math.max(0, Math.round(net));
}

/**
 * 模拟「各自编辑只写自己那套」后的出口（单测锁互不覆盖）
 * detailEdits 只影响 detailNet；takeHomeEdit 只影响 takeHome
 */
export function exportDisposableAfterEdits(input: {
  mode: IncomeViewMode;
  detailNet: number;
  takeHome: number | null | undefined;
  nextDetailNet?: number;
  nextTakeHome?: number | null;
}): { detailNet: number; takeHome: number | null | undefined; disposable: number } {
  const detailNet = input.nextDetailNet !== undefined ? input.nextDetailNet : input.detailNet;
  const takeHome = input.nextTakeHome !== undefined ? input.nextTakeHome : input.takeHome;
  return {
    detailNet,
    takeHome,
    disposable: resolveDisposableIncome(input.mode, takeHome, detailNet),
  };
}
