/**
 * 支出时间区间：每笔都有开始/结束；短区间在时间轴上渲染为点或短线。
 */

import { calendarMonthsBetween } from './installmentPayment.ts';

export type SpanMode = 'fixed' | 'percentage' | 'installment' | 'one_time';

export type SpanExpense = {
  id: string;
  name?: string;
  mode: SpanMode;
  startDate?: string;
  endDate?: string;
  term?: number;
  followRetirement?: boolean;
};

export type ResolvedSpan = {
  start: string;
  end: string;
  /**
   * point=单次时点；tick=很短区间；range=有限连续；open=无结束（无限期连续）
   */
  kind: 'point' | 'tick' | 'range' | 'open';
  termMonths: number;
  /** 是否开放结束（固定/比例未设 endDate） */
  openEnded: boolean;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

export function todayDateKey(now = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function todayMonthKey(now = new Date()): string {
  return todayDateKey(now).slice(0, 7);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** YYYY-MM → 当月 1 号 */
export function monthToDate(ym: string): string {
  const key = ym.length >= 7 ? ym.slice(0, 7) : todayMonthKey();
  return `${key}-01`;
}

export function addMonthsToDate(date: string, months: number): string {
  const next = new Date(`${date.slice(0, 10)}T00:00:00`);
  next.setMonth(next.getMonth() + months);
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`;
}

/** 退休前还清：最长期数 = 开始日到退休日的整月差（至少 1） */
export function maxTermBeforeRetirement(startDate: string, retirementDate: string): number {
  const start = startDate.slice(0, 10);
  const retire = retirementDate.slice(0, 10);
  if (retire <= start) return 1;
  return Math.max(1, calendarMonthsBetween(start, retire));
}

export function clampInstallmentTerm(
  startDate: string,
  termMonths: number,
  followRetirement: boolean,
  retirementDate?: string,
): number {
  const requested = Math.min(360, Math.max(1, Math.round(termMonths) || 1));
  if (!followRetirement || !retirementDate) return requested;
  return Math.min(requested, maxTermBeforeRetirement(startDate, retirementDate));
}

/** 一次性默认发生日：未设置时取「当前月」1 号 */
export function defaultOneTimeDate(today = todayDateKey()): string {
  return monthToDate(monthKey(today));
}

/**
 * 统一解析起止。
 * - 一次性：未设时间 → 当前月（当月 1 号），起止同一天 → point
 * - 分期：默认当月起贷；followRetirement 时用退休日截断期数
 * - 固定/比例：有 end 用 end，否则按 30 年视界便于时间轴展示
 */
export function resolveExpenseSpan(
  expense: SpanExpense,
  opts: { today?: string; retirementDate?: string; openHorizonMonths?: number } = {},
): ResolvedSpan {
  const today = (opts.today || todayDateKey()).slice(0, 10);
  const horizon = opts.openHorizonMonths ?? 360;

  if (expense.mode === 'one_time') {
    // 未设置 → 当前月 1 号；已设置保留原日期
    const start = (expense.startDate || defaultOneTimeDate(today)).slice(0, 10);
    return { start, end: start, kind: 'point', termMonths: 1, openEnded: false };
  }

  const start = (expense.startDate || today).slice(0, 10);

  if (expense.mode === 'installment') {
    const term = clampInstallmentTerm(
      start,
      expense.term || 1,
      Boolean(expense.followRetirement),
      opts.retirementDate,
    );
    const end = expense.followRetirement || !expense.endDate
      ? addMonthsToDate(start, term - 1)
      : expense.endDate.slice(0, 10);
    const spanMonths = Math.max(1, calendarMonthsBetween(start, end) + 1);
    const kind = spanMonths <= 1 ? 'point' : spanMonths <= 3 ? 'tick' : 'range';
    return { start, end, kind, termMonths: term, openEnded: false };
  }

  // 固定 / 比例：未设结束 = 无限期连续曲线
  if (!expense.endDate) {
    const end = addMonthsToDate(start, horizon - 1);
    return { start, end, kind: 'open', termMonths: horizon, openEnded: true };
  }
  const end = expense.endDate.slice(0, 10);
  const spanMonths = Math.max(1, calendarMonthsBetween(start, end) + 1);
  const kind = spanMonths <= 1 ? 'point' : spanMonths <= 3 ? 'tick' : 'range';
  return { start, end, kind, termMonths: spanMonths, openEnded: false };
}

/** 相对锚点把日期映射到年下标（0..maxYear），用于资产/健康年图 */
export function yearIndexFromAnchor(date: string, anchorDate = todayDateKey(), maxYear = 30): number {
  const months = calendarMonthsBetween(anchorDate.slice(0, 10), date.slice(0, 10));
  return Math.max(0, Math.min(maxYear, Math.round(months / 12)));
}

/** 指定 YYYY-MM 是否落在支出有效区间内 */
export function isActiveInMonth(
  expense: SpanExpense,
  yearMonth: string,
  opts: { today?: string; retirementDate?: string } = {},
): boolean {
  const span = resolveExpenseSpan(expense, opts);
  const m = yearMonth.slice(0, 7);
  return monthKey(span.start) <= m && monthKey(span.end) >= m;
}

export type TimelineMark = {
  id: string;
  name: string;
  color: string;
  start: string;
  end: string;
  kind: ResolvedSpan['kind'];
  /** 相对锚点月的起止下标（可越界，渲染时再夹紧） */
  startOffset: number;
  endOffset: number;
};

/** 时间轴标记：相对 anchorMonth（默认本月） */
export function buildTimelineMarks(
  expenses: Array<SpanExpense & { name?: string }>,
  colors: Record<string, string> | ((id: string) => string),
  opts: { anchorMonth?: string; retirementDate?: string; today?: string } = {},
): TimelineMark[] {
  const anchor = monthToDate(opts.anchorMonth || todayMonthKey());
  const colorOf = typeof colors === 'function' ? colors : (id: string) => colors[id] || '#94a3b8';
  return expenses.map((expense) => {
    const span = resolveExpenseSpan(expense, opts);
    return {
      id: expense.id,
      name: expense.name || '未命名',
      color: colorOf(expense.id),
      start: span.start,
      end: span.end,
      kind: span.kind,
      startOffset: calendarMonthsBetween(anchor, span.start),
      endOffset: calendarMonthsBetween(anchor, span.end),
    };
  });
}

/** ECharts custom：在 category 月轴上画条/短线/点（x 为 0..horizon 下标） */
export function timelineCustomSeries(
  marks: TimelineMark[],
  horizonMonths: number,
) {
  const clampIdx = (value: number) => Math.min(horizonMonths, Math.max(0, value));
  return {
    type: 'custom' as const,
    clip: true,
    renderItem: (params: { coordSys: { x: number; y: number; width: number; height: number } }, api: {
      value: (dim: number) => number;
      coord: (val: number[]) => number[];
      size: (val: number[]) => number[];
      style: (opt?: object) => object;
    }) => {
      const startOffset = api.value(0);
      const endOffset = api.value(1);
      const band = api.value(2);
      const yBand = Number(band);
      const x0 = clampIdx(startOffset);
      const x1 = clampIdx(Math.max(endOffset, startOffset));
      const p0 = api.coord([x0, yBand]);
      const p1 = api.coord([x1, yBand]);
      const height = Math.max(6, (api.size([0, 1])[1] || 12) * 0.35);
      const kind = api.value(3); // 0 point 1 tick 2 range/open
      const style = api.style({ stroke: undefined });
      if (kind === 0 || x1 - x0 < 1) {
        return {
          type: 'circle',
          shape: { cx: p0[0], cy: p0[1], r: 5 },
          style,
        };
      }
      if (kind === 1) {
        const mid = (p0[0] + p1[0]) / 2;
        return {
          type: 'rect',
          shape: { x: mid - 4, y: p0[1] - height / 2, width: 8, height },
          style,
        };
      }
      return {
        type: 'rect',
        shape: {
          x: p0[0],
          y: p0[1] - height / 2,
          width: Math.max(6, p1[0] - p0[0]),
          height,
          r: 3,
        },
        style,
      };
    },
    data: marks.map((mark, index) => ({
      value: [
        mark.startOffset,
        mark.endOffset,
        marks.length - 1 - index,
        mark.kind === 'point' ? 0 : mark.kind === 'tick' ? 1 : 2,
      ],
      itemStyle: { color: mark.color, opacity: 0.85 },
      name: mark.name,
    })),
    encode: { x: [0, 1], y: 2 },
    z: 10,
  };
}
