/**
 * 计划变更：财务参数标题旁入口文案、指标白名单、搜索过滤、图标记映射
 * 白名单须与 domain/planChange PLAN_CHANGE_FIELDS 一致
 */
import {
  isValidYearMonth,
  yearMonthForAssetMonth,
  type PlanChangeEvent,
  type PlanChangeField,
} from '../domain/planChange';

export const PLAN_CHANGE_ENTRY = '计划变更';

export const PLAN_CHANGE_TIP =
  '从某月起改参数（税前/到手/年化），下面测算和图表会一起重算；不改你现在填的数。同一指标可设多个时间点。';

export const PLAN_CHANGE_PANEL_TITLE = '计划变更';

export const PLAN_CHANGE_FIELD_LABEL: Record<PlanChangeField, string> = {
  grossSalary: '税前工资',
  takeHomeIncome: '到手收入',
  annualReturn: '理财年化',
};

/** 图上短标签，避免 markLine 字挤 */
export const PLAN_CHANGE_FIELD_SHORT: Record<PlanChangeField, string> = {
  grossSalary: '税前',
  takeHomeIncome: '到手',
  annualReturn: '年化',
};

export const PLAN_CHANGE_FIELD_COLOR: Record<PlanChangeField, string> = {
  grossSalary: '#f07f62',
  takeHomeIncome: '#3d8f6e',
  annualReturn: '#6366f1',
};

export const PLAN_CHANGE_FIELD_OPTIONS: Array<{ value: PlanChangeField; label: string }> = (
  Object.entries(PLAN_CHANGE_FIELD_LABEL) as Array<[PlanChangeField, string]>
).map(([value, label]) => ({ value, label }));

/** 列表行：指标 · 时间 · 值 */
export function formatPlanChangeListLine(
  field: PlanChangeField,
  startYearMonth: string,
  value: number,
): string {
  const label = PLAN_CHANGE_FIELD_LABEL[field] ?? field;
  const display = field === 'annualReturn'
    ? `${Number(value).toLocaleString('zh-CN')}%`
    : value.toLocaleString('zh-CN');
  return `${label} · ${startYearMonth} · ${display}`;
}

/** 指标 combobox：按中文名 / field key 过滤（空查询=全部） */
export function filterPlanChangeFieldOptions(
  query: string,
  options: Array<{ value: PlanChangeField; label: string }> = PLAN_CHANGE_FIELD_OPTIONS,
): Array<{ value: PlanChangeField; label: string }> {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
  );
}

export type PlanChangeMarkLineItem = {
  xAxis: string;
  name: string;
  lineStyle: { color: string; type: 'dashed'; width: number };
  label: { formatter: string; color: string; fontSize: number };
};

function toMarkLineItem(event: Pick<PlanChangeEvent, 'field' | 'startYearMonth'>, xAxis: string): PlanChangeMarkLineItem {
  const color = PLAN_CHANGE_FIELD_COLOR[event.field];
  const short = PLAN_CHANGE_FIELD_SHORT[event.field];
  return {
    xAxis,
    name: short,
    lineStyle: { color, type: 'dashed', width: 1.5 },
    label: { formatter: short, color, fontSize: 10 },
  };
}

/** 仅 enabled；xAxis = YYYY-MM（剩余可支配等按月标签图） */
export function planChangeMarkLinesForYearMonthAxis(
  events: Array<Pick<PlanChangeEvent, 'enabled' | 'field' | 'startYearMonth'>>,
): PlanChangeMarkLineItem[] {
  return events
    .filter((e) => e.enabled && isValidYearMonth(e.startYearMonth))
    .map((e) => toMarkLineItem(e, e.startYearMonth));
}

/**
 * 资产走势：把 startYearMonth 映到 asset 月标签（与 yearMonthForAssetMonth 对齐）
 * disabled 不画；映不到标签的跳过
 */
export function planChangeMarkLinesForAssetAxis(
  events: Array<Pick<PlanChangeEvent, 'enabled' | 'field' | 'startYearMonth'>>,
  assetLabels: string[],
  base = new Date(),
): PlanChangeMarkLineItem[] {
  const out: PlanChangeMarkLineItem[] = [];
  for (const event of events) {
    if (!event.enabled || !isValidYearMonth(event.startYearMonth)) continue;
    let index = -1;
    for (let i = 0; i < assetLabels.length; i += 1) {
      if (yearMonthForAssetMonth(i, base) === event.startYearMonth) {
        index = i;
        break;
      }
    }
    if (index < 0) continue;
    out.push(toMarkLineItem(event, assetLabels[index]));
  }
  return out;
}
