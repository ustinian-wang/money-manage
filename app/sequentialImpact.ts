/**
 * 多支出顺序归因：基线 + 按 item 顺序的前缀汇总，相邻层差 = 边际增量。
 * 每项固定颜色；曲线为累计线，色带为相邻累计之间的面积。
 */

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
 * 按时态渲染：
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
