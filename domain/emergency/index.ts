/**
 * 资产配置 · 现金/备用金：
 * 备用金 = 现金资产（不是并列另一坨钱）。
 * mode=amount：直接填现金（cashDirect）；mode=months：monthsPlan 往年÷12×月数 → 现金。
 * 两套分存，切换 mode 只换生效侧，互不覆盖。
 * 持久化：emergencyMode / emergencyCashDirect / emergencyMonths / emergencyMonthsCash /
 *         emergencyAnnualSpend；compat 仍写 emergencyAmount=生效现金。
 */

export type EmergencyMode = 'months' | 'amount';

/** @deprecated 同 EmergencyMode；amount≈直接填现金，months≈按月算现金 */
export type CashInputMode = EmergencyMode;

/** 应急月数套：往年支出、月数、推算现金 */
export type MonthsPlan = {
  annualSpend: number;
  months: number;
  cash: number;
};

export type EmergencySetting = {
  /**
   * 兼容旧画像。新语义下计算侧不再用开关扣「另一坨」准备金；
   * UI select「应急月数」≈ mode==='months'（enabled 仍落盘兼容）。
   */
  enabled: boolean;
  /** amount=直接填现金；months=按应急月数算现金 */
  mode: EmergencyMode;
  /** 默认模式：用户直接填的现金（独立于应急套） */
  cashDirect: number;
  /** 应急月数套（独立于默认现金） */
  monthsPlan: MonthsPlan;
};

export const DEFAULT_MONTHS_PLAN: MonthsPlan = {
  annualSpend: 0,
  months: 0,
  cash: 0,
};

export const DEFAULT_EMERGENCY: EmergencySetting = {
  enabled: false,
  mode: 'amount',
  cashDirect: 0,
  monthsPlan: { ...DEFAULT_MONTHS_PLAN },
};

const MAX_MONTHS = 36;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

/** 当前 mode 对应的生效现金（联动 / 预测用） */
export function activeCash(setting: EmergencySetting): number {
  if (setting.mode === 'months') return Math.max(0, setting.monthsPlan.cash);
  return Math.max(0, setting.cashDirect);
}

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

function hasMonthsPlanData(plan: MonthsPlan): boolean {
  return plan.annualSpend > 0 || plan.months > 0 || plan.cash > 0;
}

/** 从 profile / 访客草稿解析；兼容旧扁平字段，迁移为分存 */
export function parseEmergencySetting(data: Record<string, unknown>): EmergencySetting {
  const months = data.emergencyMonths !== undefined && Number.isFinite(Number(data.emergencyMonths))
    ? clamp(Number(data.emergencyMonths), 0, MAX_MONTHS)
    : DEFAULT_MONTHS_PLAN.months;
  const legacyAmount = data.emergencyAmount !== undefined && Number.isFinite(Number(data.emergencyAmount))
    ? Math.max(0, Number(data.emergencyAmount))
    : 0;
  const annualSpend = data.emergencyAnnualSpend !== undefined && Number.isFinite(Number(data.emergencyAnnualSpend))
    ? Math.max(0, Number(data.emergencyAnnualSpend))
    : DEFAULT_MONTHS_PLAN.annualSpend;
  const mode: EmergencyMode =
    data.emergencyMode === 'amount' || data.emergencyMode === 'months'
      ? data.emergencyMode
      : legacyAmount > 0 && months === 0
        ? 'amount'
        : months > 0
          ? 'months'
          : DEFAULT_EMERGENCY.mode;

  // 生效现金起点：显式 cash > emergencyAmount > 0
  const profileCash = data.cash !== undefined && Number.isFinite(Number(data.cash))
    ? Math.max(0, Number(data.cash))
    : undefined;
  const liveCash = profileCash ?? legacyAmount;

  const cashDirect = data.emergencyCashDirect !== undefined && Number.isFinite(Number(data.emergencyCashDirect))
    ? Math.max(0, Number(data.emergencyCashDirect))
    : liveCash;

  const monthsCash = data.emergencyMonthsCash !== undefined && Number.isFinite(Number(data.emergencyMonthsCash))
    ? Math.max(0, Number(data.emergencyMonthsCash))
    : liveCash;

  let enabled = DEFAULT_EMERGENCY.enabled;
  if (data.emergencyEnabled === true) enabled = true;
  else if (data.emergencyEnabled === false) enabled = false;
  else if (months > 0 || legacyAmount > 0 || cashDirect > 0 || monthsCash > 0) enabled = true;

  return {
    enabled,
    mode,
    cashDirect,
    monthsPlan: { annualSpend, months, cash: monthsCash },
  };
}

/**
 * 应急准备金（元）= 当前 mode 生效现金。
 * setting / monthlyExpenses 保留签名兼容旧调用；第三参 cash 优先。
 */
export function emergencyReserve(
  setting: EmergencySetting,
  monthlyExpenses: number,
  cash?: number,
): number {
  if (cash !== undefined && Number.isFinite(cash)) return Math.max(0, cash);
  return activeCash(setting);
}

/** 改现金后：只写当前 mode 对应套，另一套不动 */
export function syncSettingFromCash(
  setting: EmergencySetting,
  cash: number,
  monthlyExpenses: number,
): EmergencySetting {
  const safeCash = Math.max(0, Number.isFinite(cash) ? cash : 0);
  if (setting.mode === 'amount') {
    return { ...setting, cashDirect: safeCash };
  }
  const expense = resolvePlanMonthly(setting.monthsPlan.annualSpend, monthlyExpenses);
  return {
    ...setting,
    monthsPlan: {
      ...setting.monthsPlan,
      cash: safeCash,
      months: expense > 0 ? monthsFromCash(safeCash, expense) : setting.monthsPlan.months,
    },
  };
}

/**
 * 按应急月数得到目标现金（可再 clamp 到总资产），只写 monthsPlan。
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
  const target = expense > 0 ? cashFromMonths(nextMonths, expense) : Math.max(0, setting.monthsPlan.cash);
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
      monthsPlan: {
        ...setting.monthsPlan,
        months: syncedMonths,
        cash,
      },
    },
  };
}

/**
 * 改往年支出：写 monthsPlan.annualSpend，用 ÷12 月均 × 当前月数重算现金。
 */
export function applyAnnualSpendPlan(
  setting: EmergencySetting,
  annualSpend: number,
  totalAssets: number,
): { setting: EmergencySetting; cash: number } {
  const annual = Math.max(0, Number.isFinite(annualSpend) ? annualSpend : 0);
  const monthly = monthlyFromAnnual(annual);
  const base: EmergencySetting = {
    ...setting,
    mode: 'months',
    enabled: true,
    monthsPlan: { ...setting.monthsPlan, annualSpend: annual },
  };
  return applyMonthsPlan(base, setting.monthsPlan.months, monthly, totalAssets);
}

/** 切录入方式：只改 mode；两套数据原样保留（切 months 时空套走 enableMonthsPlan 播种） */
export function switchEmergencyMode(
  setting: EmergencySetting,
  nextMode: EmergencyMode,
  monthlyExpenses: number,
  _cash?: number,
): EmergencySetting {
  if (setting.mode === nextMode) return setting;
  if (nextMode === 'amount') {
    return { ...setting, mode: 'amount' };
  }
  return enableMonthsPlan(setting, monthlyExpenses);
}

/**
 * 切到「应急月数」：已有应急套则只改 mode；
 * 空套时用本月×12 播种，月数/现金自 cashDirect 反算（现金先连续）。
 */
export function enableMonthsPlan(
  setting: EmergencySetting,
  liveMonthly: number,
  _cash?: number,
): EmergencySetting {
  if (hasMonthsPlanData(setting.monthsPlan)) {
    return { ...setting, mode: 'months', enabled: true };
  }
  const annual = annualFromMonthly(liveMonthly);
  const monthly = resolvePlanMonthly(annual, liveMonthly);
  const seedCash = Math.max(0, setting.cashDirect);
  return {
    ...setting,
    mode: 'months',
    enabled: true,
    monthsPlan: {
      annualSpend: annual,
      cash: seedCash,
      months: monthly > 0 ? monthsFromCash(seedCash, monthly) : 0,
    },
  };
}

/** 落盘：分存字段 + compat emergencyAmount=生效现金 */
export function emergencyToProfile(
  setting: EmergencySetting,
  cash?: number,
): {
  emergencyEnabled?: boolean;
  emergencyMode: EmergencyMode;
  emergencyCashDirect: number;
  emergencyMonths: number;
  emergencyMonthsCash: number;
  emergencyAmount: number;
  emergencyAnnualSpend: number;
} {
  // 可选 cash：写入当前 mode 对应套，再落盘
  const synced = cash !== undefined && Number.isFinite(cash)
    ? syncSettingFromCash(setting, cash, resolvePlanMonthly(setting.monthsPlan.annualSpend))
    : setting;
  const months = clamp(synced.monthsPlan.months, 0, MAX_MONTHS);
  const amount = activeCash(synced);
  return {
    // ponytail: 勾选按月数或有月数时写 true，兼容旧读者
    ...(synced.mode === 'months' || months > 0 || synced.enabled ? { emergencyEnabled: true } : {}),
    emergencyMode: synced.mode,
    emergencyCashDirect: Math.max(0, synced.cashDirect),
    emergencyMonths: months,
    emergencyMonthsCash: Math.max(0, synced.monthsPlan.cash),
    emergencyAmount: amount,
    emergencyAnnualSpend: Math.max(0, synced.monthsPlan.annualSpend),
  };
}
