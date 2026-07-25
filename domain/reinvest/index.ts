/**
 * 闲钱投资（内部仍用 reinvest* 字段）：百分比（结余×%）或固定月额。
 * 旧画像仅有 reinvestRate → 一律视为 percent（历史 UI 为「比例」/%）。
 */

export type ReinvestMode = 'percent' | 'amount';

export type ReinvestSetting = {
  mode: ReinvestMode;
  /** 百分比模式：结余的 %，0–100 */
  rate: number;
  /** 金额模式：每月固定投入（元） */
  amount: number;
};

export const DEFAULT_REINVEST: ReinvestSetting = { mode: 'percent', rate: 30, amount: 0 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

/** 从 profile / 访客草稿解析；缺 mode 时旧数值 → percent */
export function parseReinvestSetting(data: Record<string, unknown>): ReinvestSetting {
  const rate = data.reinvestRate !== undefined && Number.isFinite(Number(data.reinvestRate))
    ? clamp(Number(data.reinvestRate), 0, 100)
    : DEFAULT_REINVEST.rate;
  const amount = data.reinvestAmount !== undefined && Number.isFinite(Number(data.reinvestAmount))
    ? Math.max(0, Number(data.reinvestAmount))
    : 0;
  if (data.reinvestMode === 'amount' || data.reinvestMode === 'percent') {
    return { mode: data.reinvestMode, rate, amount };
  }
  // 兼容：仅有旧 reinvestRate → 百分比
  return { mode: 'percent', rate, amount };
}

/** 本期结余按模式算出投入额（不超过结余） */
export function reinvestFromSurplus(surplus: number, setting: ReinvestSetting): number {
  const s = Math.max(0, Number.isFinite(surplus) ? surplus : 0);
  if (s <= 0) return 0;
  if (setting.mode === 'amount') {
    return Math.min(s, Math.max(0, setting.amount));
  }
  return s * clamp(setting.rate, 0, 100) / 100;
}

/** 年结余：金额模式按月额×12 再封顶 */
export function reinvestFromAnnualSurplus(annualSurplus: number, setting: ReinvestSetting): number {
  const s = Math.max(0, Number.isFinite(annualSurplus) ? annualSurplus : 0);
  if (s <= 0) return 0;
  if (setting.mode === 'amount') {
    return Math.min(s, Math.max(0, setting.amount) * 12);
  }
  return s * clamp(setting.rate, 0, 100) / 100;
}

/**
 * 图表拆层用等效 %：金额模式 = min(100, 月额/结余×100)；
 * 结余≤0 时金额模式返回 0。
 */
export function effectiveInvestRate(surplus: number, setting: ReinvestSetting): number {
  if (setting.mode === 'percent') return clamp(setting.rate, 0, 100);
  const s = Math.max(0, Number.isFinite(surplus) ? surplus : 0);
  if (s <= 0) return 0;
  return clamp((Math.max(0, setting.amount) / s) * 100, 0, 100);
}

/**
 * 切换模式：保留两套字段；%→金额用当前结余×% 作初值；
 * 金额→% 用 金额/结余 推比例（结余≤0 则保留原 rate）。
 */
export function switchReinvestMode(
  setting: ReinvestSetting,
  nextMode: ReinvestMode,
  monthlySurplus: number,
): ReinvestSetting {
  if (setting.mode === nextMode) return setting;
  if (nextMode === 'amount') {
    const amount = Math.round(reinvestFromSurplus(monthlySurplus, { ...setting, mode: 'percent' }));
    return { ...setting, mode: 'amount', amount };
  }
  const s = Math.max(0, monthlySurplus);
  const rate = s > 0
    ? clamp(Math.round((Math.max(0, setting.amount) / s) * 100), 0, 100)
    : setting.rate;
  return { ...setting, mode: 'percent', rate };
}

/** 落盘字段（与 profile 扁平结构一致） */
export function reinvestToProfile(setting: ReinvestSetting): {
  reinvestMode: ReinvestMode;
  reinvestRate: number;
  reinvestAmount: number;
} {
  return {
    reinvestMode: setting.mode,
    reinvestRate: clamp(setting.rate, 0, 100),
    reinvestAmount: Math.max(0, setting.amount),
  };
}
