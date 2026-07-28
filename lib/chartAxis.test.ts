/**
 * 窄屏图轴：少刻度 +「第 N 年」/年标签
 * 需求：first-visit-audit P2-2 / 多视角评估 #8
 * 占比 Y：关注带 ±100，带外只标数值
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DESKTOP_MONTH_AXIS_INTERVAL,
  NARROW_MONTH_AXIS_INTERVAL,
  PERCENT_SHARE_Y_BASE_INTERVAL,
  PERCENT_SHARE_Y_FOCUS_MAX,
  PERCENT_SHARE_Y_FOCUS_MIN,
  PERCENT_SHARE_Y_MAX_SPLITS,
  formatAssetChartAxisLabel,
  formatYearMonthChartAxisLabel,
  monthAxisInterval,
  monthAxisRotate,
  niceCeilInterval,
  percentShareOverflowMarks,
  percentShareYAxis,
} from './chartAxis';

describe('monthAxisInterval', () => {
  it('桌面每年一刻度（interval 11）；窄屏每 5 年（interval 59）', () => {
    assert.equal(monthAxisInterval(false), DESKTOP_MONTH_AXIS_INTERVAL);
    assert.equal(monthAxisInterval(true), NARROW_MONTH_AXIS_INTERVAL);
    assert.equal(DESKTOP_MONTH_AXIS_INTERVAL, 11);
    assert.equal(NARROW_MONTH_AXIS_INTERVAL, 59);
  });
});

describe('monthAxisRotate', () => {
  it('桌面倾斜可读；窄屏年标签水平', () => {
    assert.equal(monthAxisRotate(false), 40);
    assert.equal(monthAxisRotate(true), 0);
  });
});

describe('formatAssetChartAxisLabel', () => {
  it('桌面原样保留「现在」与「N年M个月」', () => {
    assert.equal(formatAssetChartAxisLabel('现在', false), '现在');
    assert.equal(formatAssetChartAxisLabel('5年0个月', false), '5年0个月');
    assert.equal(formatAssetChartAxisLabel('1年3个月', false), '1年3个月');
  });

  it('窄屏：现在不变；整年 →「第N年」', () => {
    assert.equal(formatAssetChartAxisLabel('现在', true), '现在');
    assert.equal(formatAssetChartAxisLabel('1年0个月', true), '第1年');
    assert.equal(formatAssetChartAxisLabel('5年0个月', true), '第5年');
    assert.equal(formatAssetChartAxisLabel('30年0个月', true), '第30年');
  });

  it('窄屏非整年亦缩短为「第N年」（靠 interval 过滤）', () => {
    assert.equal(formatAssetChartAxisLabel('2年6个月', true), '第2年');
  });
});

describe('formatYearMonthChartAxisLabel', () => {
  it('桌面保留 YYYY-MM', () => {
    assert.equal(formatYearMonthChartAxisLabel('2026-01', false), '2026-01');
    assert.equal(formatYearMonthChartAxisLabel('2031-07', false), '2031-07');
  });

  it('窄屏改为「YYYY年」年标签', () => {
    assert.equal(formatYearMonthChartAxisLabel('2026-01', true), '2026年');
    assert.equal(formatYearMonthChartAxisLabel('2031-07', true), '2031年');
  });
});

// 占比 Y 轴：正常 / 带内轻度 / 带外极端 —— 轴夹 ±100，段数 ≤ MAX_SPLITS
describe('percentShareYAxis', () => {
  it('正常 0～100：步长 20，端点贴齐', () => {
    const axis = percentShareYAxis(0, 100);
    assert.deepEqual(axis, { min: 0, max: 100, interval: PERCENT_SHARE_Y_BASE_INTERVAL });
    assert.ok((axis.max - axis.min) / axis.interval <= PERCENT_SHARE_Y_MAX_SPLITS);
  });

  it('关注带内轻度超支（剩余 −20～100 / 支出至 120 夹到 100）：刻度不多', () => {
    const remain = percentShareYAxis(-20, 100);
    assert.ok(remain.interval >= PERCENT_SHARE_Y_BASE_INTERVAL);
    assert.ok(remain.min <= -20);
    assert.ok(remain.max >= 100);
    assert.ok((remain.max - remain.min) / remain.interval <= PERCENT_SHARE_Y_MAX_SPLITS);

    // 120 超出 FOCUS_MAX → 轴仍顶在 100，不拉到 120
    const expense = percentShareYAxis(0, 120);
    assert.equal(expense.max, PERCENT_SHARE_Y_FOCUS_MAX);
    assert.ok(expense.interval >= PERCENT_SHARE_Y_BASE_INTERVAL);
    assert.ok((expense.max - expense.min) / expense.interval <= PERCENT_SHARE_Y_MAX_SPLITS);
  });

  it('极端超支/深度负区：轴夹在 ±100，不把跨度拉到上千', () => {
    const cash = percentShareYAxis(0, 2000);
    assert.equal(cash.min, 0);
    assert.equal(cash.max, PERCENT_SHARE_Y_FOCUS_MAX);
    assert.equal(cash.interval, PERCENT_SHARE_Y_BASE_INTERVAL);
    assert.ok((cash.max - cash.min) / cash.interval <= PERCENT_SHARE_Y_MAX_SPLITS);

    // −100～100 跨度 200 → nice 步长 50（约 4 段），而非上千跨度
    const remain = percentShareYAxis(-800, 100);
    assert.equal(remain.min, PERCENT_SHARE_Y_FOCUS_MIN);
    assert.equal(remain.max, PERCENT_SHARE_Y_FOCUS_MAX);
    assert.equal(remain.interval, 50);
    assert.ok((remain.max - remain.min) / remain.interval <= PERCENT_SHARE_Y_MAX_SPLITS);
  });
});

describe('percentShareOverflowMarks', () => {
  it('带内点不产出；带外点 coord.y 贴边、value 为真实值', () => {
    const marks = percentShareOverflowMarks([
      { label: '2026-01', value: 80 },
      { label: '2026-02', value: 250 },
      { label: '2026-03', value: -150 },
      { label: '2026-04', value: -100 },
      { label: '2026-05', value: 100 },
    ]);
    assert.equal(marks.length, 2);
    assert.deepEqual(marks[0], {
      name: '溢出',
      coord: ['2026-02', PERCENT_SHARE_Y_FOCUS_MAX],
      value: 250,
    });
    assert.deepEqual(marks[1], {
      name: '溢出',
      coord: ['2026-03', PERCENT_SHARE_Y_FOCUS_MIN],
      value: -150,
    });
  });
});

describe('niceCeilInterval', () => {
  it('1-2-5 抬升；非正回落 BASE', () => {
    assert.equal(niceCeilInterval(20), 20);
    assert.equal(niceCeilInterval(24), 50);
    assert.equal(niceCeilInterval(400), 500);
    assert.equal(niceCeilInterval(0), PERCENT_SHARE_Y_BASE_INTERVAL);
  });
});
