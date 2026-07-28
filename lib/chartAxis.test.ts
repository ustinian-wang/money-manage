/**
 * 窄屏图轴：少刻度 +「第 N 年」/年标签
 * 需求：first-visit-audit P2-2 / 多视角评估 #8
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DESKTOP_MONTH_AXIS_INTERVAL,
  NARROW_MONTH_AXIS_INTERVAL,
  PERCENT_SHARE_Y_BASE_INTERVAL,
  PERCENT_SHARE_Y_MAX_SPLITS,
  formatAssetChartAxisLabel,
  formatYearMonthChartAxisLabel,
  monthAxisInterval,
  monthAxisRotate,
  niceCeilInterval,
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

// 占比 Y 轴：正常 / 轻度超支 / 极端首月 —— 段数 ≤ MAX_SPLITS
describe('percentShareYAxis', () => {
  it('正常 0～100：步长 20，端点贴齐', () => {
    const axis = percentShareYAxis(0, 100);
    assert.deepEqual(axis, { min: 0, max: 100, interval: PERCENT_SHARE_Y_BASE_INTERVAL });
    assert.ok((axis.max - axis.min) / axis.interval <= PERCENT_SHARE_Y_MAX_SPLITS);
  });

  it('轻度超支（剩余 −20～100 / 支出至 120）：抬高步长且刻度不多', () => {
    const remain = percentShareYAxis(-20, 100);
    assert.ok(remain.interval >= PERCENT_SHARE_Y_BASE_INTERVAL);
    assert.ok(remain.min <= -20);
    assert.ok(remain.max >= 100);
    assert.ok((remain.max - remain.min) / remain.interval <= PERCENT_SHARE_Y_MAX_SPLITS);

    const expense = percentShareYAxis(0, 120);
    assert.ok(expense.interval >= PERCENT_SHARE_Y_BASE_INTERVAL);
    assert.ok(expense.max >= 120);
    assert.ok((expense.max - expense.min) / expense.interval <= PERCENT_SHARE_Y_MAX_SPLITS);
  });

  it('极端首月超支：大跨度仍 ≤5 段，避免上百个 20% 小格', () => {
    const cash = percentShareYAxis(0, 2000);
    assert.ok(cash.interval >= 100);
    assert.equal((cash.max - cash.min) / cash.interval <= PERCENT_SHARE_Y_MAX_SPLITS, true);

    const remain = percentShareYAxis(-800, 100);
    assert.ok(remain.interval >= 100);
    assert.ok(remain.min <= -800);
    assert.ok((remain.max - remain.min) / remain.interval <= PERCENT_SHARE_Y_MAX_SPLITS);
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
