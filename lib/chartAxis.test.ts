/**
 * 窄屏图轴：少刻度 +「第 N 年」/年标签
 * 需求：first-visit-audit P2-2 / 多视角评估 #8
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DESKTOP_MONTH_AXIS_INTERVAL,
  NARROW_MONTH_AXIS_INTERVAL,
  formatAssetChartAxisLabel,
  formatYearMonthChartAxisLabel,
  monthAxisInterval,
  monthAxisRotate,
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
