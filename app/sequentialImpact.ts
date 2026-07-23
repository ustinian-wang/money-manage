/**
 * 多支出顺序归因：基线 + 按 item 顺序的前缀汇总，相邻层差 = 边际增量。
 * 每项固定颜色；时态图用堆叠 delta 面积（互不重叠），结余带垫高到最终前缀累计。
 */

import { calendarMonthsBetween } from './installmentPayment.ts';
import {
  monthToDate,
  resolveExpenseSpan,
  todayMonthKey,
  type SpanExpense,
} from './expenseSpan.ts';

export type ImpactItem = { id: string; name: string };

export type StackedLayerWithColor = {
  id: string;
  name: string;
  color: string;
  /** 加入本层后的累计序列 */
  cumulative: number[];
  /** 相对上一层的增量（基线层 delta === cumulative） */
  delta: number[];
};

export const BASELINE_COLOR = '#94a3b8';
/** 勾选项配色（不含基线灰） */
export const ITEM_COLORS = ['#f07f62', '#3d8f6e', '#4f7cac', '#c9a227', '#8b5cf6', '#ef4444', '#14b8a6', '#ea580c'];
/** 结余填满至 100% 的柔和色（偏天蓝，避开 ITEM_COLORS 绿/橙系） */
export const SAVINGS_COLOR = '#7dd3fc';
/** 投资占比虚拟系列色（浅紫，避开结余天蓝与 ITEM_COLORS） */
export const INVEST_SHARE_COLOR = '#c084fc';
export const INVEST_SHARE_NAME = '投资占比';
export const SPENDABLE_REMAIN_NAME = '可花费剩余';

/**
 * 将「剩余可支配面积」按投资比例拆成投资层 + 可花费剩余。
 * remainPct = max(0, 100 − 支出总占比)；
 * investPct = remainPct × rate/100；spendablePct = remainPct − investPct。
 * 可支配 ≤ 0 或剩余 ≤ 0 时两层均为 0。
 */
export function splitRemainByInvestRate(
  expenseTotalPct: number,
  investRate: number,
  disposableIncome = 1,
): { remainPct: number; investPct: number; spendablePct: number } {
  if (!(disposableIncome > 0)) {
    return { remainPct: 0, investPct: 0, spendablePct: 0 };
  }
  const remainPct = Math.max(0, 100 - (Number(expenseTotalPct) || 0));
  const rate = Math.min(100, Math.max(0, Number.isFinite(investRate) ? investRate : 0)) / 100;
  const investPct = Number((remainPct * rate).toFixed(2));
  const spendablePct = Number(Math.max(0, remainPct - investPct).toFixed(2));
  return { remainPct: Number(remainPct.toFixed(2)), investPct, spendablePct };
}

/**
 * 勾选投资后：在支出累计之上把剩余可支配拆成「投资 + 可花费剩余」两层（同 savings stack）。
 * 未勾选时请继续用 savingsFillTo100Series。
 */
export function remainInvestSpendableSeries(
  expenseTopCumulative: number[],
  investRate: number,
  opts: {
    disposableIncome?: number;
    investName?: string;
    spendableName?: string;
    investColor?: string;
    spendableColor?: string;
  } = {},
) {
  const disposableIncome = opts.disposableIncome ?? 1;
  const investName = opts.investName ?? INVEST_SHARE_NAME;
  const spendableName = opts.spendableName ?? SPENDABLE_REMAIN_NAME;
  const investColor = opts.investColor ?? INVEST_SHARE_COLOR;
  const spendableColor = opts.spendableColor ?? SAVINGS_COLOR;
  const lower = expenseTopCumulative.map((value) => Number((Number(value) || 0).toFixed(2)));
  const investData: number[] = [];
  const spendableData: number[] = [];
  for (const expense of expenseTopCumulative) {
    const { investPct, spendablePct } = splitRemainByInvestRate(expense, investRate, disposableIncome);
    investData.push(investPct);
    spendableData.push(spendablePct);
  }
  const stack = 'savings-to-100';
  return [
    {
      name: `${investName}·垫`,
      type: 'line',
      stack,
      smooth: true,
      symbol: 'none',
      z: 5,
      data: lower,
      lineStyle: { width: 0, opacity: 0 },
      areaStyle: { opacity: 0 },
      itemStyle: { color: investColor },
      silent: true,
      tooltip: { show: false },
      legendHoverLink: false,
    },
    {
      name: investName,
      type: 'line',
      stack,
      smooth: true,
      symbol: 'none',
      z: 6,
      data: investData,
      lineStyle: { width: 1.5, color: investColor },
      areaStyle: { color: investColor, opacity: 0.42 },
      itemStyle: { color: investColor },
      emphasis: { focus: 'series' },
    },
    {
      name: spendableName,
      type: 'line',
      stack,
      smooth: true,
      symbol: 'none',
      z: 7,
      data: spendableData,
      lineStyle: { width: 1.5, color: spendableColor },
      areaStyle: { color: spendableColor, opacity: 0.32 },
      itemStyle: { color: spendableColor },
      emphasis: { focus: 'series' },
    },
  ];
}

/** 按支出在全表中的稳定下标取色，勾选与图例同色 */
export function colorForItemId(id: string, allIds: string[]): string {
  const index = allIds.indexOf(id);
  return ITEM_COLORS[(index >= 0 ? index : 0) % ITEM_COLORS.length];
}

/** overlay：去掉全部勾选项后按顺序加回前缀；isolated：仅前缀勾选项 */
export function buildPrefixExpenses<T extends { id: string }>(
  all: T[],
  selectedOrdered: T[],
  prefixLen: number,
  mode: 'overlay' | 'isolated',
): T[] {
  const n = Math.max(0, Math.min(prefixLen, selectedOrdered.length));
  const prefix = selectedOrdered.slice(0, n);
  if (mode === 'isolated') return prefix;
  const selectedIds = new Set(selectedOrdered.map((item) => item.id));
  const rest = all.filter((item) => !selectedIds.has(item.id));
  return [...rest, ...prefix];
}

/**
 * cumulatives[0] = 基线序列；cumulatives[k] = 基线 + 前 k 个 item 后的序列。
 * items 长度应为 cumulatives.length - 1。
 */
export function toStackedLayersColored(
  cumulatives: number[][],
  items: ImpactItem[],
  allIdsForColor: string[] = items.map((item) => item.id),
): StackedLayerWithColor[] {
  if (!cumulatives.length) return [];
  const len = cumulatives[0]?.length ?? 0;
  const layers: StackedLayerWithColor[] = [];
  for (let i = 0; i < cumulatives.length; i += 1) {
    const cumulative = (cumulatives[i] ?? []).slice(0, len).map((value) => Number(value) || 0);
    while (cumulative.length < len) cumulative.push(0);
    const prev = i === 0 ? null : layers[i - 1].cumulative;
    const delta = cumulative.map((value, index) => (prev ? value - prev[index] : value));
    const meta = i === 0
      ? { id: 'baseline', name: '基线（不含勾选）', color: BASELINE_COLOR }
      : {
        id: items[i - 1]?.id ?? `item-${i}`,
        name: items[i - 1]?.name || `项 ${i}`,
        color: colorForItemId(items[i - 1]?.id ?? '', allIdsForColor),
      };
    layers.push({
      id: meta.id,
      name: meta.name,
      cumulative,
      delta,
      color: meta.color,
    });
  }
  return layers;
}

/**
 * 每项一条累计曲线 + 与上一层之间的彩色面积带（正负增量都能看见色带）。
 * 图例只挂累计曲线，避免「面积」重复项。
 */
export function impactLineAndBandSeries(layers: StackedLayerWithColor[]) {
  const series: Array<Record<string, unknown>> = [];

  for (let i = 1; i < layers.length; i += 1) {
    const prev = layers[i - 1];
    const layer = layers[i];
    const lower = prev.cumulative.map((value, index) => Math.min(value, layer.cumulative[index]));
    const height = prev.cumulative.map((value, index) => Math.abs(layer.cumulative[index] - value));
    const stack = `band-${layer.id}`;
    series.push({
      name: `${layer.name}·垫`,
      type: 'line',
      stack,
      smooth: true,
      symbol: 'none',
      data: lower.map((value) => Number(value.toFixed(2))),
      lineStyle: { width: 0, opacity: 0 },
      areaStyle: { opacity: 0 },
      itemStyle: { color: layer.color },
      silent: true,
      tooltip: { show: false },
      legendHoverLink: false,
    });
    series.push({
      name: `${layer.name}·带`,
      type: 'line',
      stack,
      smooth: true,
      symbol: 'none',
      data: height.map((value) => Number(value.toFixed(2))),
      lineStyle: { width: 0, opacity: 0 },
      areaStyle: { color: layer.color, opacity: 0.42 },
      itemStyle: { color: layer.color },
      silent: true,
      tooltip: { show: false },
      legendHoverLink: false,
    });
  }

  layers.forEach((layer, index) => {
    series.push({
      name: layer.name,
      type: 'line',
      smooth: true,
      symbol: 'none',
      z: 20 + index,
      data: layer.cumulative.map((value) => Number(value.toFixed(2))),
      lineStyle: {
        width: index === 0 ? 2.5 : 2.5,
        type: index === 0 ? 'dashed' : 'solid',
        color: layer.color,
      },
      itemStyle: { color: layer.color },
      emphasis: { focus: 'series' },
    });
  });

  return series;
}

export type TemporalWindow = {
  id: string;
  kind: 'point' | 'tick' | 'range' | 'open';
  startIndex: number;
  endIndex: number;
};

/** 相对锚点月把各支出 span 转成图轴下标窗口（供 impactTemporalSeries） */
export function buildTemporalWindows(
  expenses: SpanExpense[],
  opts: { today?: string; retirementDate?: string; anchorMonth?: string } = {},
): TemporalWindow[] {
  const anchor = monthToDate(opts.anchorMonth || todayMonthKey());
  return expenses.map((expense) => {
    const span = resolveExpenseSpan(expense, opts);
    return {
      id: expense.id,
      kind: span.kind,
      startIndex: calendarMonthsBetween(anchor, span.start),
      endIndex: calendarMonthsBetween(anchor, span.end),
    };
  });
}

function maskByWindow(
  values: number[],
  window: TemporalWindow | undefined,
): Array<number | null> {
  return values.map((value, index) => {
    const num = Number(value.toFixed(2));
    if (!window) return num;
    if (window.kind === 'point' || window.kind === 'tick') {
      return index === window.startIndex ? num : null;
    }
    if (window.kind === 'open') {
      return index >= window.startIndex ? num : null;
    }
    return index >= window.startIndex && index <= window.endIndex ? num : null;
  });
}

/**
 * 按时态渲染（绝对累计线，面积会重叠；保留给对照/旧调用）。
 * - 基线：虚线连续
 * - 单次/极短：时点散点（落在 startIndex）
 * - 有限区间 / 无限期：连续曲线（区间外为 null）
 */
export function impactTemporalSeries(
  layers: StackedLayerWithColor[],
  windows: TemporalWindow[],
) {
  const byId = new Map(windows.map((window) => [window.id, window]));
  const series: Array<Record<string, unknown>> = [];
  const baseline = layers[0];
  if (!baseline) return series;

  series.push({
    name: baseline.name,
    type: 'line',
    smooth: true,
    symbol: 'none',
    z: 10,
    data: baseline.cumulative.map((value) => Number(value.toFixed(2))),
    lineStyle: { width: 2.5, type: 'dashed', color: baseline.color },
    itemStyle: { color: baseline.color },
    areaStyle: { color: baseline.color, opacity: 0.08 },
  });

  for (let i = 1; i < layers.length; i += 1) {
    const layer = layers[i];
    const window = byId.get(layer.id);
    const masked = maskByWindow(layer.cumulative, window);
    const isPoint = window?.kind === 'point' || window?.kind === 'tick';

    if (isPoint) {
      series.push({
        name: layer.name,
        type: 'scatter',
        symbolSize: window?.kind === 'point' ? 16 : 12,
        z: 30 + i,
        data: masked,
        itemStyle: { color: layer.color, borderColor: '#fff', borderWidth: 1 },
        emphasis: { focus: 'series', scale: 1.2 },
      });
      continue;
    }

    series.push({
      name: layer.name,
      type: 'line',
      smooth: true,
      symbol: 'none',
      connectNulls: false,
      z: 20 + i,
      data: masked,
      lineStyle: { width: 2.5, color: layer.color },
      itemStyle: { color: layer.color },
      areaStyle: { color: layer.color, opacity: 0.14 },
      emphasis: { focus: 'series' },
    });
  }

  return series;
}

/** 堆叠用：窗口外写 0（高度为 0），避免 ECharts stack + null 错位 */
function maskDeltaForStack(
  values: number[],
  window: TemporalWindow | undefined,
): number[] {
  return values.map((value, index) => {
    const num = Number(value.toFixed(2));
    if (!window) return num;
    if (window.kind === 'point' || window.kind === 'tick') {
      return index === window.startIndex ? num : 0;
    }
    if (window.kind === 'open') {
      return index >= window.startIndex ? num : 0;
    }
    return index >= window.startIndex && index <= window.endIndex ? num : 0;
  });
}

/**
 * 按时态堆叠边际面积（同 stack id）：基线 delta + 各项 delta 互不重叠。
 * - 基线 / range / open：line + area，窗口外贡献为 0
 * - point / tick：scatter 标在 cumulative 高度（不参与 stack，避免尖刺）
 */
export function impactTemporalStackedSeries(
  layers: StackedLayerWithColor[],
  windows: TemporalWindow[],
) {
  const byId = new Map(windows.map((window) => [window.id, window]));
  const series: Array<Record<string, unknown>> = [];
  const baseline = layers[0];
  if (!baseline) return series;
  const stack = 'impact-temporal';

  series.push({
    name: baseline.name,
    type: 'line',
    stack,
    smooth: true,
    symbol: 'none',
    z: 10,
    data: baseline.delta.map((value) => Number(value.toFixed(2))),
    lineStyle: { width: 2.5, type: 'dashed', color: baseline.color },
    itemStyle: { color: baseline.color },
    areaStyle: { color: baseline.color, opacity: 0.35 },
  });

  for (let i = 1; i < layers.length; i += 1) {
    const layer = layers[i];
    const window = byId.get(layer.id);
    const isPoint = window?.kind === 'point' || window?.kind === 'tick';

    if (isPoint) {
      // 散点 y = 堆叠后累计高度，避免落在边际高度上
      series.push({
        name: layer.name,
        type: 'scatter',
        symbolSize: window?.kind === 'point' ? 16 : 12,
        z: 30 + i,
        data: maskByWindow(layer.cumulative, window),
        itemStyle: { color: layer.color, borderColor: '#fff', borderWidth: 1 },
        emphasis: { focus: 'series', scale: 1.2 },
      });
      continue;
    }

    series.push({
      name: layer.name,
      type: 'line',
      stack,
      smooth: true,
      symbol: 'none',
      connectNulls: false,
      z: 20 + i,
      data: maskDeltaForStack(layer.delta, window),
      lineStyle: { width: 2, color: layer.color },
      itemStyle: { color: layer.color },
      areaStyle: { color: layer.color, opacity: 0.42 },
      emphasis: { focus: 'series' },
    });
  }

  return series;
}

/**
 * 从最高支出累计线填到 100% 的结余带（全时段连续，不按时态裁剪）。
 * 支出率 > 100% 时高度为 0。返回垫高（静默）+ 结余面积两条 series。
 */
export function savingsFillTo100Series(
  topCumulative: number[],
  opts: { name?: string; color?: string } = {},
) {
  const name = opts.name ?? '结余';
  const color = opts.color ?? SAVINGS_COLOR;
  const lower = topCumulative.map((value) => Number((Number(value) || 0).toFixed(2)));
  const height = topCumulative.map((value) => {
    const expense = Number(value) || 0;
    return Number(Math.max(0, 100 - expense).toFixed(2));
  });
  const stack = 'savings-to-100';
  return [
    {
      name: `${name}·垫`,
      type: 'line',
      stack,
      smooth: true,
      symbol: 'none',
      z: 5,
      data: lower,
      lineStyle: { width: 0, opacity: 0 },
      areaStyle: { opacity: 0 },
      itemStyle: { color },
      silent: true,
      tooltip: { show: false },
      legendHoverLink: false,
    },
    {
      name,
      type: 'line',
      stack,
      smooth: true,
      symbol: 'none',
      z: 6,
      data: height,
      lineStyle: { width: 1.5, color },
      areaStyle: { color, opacity: 0.32 },
      itemStyle: { color },
      emphasis: { focus: 'series' },
    },
  ];
}

/**
 * 关键时点柱状：同柱堆叠。基线用累计值，其后每项用相对上一层的 delta。
 * 未纳入 layers 的 item 不会出现在 series 中。
 */
export function impactStackedBarSeries(
  layers: StackedLayerWithColor[],
  pointIndexes: number[],
) {
  return layers.map((layer, index) => ({
    name: layer.name,
    type: 'bar' as const,
    stack: 'impact',
    barMaxWidth: 40,
    itemStyle: { color: layer.color },
    emphasis: { focus: 'series' },
    data: pointIndexes.map((pointIndex) => {
      const raw = index === 0 ? layer.cumulative[pointIndex] : layer.delta[pointIndex];
      return Number((raw ?? 0).toFixed(2));
    }),
  }));
}

/** @deprecated 保留给旧调用；新图用 impactLineAndBandSeries */
export function stackedAreaSeries(layers: StackedLayerWithColor[]) {
  return impactLineAndBandSeries(layers);
}
