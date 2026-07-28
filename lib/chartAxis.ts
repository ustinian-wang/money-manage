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

/** 占比 Y 轴最多分段数（约 6 个刻度标签） */
export const PERCENT_SHARE_Y_MAX_SPLITS = 5;

/** 正常 0～100% 默认步长 */
export const PERCENT_SHARE_Y_BASE_INTERVAL = 20;

/**
 * 占比图关注带：±100%；带外点只标数值，不拉长轴刷刻度。
 * ponytail: 略扩边距=0，靠 interval 对齐即可；要松一点改 FOCUS 常量
 */
export const PERCENT_SHARE_Y_FOCUS_MIN = -100;
export const PERCENT_SHARE_Y_FOCUS_MAX = 100;

/**
 * 1-2-5 nice ceil：把 raw 抬到可读步长。
 * ponytail: 仅服务百分比轴；非正数回落到 BASE_INTERVAL
 */
export function niceCeilInterval(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return PERCENT_SHARE_Y_BASE_INTERVAL;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const frac = raw / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * base;
}

/**
 * 占比图 Y 轴：先夹在关注带 ±100，再按跨度抬高 interval。
 * 极端超支/深度负区不把轴拉到上千，避免刷出过多刻度。
 * @param extentMin / extentMax 已含业务兜底（如 0～100、warn 档）
 */
export function percentShareYAxis(
  extentMin: number,
  extentMax: number,
): { min: number; max: number; interval: number } {
  const rawLo = Number.isFinite(extentMin) ? extentMin : 0;
  const rawHi = Number.isFinite(extentMax) ? extentMax : 100;
  const lo = Math.max(PERCENT_SHARE_Y_FOCUS_MIN, rawLo);
  const hi = Math.min(PERCENT_SHARE_Y_FOCUS_MAX, rawHi);
  // 先按 10 对齐，与历史 floor/ceil 行为一致
  let min = Math.floor(lo / 10) * 10;
  let max = Math.ceil(hi / 10) * 10;
  if (max <= min) max = min + PERCENT_SHARE_Y_BASE_INTERVAL;
  const span = max - min;
  let interval = niceCeilInterval(
    Math.max(PERCENT_SHARE_Y_BASE_INTERVAL, span / PERCENT_SHARE_Y_MAX_SPLITS),
  );
  // nice 仍可能偏小：抬到下一级直到段数不超上限
  while (span / interval > PERCENT_SHARE_Y_MAX_SPLITS + 1e-9) {
    interval = niceCeilInterval(interval * 1.01);
  }
  // 按最终 interval 重对齐端点
  min = Math.floor(lo / interval) * interval;
  max = Math.ceil(hi / interval) * interval;
  if (max <= min) max = min + interval;
  return { min, max, interval };
}

/** 关注带外点：轴仍夹 ±100，pin 贴边并标真实数值 */
export type PercentShareOverflowMark = {
  name: string;
  coord: [string, number];
  value: number;
};

/**
 * 筛出超出关注带的点；coord.y 夹到带边，value 保留真实百分比供 label。
 */
export function percentShareOverflowMarks(
  items: Array<{ label: string; value: number }>,
  focusMin: number = PERCENT_SHARE_Y_FOCUS_MIN,
  focusMax: number = PERCENT_SHARE_Y_FOCUS_MAX,
): PercentShareOverflowMark[] {
  const out: PercentShareOverflowMark[] = [];
  for (const item of items) {
    const v = item.value;
    if (!Number.isFinite(v) || (v >= focusMin && v <= focusMax)) continue;
    out.push({
      name: '溢出',
      coord: [item.label, Math.min(focusMax, Math.max(focusMin, v))],
      value: v,
    });
  }
  return out;
}
