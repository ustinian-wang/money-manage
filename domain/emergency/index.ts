/**
 * 应急资金：可开关；按月（月数×月支出）或固定金额。
 * 关闭 → 准备金为 0，不参与「调整后可用资产」扣减（与历史默认 0 月一致）。
 */

export type EmergencyMode = 'months' | 'amount';

export type EmergencySetting = {
  /** 未启用时不占主流程；计算侧准备金为 0 */
  enabled: boolean;
  mode: EmergencyMode;
  /** 按月模式：应急月数，0–36 */
  months: number;
  /** 固定金额模式：应急金额（元） */
  amount: number;
};

export const DEFAULT_EMERGENCY: EmergencySetting = {
  enabled: false,
  mode: 'months',
  months: 0,
  amount: 0,
};

const MAX_MONTHS = 36;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

/** 从 profile / 访客草稿解析；兼容仅有 emergencyMonths 的旧画像 */
export function parseEmergencySetting(data: Record<string, unknown>): EmergencySetting {
  const months = data.emergencyMonths !== undefined && Number.isFinite(Number(data.emergencyMonths))
    ? clamp(Number(data.emergencyMonths), 0, MAX_MONTHS)
    : DEFAULT_EMERGENCY.months;
  const amount = data.emergencyAmount !== undefined && Number.isFinite(Number(data.emergencyAmount))
    ? Math.max(0, Number(data.emergencyAmount))
    : 0;
  const mode: EmergencyMode =
    data.emergencyMode === 'amount' || data.emergencyMode === 'months'
      ? data.emergencyMode
      : 'months';
  // 显式开关优先；旧画像无开关时：有月数或固定额则视为已启用，避免丢用户设置
  let enabled = DEFAULT_EMERGENCY.enabled;
  if (data.emergencyEnabled === true) enabled = true;
  else if (data.emergencyEnabled === false) enabled = false;
  else if (months > 0 || (mode === 'amount' && amount > 0)) enabled = true;

  return { enabled, mode, months, amount };
}

/**
 * 应急准备金（元）。
 * 关闭 → 0；按月 → months×月支出；固定 → amount。
 */
export function emergencyReserve(setting: EmergencySetting, monthlyExpenses: number): number {
  if (!setting.enabled) return 0;
  if (setting.mode === 'amount') return Math.max(0, setting.amount);
  const months = clamp(setting.months, 0, MAX_MONTHS);
  const expense = Math.max(0, Number.isFinite(monthlyExpenses) ? monthlyExpenses : 0);
  return months * expense;
}

/** 切模式：保留两套字段；按月→固定用当前准备金作初值 */
export function switchEmergencyMode(
  setting: EmergencySetting,
  nextMode: EmergencyMode,
  monthlyExpenses: number,
): EmergencySetting {
  if (setting.mode === nextMode) return setting;
  if (nextMode === 'amount') {
    const amount = Math.round(emergencyReserve({ ...setting, enabled: true, mode: 'months' }, monthlyExpenses));
    return { ...setting, mode: 'amount', amount };
  }
  const expense = Math.max(0, monthlyExpenses);
  const months = expense > 0
    ? clamp(Math.round((Math.max(0, setting.amount) / expense) * 2) / 2, 0, MAX_MONTHS)
    : setting.months;
  return { ...setting, mode: 'months', months };
}

/** 落盘扁平字段（与 profile 一致） */
export function emergencyToProfile(setting: EmergencySetting): {
  emergencyEnabled?: boolean;
  emergencyMode: EmergencyMode;
  emergencyMonths: number;
  emergencyAmount: number;
} {
  const months = clamp(setting.months, 0, MAX_MONTHS);
  const amount = Math.max(0, setting.amount);
  return {
    ...(setting.enabled ? { emergencyEnabled: true } : {}),
    emergencyMode: setting.mode,
    emergencyMonths: months,
    emergencyAmount: amount,
  };
}
