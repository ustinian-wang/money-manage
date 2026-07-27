/**
 * 计划变更（forecast events）：从某月起覆盖参数，只影响预测/图表，不改主卡当前值。
 *
 * 白名单（须能真实进预测）：
 * - grossSalary → FinanceInput.salary（强制 detail 净收入链）
 * - takeHomeIncome → FinanceInput.takeHomeIncome（强制 takehome）
 * - annualReturn → FinanceInput.returnRate / 资产预测年化
 *
 * 解析规则（按指标独立）：
 * 1. 仅 enabled 且 field 匹配的事件参与
 * 2. startYearMonth <= 目标月 的为候选
 * 3. 按 startYearMonth 升序；同月同指标按数组顺序后者覆盖
 * 4. 取最后一条候选的 value；无候选 → 主卡 base
 * 不同指标各自覆盖自己的字段，互不干扰。
 */

export type PlanChangeField = 'grossSalary' | 'takeHomeIncome' | 'annualReturn';

export const PLAN_CHANGE_FIELDS: readonly PlanChangeField[] = [
  'grossSalary',
  'takeHomeIncome',
  'annualReturn',
] as const;

export type PlanChangeEvent = {
  id: string;
  enabled: boolean;
  field: PlanChangeField;
  /** YYYY-MM */
  startYearMonth: string;
  value: number;
};

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidYearMonth(value: unknown): value is string {
  return typeof value === 'string' && YM_RE.test(value);
}

export function isPlanChangeField(value: unknown): value is PlanChangeField {
  return value === 'grossSalary' || value === 'takeHomeIncome' || value === 'annualReturn';
}

export function formatYearMonth(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** 相对基准日偏移 monthOffset 个月（可为负） */
export function yearMonthOffset(monthOffset: number, base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), 1);
  d.setMonth(d.getMonth() + monthOffset);
  return formatYearMonth(d);
}

/**
 * 资产预测 month 下标 → 日历月：
 * month 0 = 现在（无结余滚动）；month ≥ 1 的结余对应「当前月 + (month-1)」
 * （与 oneTime 计入第 1 个投影月对齐）
 */
export function yearMonthForAssetMonth(monthIndex: number, base = new Date()): string {
  if (monthIndex <= 0) return formatYearMonth(base);
  return yearMonthOffset(monthIndex - 1, base);
}

function normalizeValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function createPlanChangeEvent(partial?: Partial<PlanChangeEvent>): PlanChangeEvent {
  const field = isPlanChangeField(partial?.field) ? partial!.field : 'grossSalary';
  return {
    id: partial?.id ?? `pc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    enabled: partial?.enabled !== false,
    field,
    startYearMonth: isValidYearMonth(partial?.startYearMonth)
      ? (partial!.startYearMonth as string)
      : formatYearMonth(),
    value: normalizeValue(partial?.value ?? 0),
  };
}

/** 解析画像中的 planChanges；非法项丢弃 */
export function parsePlanChanges(data: unknown): PlanChangeEvent[] {
  const source = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const raw = source.planChanges;
  if (!Array.isArray(raw)) return [];
  const out: PlanChangeEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (!isPlanChangeField(row.field)) continue;
    if (!isValidYearMonth(row.startYearMonth)) continue;
    const id = typeof row.id === 'string' && row.id ? row.id : createPlanChangeEvent().id;
    out.push({
      id,
      enabled: row.enabled !== false,
      field: row.field,
      startYearMonth: row.startYearMonth,
      value: normalizeValue(row.value),
    });
  }
  return out;
}

export function planChangesToProfile(events: PlanChangeEvent[]): { planChanges: PlanChangeEvent[] } {
  return {
    planChanges: events.map((e) => ({
      ...e,
      field: isPlanChangeField(e.field) ? e.field : 'grossSalary',
      value: normalizeValue(e.value),
    })),
  };
}

/**
 * 目标月某指标生效覆盖值；无覆盖返回 null（调用方用主卡 base）
 */
export function activeFieldOverride(
  events: PlanChangeEvent[],
  field: PlanChangeField,
  yearMonth: string,
): number | null {
  if (!isValidYearMonth(yearMonth) || !isPlanChangeField(field)) return null;
  const indexed = events
    .map((event, index) => ({ event, index }))
    .filter(
      ({ event }) =>
        event.enabled
        && event.field === field
        && isValidYearMonth(event.startYearMonth)
        && event.startYearMonth <= yearMonth,
    );
  if (!indexed.length) return null;
  indexed.sort((a, b) => {
    if (a.event.startYearMonth !== b.event.startYearMonth) {
      return a.event.startYearMonth < b.event.startYearMonth ? -1 : 1;
    }
    return a.index - b.index;
  });
  return normalizeValue(indexed[indexed.length - 1].event.value);
}

/** @deprecated 用 activeFieldOverride(..., 'grossSalary', ...)；保留兼容 */
export function activeGrossSalaryOverride(
  events: PlanChangeEvent[],
  yearMonth: string,
): number | null {
  return activeFieldOverride(events, 'grossSalary', yearMonth);
}

/** 目标月某指标：有覆盖用覆盖值，否则主卡 base（主画像本身不被改写） */
export function resolveFieldAt(
  base: number,
  events: PlanChangeEvent[],
  field: PlanChangeField,
  yearMonth: string,
): number {
  const override = activeFieldOverride(events, field, yearMonth);
  if (override == null) return Math.max(0, Number.isFinite(base) ? base : 0);
  return override;
}

/** @deprecated 用 resolveFieldAt(..., 'grossSalary', ...)；保留兼容 */
export function resolveGrossSalaryAt(
  baseSalary: number,
  events: PlanChangeEvent[],
  yearMonth: string,
): number {
  return resolveFieldAt(baseSalary, events, 'grossSalary', yearMonth);
}
