/**
 * 顺序归因：前缀支出列表与堆叠层 delta / 配色
 * 需求：多 item 勾选分析 — 基线在下，按序边际增量；每项固定色
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPrefixExpenses,
  buildTemporalWindows,
  colorForItemId,
  impactLineAndBandSeries,
  impactStackedBarSeries,
  impactTemporalSeries,
  impactTemporalStackedSeries,
  remainInvestSpendableSeries,
  splitRemainByInvestRate,
  INVEST_SHARE_COLOR,
  INVEST_SHARE_NAME,
  SPENDABLE_REMAIN_NAME,
  savingsFillTo100Series,
  SAVINGS_COLOR,
  toStackedLayersColored,
} from './sequentialImpact';

describe('buildPrefixExpenses 前缀支出', () => {
  const all = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const selected = [{ id: 'b' }, { id: 'd' }];

  it('overlay 基线去掉全部勾选，再按序加回', () => {
    assert.deepEqual(buildPrefixExpenses(all, selected, 0, 'overlay').map((x) => x.id), ['a', 'c']);
    assert.deepEqual(buildPrefixExpenses(all, selected, 1, 'overlay').map((x) => x.id), ['a', 'c', 'b']);
    assert.deepEqual(buildPrefixExpenses(all, selected, 2, 'overlay').map((x) => x.id), ['a', 'c', 'b', 'd']);
  });

  it('isolated 仅含前缀勾选', () => {
    assert.deepEqual(buildPrefixExpenses(all, selected, 0, 'isolated'), []);
    assert.deepEqual(buildPrefixExpenses(all, selected, 1, 'isolated').map((x) => x.id), ['b']);
    assert.deepEqual(buildPrefixExpenses(all, selected, 2, 'isolated').map((x) => x.id), ['b', 'd']);
  });
});

describe('toStackedLayersColored 边际增量与配色', () => {
  it('相邻累计差等于 item 增量，且 item 色随全表下标稳定', () => {
    const allIds = ['A', 'B', 'C'];
    const layers = toStackedLayersColored(
      [[100, 100], [90, 80], [70, 50]],
      [{ id: 'A', name: '支出A' }, { id: 'B', name: '支出B' }],
      allIds,
    );
    assert.equal(layers.length, 3);
    assert.equal(layers[0].id, 'baseline');
    assert.deepEqual(layers[0].delta, [100, 100]);
    assert.deepEqual(layers[1].delta, [-10, -20]);
    assert.deepEqual(layers[2].delta, [-20, -30]);
    assert.equal(layers[1].color, colorForItemId('A', allIds));
    assert.equal(layers[2].color, colorForItemId('B', allIds));
    assert.notEqual(layers[1].color, layers[2].color);
  });
});

describe('impactLineAndBandSeries 曲线与色带', () => {
  it('每项有累计曲线，且有成对垫高+色带系列', () => {
    const layers = toStackedLayersColored(
      [[100], [90], [70]],
      [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }],
      ['A', 'B'],
    );
    const series = impactLineAndBandSeries(layers);
    const names = series.map((row) => String(row.name));
    assert.ok(names.includes('基线（不含勾选）'));
    assert.ok(names.includes('A'));
    assert.ok(names.includes('B'));
    assert.ok(names.includes('A·带'));
    assert.ok(names.includes('B·带'));
  });
});

describe('impactTemporalSeries 时点与连续', () => {
  it('point 用 scatter，open/range 用 line 且区间外为 null', () => {
    const layers = toStackedLayersColored(
      [[100, 100, 100], [90, 80, 70], [90, 75, 60]],
      [{ id: 'once', name: '一次' }, { id: 'rent', name: '房租' }],
      ['once', 'rent'],
    );
    const series = impactTemporalSeries(layers, [
      { id: 'once', kind: 'point', startIndex: 1, endIndex: 1 },
      { id: 'rent', kind: 'open', startIndex: 0, endIndex: 2 },
    ]);
    const once = series.find((row) => row.name === '一次');
    const rent = series.find((row) => row.name === '房租');
    assert.equal(once?.type, 'scatter');
    assert.deepEqual(once?.data, [null, 80, null]);
    assert.equal(rent?.type, 'line');
    assert.deepEqual(rent?.data, [90, 75, 60]);
  });
});

// 堆叠边际：同 stack，窗口外为 0；单月散点落在 cumulative
describe('impactTemporalStackedSeries 堆叠面积不重叠', () => {
  it('基线与区间层同 stack 用 delta，窗口外为 0；point 散点 y 为 cumulative', () => {
    const layers = toStackedLayersColored(
      [[40, 40, 40], [50, 55, 60], [50, 70, 80]],
      [{ id: 'once', name: '一次' }, { id: 'rent', name: '房租' }],
      ['once', 'rent'],
    );
    const series = impactTemporalStackedSeries(layers, [
      { id: 'once', kind: 'point', startIndex: 1, endIndex: 1 },
      { id: 'rent', kind: 'range', startIndex: 1, endIndex: 2 },
    ]);
    const baseline = series.find((row) => row.name === '基线（不含勾选）');
    const once = series.find((row) => row.name === '一次');
    const rent = series.find((row) => row.name === '房租');
    assert.equal(baseline?.stack, 'impact-temporal');
    assert.deepEqual(baseline?.data, [40, 40, 40]);
    assert.equal(once?.type, 'scatter');
    assert.deepEqual(once?.data, [null, 55, null]);
    assert.equal(rent?.type, 'line');
    assert.equal(rent?.stack, 'impact-temporal');
    // rent delta = [0, 15, 20]；range 从 index 1 起，窗口外 index0 → 0
    assert.deepEqual(rent?.data, [0, 15, 20]);
  });
});

// 投资占比：投资层 = 剩余可支配 × 比例（不是直接占满幅 100%）
describe('splitRemainByInvestRate / remainInvestSpendableSeries', () => {
  it('支出 60%、投资比例 30% → 投资层 12、可花费 28', () => {
    const split = splitRemainByInvestRate(60, 30);
    assert.equal(split.remainPct, 40);
    assert.equal(split.investPct, 12);
    assert.equal(split.spendablePct, 28);
  });

  it('支出 ≥ 100% 时投资与可花费均为 0', () => {
    assert.deepEqual(splitRemainByInvestRate(100, 30), { remainPct: 0, investPct: 0, spendablePct: 0 });
    assert.deepEqual(splitRemainByInvestRate(120, 30), { remainPct: 0, investPct: 0, spendablePct: 0 });
  });

  it('可支配收入 ≤ 0 时两层均为 0', () => {
    assert.deepEqual(splitRemainByInvestRate(40, 30, 0), { remainPct: 0, investPct: 0, spendablePct: 0 });
  });

  it('系列：垫高在支出顶，投资与可花费之和等于剩余', () => {
    const series = remainInvestSpendableSeries([60, 100], 30);
    assert.equal(series.length, 3);
    assert.equal(series[0].name, `${INVEST_SHARE_NAME}·垫`);
    assert.deepEqual(series[0].data, [60, 100]);
    assert.equal(series[1].name, INVEST_SHARE_NAME);
    assert.deepEqual(series[1].data, [12, 0]);
    assert.equal(series[1].itemStyle?.color, INVEST_SHARE_COLOR);
    assert.equal(series[2].name, SPENDABLE_REMAIN_NAME);
    assert.deepEqual(series[2].data, [28, 0]);
    assert.equal(series[1].stack, 'savings-to-100');
    assert.equal(series[2].stack, 'savings-to-100');
  });
});

// 结余带：最高支出累计 → 100%；超支月高度为 0；全时段连续
describe('savingsFillTo100Series 结余填满 100%', () => {
  it('高度 = max(0, 100 − 支出累计)，垫高静默且色为 SAVINGS_COLOR', () => {
    const series = savingsFillTo100Series([60, 100, 120]);
    assert.equal(series.length, 2);
    const pad = series[0];
    const fill = series[1];
    assert.equal(pad.name, '结余·垫');
    assert.deepEqual(pad.data, [60, 100, 120]);
    assert.equal(pad.silent, true);
    assert.equal(fill.name, '结余');
    assert.deepEqual(fill.data, [40, 0, 0]);
    assert.equal(fill.itemStyle?.color, SAVINGS_COLOR);
    assert.equal(fill.stack, 'savings-to-100');
    assert.equal(pad.stack, 'savings-to-100');
  });
});

describe('buildTemporalWindows 支出 → 图轴窗口', () => {
  it('单月一次性映射为 point 且仅该月下标', () => {
    const windows = buildTemporalWindows(
      [{ id: 'gift', mode: 'one_time', startDate: '2026-09-01' }],
      { anchorMonth: '2026-07', today: '2026-07-01' },
    );
    assert.equal(windows.length, 1);
    assert.equal(windows[0].kind, 'point');
    assert.equal(windows[0].startIndex, 2);
    assert.equal(windows[0].endIndex, 2);
  });
});

describe('impactStackedBarSeries 同柱色块', () => {
  it('基线用累计、其后用 delta，且仅含传入 layers', () => {
    const layers = toStackedLayersColored(
      [[100, 200], [90, 160], [70, 100]],
      [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }],
      ['A', 'B'],
    );
    const series = impactStackedBarSeries(layers, [0, 1]);
    assert.equal(series.length, 3);
    assert.deepEqual(series[0].data, [100, 200]);
    assert.deepEqual(series[1].data, [-10, -40]);
    assert.deepEqual(series[2].data, [-20, -60]);
    assert.ok(series.every((row) => row.stack === 'impact'));
  });
});
