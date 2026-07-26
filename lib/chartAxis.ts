/**
 * 长序列月度图 X 轴：窄屏少刻度 + 短年标签；桌面保持逐年可读。
 * 需求：first-visit-audit P2-2 / 多视角评估 #8
 */

/** 每 12 个月显示一刻度（ECharts interval = 步长−1） */
export const DESKTOP_MONTH_AXIS_INTERVAL = 11;

/** 每 60 个月（5 年）一刻度，减轻 ≤639 拥挤 */
export const NARROW_MONTH_AXIS_INTERVAL = 59;

export function monthAxisInterval(narrow: boolean): number {
  return narrow ? NARROW_MONTH_AXIS_INTERVAL : DESKTOP_MONTH_AXIS_INTERVAL;
}

export function monthAxisRotate(narrow: boolean): number {
  return narrow ? 0 : 40;
}

const ASSET_LABEL_RE = /^(\d+)年(\d+)个月$/;

/** 资产走势 category 标签：窄屏「第 N 年」 */
export function formatAssetChartAxisLabel(value: string, narrow: boolean): string {
  if (!narrow) return value;
  if (value === '现在') return value;
  const match = ASSET_LABEL_RE.exec(value);
  if (!match) return value;
  return `第${Number(match[1])}年`;
}

const YEAR_MONTH_RE = /^(\d{4})-(\d{2})$/;

/** 剩余可支配 / 现金流 category（YYYY-MM）：窄屏「YYYY年」 */
export function formatYearMonthChartAxisLabel(value: string, narrow: boolean): string {
  if (!narrow) return value;
  const match = YEAR_MONTH_RE.exec(value);
  if (!match) return value;
  return `${match[1]}年`;
}
