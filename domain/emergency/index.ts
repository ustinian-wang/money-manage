/**
 * 资产配置 · 现金/备用金：
 * 备用金 = 现金资产（不是并列另一坨钱）。
 * mode=amount：直接填现金；mode=months：往年支出÷12 得月均 × 应急月数 → 现金，再联动理财。
 * 持久化：emergencyMode / emergencyMonths / emergencyAmount / emergencyAnnualSpend。
 */

export type EmergencyMode = 'months' | 'amount';

/** @deprecated 同 EmergencyMode；amount≈直接填现金，months≈按月算现金 */
export type CashInputMode = EmergencyMode;

export type EmergencySetting = {
  /**
   * 兼容旧画像。新语义下计算侧不再用开关扣「另一坨」准备金；
   * UI select「应急月数」≈ mode==='months'（enabled 仍落盘兼容）。
   */
  enabled: boolean;
  /** amount=直接填现金；months=按应急月数算现金 */
  mode: EmergencyMode;
  /** 应急月数（与现金双向同步，月均>0 时） */
  months: number;
  /** 落盘镜像现金；UI 以 cash 为准，勿与现金并列编辑 */
  amount: number;
  /** 往年支出总额（元/年）；应急月数模式时 ÷12 得规划月均 */
  annualSpend: number;
};

export const DEFAULT_EMERGENCY: EmergencySetting = {
  enabled: false,
  mode: 'amount',
  months: 0,
  amount: 0,
  annualSpend: 0,
};

const MAX_MONTHS = 36;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

/** 往年总额 ÷ 12 → 规划用每月支出（四舍五入到元） */
export function monthlyFromAnnual(annualSpend: number): number {
  const annual = Math.max(0, Number.isFinite(annualSpend) ? annualSpend : 0);
  return Math.round(annual / 12);
}

/** 本月支出 → 往年额度种子（×12） */
export function annualFromMonthly(monthly: number): number {
  return Math.round(Math.max(0, Number.isFinite(monthly) ? monthly : 0) * 12);
}

/**
 * 规划月均：有往年额度用 ÷12；否则回退账本「本月支出」（兼容未填往年时）。
 * ponytail: 不把账本支出写回 annualSpend，避免用户未确认就落盘
 */
export function resolvePlanMonthly(annualSpend: number, liveMonthly = 0): number {
  if (annualSpend > 0) return monthlyFromAnnual(annualSpend);
  return Math.max(0, Number.isFinite(liveMonthly) ? liveMonthly : 0);
}

/** 现金 ÷ 月支出 → 应急月数（0.5 步进，0–36） */
export function monthsFromCash(cash: number, monthlyExpenses: number): number {
  const expense = Math.max(0, Number.isFinite(monthlyExpenses) ? monthlyExpenses : 0);
  if (expense <= 0) return 0;
  const raw = Math.max(0, Number.isFinite(cash) ? cash : 0) / expense;
  return clamp(Math.round(raw * 2) / 2, 0, MAX_MONTHS);
}

/** 应急月数 × 月支出 → 目标现金 */
export function cashFromMonths(months: number, monthlyExpenses: number): number {
  const expense = Math.max(0, Number.isFinite(monthlyExpenses) ? monthlyExpenses : 0);
  const m = clamp(months, 0, MAX_MONTHS);
  return Math.round(m * expense);
}

/** 从 profile / 访客草稿解析；兼容仅有 emergencyMonths 的旧画像 */
export function parseEmergencySetting(data: Record<string, unknown>): EmergencySetting {
  const months = data.emergencyMonths !== undefined && Number.isFinite(Number(data.emergencyMonths))
    ? clamp(Number(data.emergencyMonths), 0, MAX_MONTHS)
    : DEFAULT_EMERGENCY.months;
  const amount = data.emergencyAmount !== undefined && Number.isFinite(Number(data.emergencyAmount))
    ? Math.max(0, Number(data.emergencyAmount))
    : 0;
  const annualSpend = data.emergencyAnnualSpend !== undefined && Number.isFinite(Number(data.emergencyAnnualSpend))
    ? Math.max(0, Number(data.emergencyAnnualSpend))
    : DEFAULT_EMERGENCY.annualSpend;
  const mode: EmergencyMode =
    data.emergencyMode === 'amount' || data.emergencyMode === 'months'
      ? data.emergencyMode
      : amount > 0 && months === 0
        ? 'amount'
        : months > 0
          ? 'months'
          : DEFAULT_EMERGENCY.mode;
  // 显式开关优先；旧画像无开关时：有月数或固定额则视为曾启用
  let enabled = DEFAULT_EMERGENCY.enabled;
  if (data.emergencyEnabled === true) enabled = true;
  else if (data.emergencyEnabled === false) enabled = false;
  else if (months > 0 || amount > 0) enabled = true;

  return { enabled, mode, months, amount, annualSpend };
}

/**
 * 应急准备金（元）= 现金资产（备用金即现金）。
 * setting / monthlyExpenses 保留签名兼容旧调用；第三参 cash 优先。
 */
export function emergencyReserve(
  setting: EmergencySetting,
  monthlyExpenses: number,
  cash?: number,
): number {
  if (cash !== undefined && Number.isFinite(cash)) return Math.max(0, cash);
  // 旧路径兜底：无 cash 时按 mode 估（迁移期）
  if (setting.mode === 'amount') return Math.max(0, setting.amount);
  const months = clamp(setting.months, 0, MAX_MONTHS);
  const expense = resolvePlanMonthly(setting.annualSpend, monthlyExpenses);
  return months * expense;
}

/** 改现金后：同步 months（月均>0）与 amount 镜像 */
export function syncSettingFromCash(
  setting: EmergencySetting,
  cash: number,
  monthlyExpenses: number,
): EmergencySetting {
  const safeCash = Math.max(0, Number.isFinite(cash) ? cash : 0);
  const expense = resolvePlanMonthly(setting.annualSpend, monthlyExpenses);
  return {
    ...setting,
    amount: safeCash,
    months: expense > 0 ? monthsFromCash(safeCash, expense) : setting.months,
  };
}

/**
 * 按应急月数得到目标现金（可再 clamp 到总资产），并写回 setting。
 * 理财侧由调用方走「现金+理财=总资产」联动。
 */
export function applyMonthsPlan(
  setting: EmergencySetting,
  months: number,
  monthlyExpenses: number,
  totalAssets: number,
): { setting: EmergencySetting; cash: number } {
  const nextMonths = clamp(months, 0, MAX_MONTHS);
  const expense = Math.max(0, monthlyExpenses);
  const target = expense > 0 ? cashFromMonths(nextMonths, expense) : Math.max(0, setting.amount);
  const total = Math.max(0, totalAssets);
  const cash = clamp(target, 0, total);
  // 若被总资产顶住，月数以实际现金反算，避免展示与现金脱节
  const syncedMonths = expense > 0 ? monthsFromCash(cash, expense) : nextMonths;
  return {
    cash,
    setting: {
      ...setting,
      mode: 'months',
      enabled: true,
      months: syncedMonths,
      amount: cash,
    },
  };
}

/**
 * 改往年支出：写 annualSpend，用 ÷12 月均 × 当前月数重算现金。
 */
export function applyAnnualSpendPlan(
  setting: EmergencySetting,
  annualSpend: number,
  totalAssets: number,
): { setting: EmergencySetting; cash: number } {
  const annual = Math.max(0, Number.isFinite(annualSpend) ? annualSpend : 0);
  const monthly = monthlyFromAnnual(annual);
  const base = { ...setting, annualSpend: annual, mode: 'months' as const, enabled: true };
  return applyMonthsPlan(base, setting.months, monthly, totalAssets);
}

/** 切录入方式：现金不变；切 months 时可带 annualSpend；切 amount 时 amount 镜像现金 */
export function switchEmergencyMode(
  setting: EmergencySetting,
  nextMode: EmergencyMode,
  monthlyExpenses: number,
  cash?: number,
): EmergencySetting {
  if (setting.mode === nextMode) return setting;
  const safeCash = cash !== undefined && Number.isFinite(cash)
    ? Math.max(0, cash)
    : Math.max(0, setting.amount);
  const planMonthly = resolvePlanMonthly(setting.annualSpend, monthlyExpenses);
  if (nextMode === 'amount') {
    return {
      ...setting,
      mode: 'amount',
      amount: safeCash,
      months: planMonthly > 0 ? monthsFromCash(safeCash, planMonthly) : setting.months,
    };
  }
  const months = planMonthly > 0
    ? monthsFromCash(safeCash, planMonthly)
    : setting.months;
  return { ...setting, mode: 'months', enabled: true, months, amount: safeCash };
}

/** 切到「应急月数」：缺往年额度时用本月支出×12 播种；月数用现金反算（现金先不变） */
export function enableMonthsPlan(
  setting: EmergencySetting,
  liveMonthly: number,
  cash: number,
): EmergencySetting {
  const annual = setting.annualSpend > 0
    ? setting.annualSpend
    : annualFromMonthly(liveMonthly);
  const monthly = resolvePlanMonthly(annual, liveMonthly);
  const safeCash = Math.max(0, cash);
  return {
    ...setting,
    mode: 'months',
    enabled: true,
    annualSpend: annual,
    amount: safeCash,
    months: monthly > 0 ? monthsFromCash(safeCash, monthly) : setting.months,
  };
}

/** 落盘扁平字段；amount 镜像现金 */
export function emergencyToProfile(
  setting: EmergencySetting,
  cash?: number,
): {
  emergencyEnabled?: boolean;
  emergencyMode: EmergencyMode;
  emergencyMonths: number;
  emergencyAmount: number;
  emergencyAnnualSpend: number;
} {
  const months = clamp(setting.months, 0, MAX_MONTHS);
  const amount = cash !== undefined && Number.isFinite(cash)
    ? Math.max(0, cash)
    : Math.max(0, setting.amount);
  return {
    // ponytail: 勾选按月数或有月数时写 true，兼容旧读者
    ...(setting.mode === 'months' || months > 0 || setting.enabled ? { emergencyEnabled: true } : {}),
    emergencyMode: setting.mode,
    emergencyMonths: months,
    emergencyAmount: amount,
    emergencyAnnualSpend: Math.max(0, setting.annualSpend),
  };
}
