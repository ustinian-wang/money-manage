/**
 * 顺序归因：前缀支出列表与堆叠层 delta / 配色
 * 需求：多 item 勾选分析 — 基线在下，按序边际增量；每项固定色
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPrefixExpenses,
  colorForItemId,
  impactLineAndBandSeries,
  impactStackedBarSeries,
  impactTemporalSeries,
  toStackedLayersColored,
} from './sequentialImpact.ts';

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
