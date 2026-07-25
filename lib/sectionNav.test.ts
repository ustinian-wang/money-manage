/**
 * 分区 chip 高亮与 sticky 滚动偏移
 * 需求：first-visit-audit P1-4 / P1-8
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decideHeaderCollapsed,
  HEADER_COLLAPSE_MIN_INTERVAL_MS,
  nextHeaderCollapsed,
  pickActiveSection,
  stickyAwareScrollY,
} from './sectionNav';

const IDS = ['sec-params', 'sec-expenses', 'sec-charts'];

describe('pickActiveSection', () => {
  it('取最大 intersectionRatio', () => {
    assert.equal(
      pickActiveSection(IDS, { 'sec-params': 0.1, 'sec-expenses': 0.4, 'sec-charts': 0.2 }),
      'sec-expenses',
    );
  });

  it('ratio 全 0 时按距视口中线最近兜底', () => {
    assert.equal(
      pickActiveSection(
        IDS,
        { 'sec-params': 0, 'sec-expenses': 0, 'sec-charts': 0 },
        { 'sec-params': 400, 'sec-expenses': 120, 'sec-charts': 20 },
      ),
      'sec-charts',
    );
  });

  it('有正 ratio 时忽略距离兜底', () => {
    assert.equal(
      pickActiveSection(
        IDS,
        { 'sec-params': 0.05, 'sec-expenses': 0, 'sec-charts': 0.8 },
        { 'sec-params': 10, 'sec-expenses': 0, 'sec-charts': 500 },
      ),
      'sec-charts',
    );
  });
});

describe('stickyAwareScrollY', () => {
  it('减去 sticky 高度且不为负', () => {
    assert.equal(stickyAwareScrollY(100, 200, 80), 220);
    assert.equal(stickyAwareScrollY(10, 0, 80), 0);
  });
});

// 向下收起 / 向上展开；阈值内保持；近顶强制展开
describe('nextHeaderCollapsed', () => {
  it('向下超过阈值则收起', () => {
    assert.equal(nextHeaderCollapsed(false, 11, 80, 10), true);
  });

  it('向上超过阈值则展开', () => {
    assert.equal(nextHeaderCollapsed(true, -11, 80, 10), false);
  });

  it('阈值内保持原状', () => {
    assert.equal(nextHeaderCollapsed(false, 8, 80, 10), false);
    assert.equal(nextHeaderCollapsed(true, -8, 80, 10), true);
  });

  it('近页顶强制展开', () => {
    assert.equal(nextHeaderCollapsed(true, 20, 5, 10), false);
  });
});

// 最短切换间隔抑制抖动；近顶展开仍立即放行
describe('decideHeaderCollapsed', () => {
  it('间隔未满则保持原状', () => {
    const r = decideHeaderCollapsed({
      collapsed: false,
      deltaY: 20,
      scrollY: 80,
      nowMs: 100,
      lastSwitchMs: 0,
      minIntervalMs: HEADER_COLLAPSE_MIN_INTERVAL_MS,
    });
    assert.deepEqual(r, { collapsed: false, switched: false });
  });

  it('间隔已满则允许收起', () => {
    const r = decideHeaderCollapsed({
      collapsed: false,
      deltaY: 20,
      scrollY: 80,
      nowMs: HEADER_COLLAPSE_MIN_INTERVAL_MS,
      lastSwitchMs: 0,
    });
    assert.deepEqual(r, { collapsed: true, switched: true });
  });

  it('近顶展开不受间隔限制', () => {
    const r = decideHeaderCollapsed({
      collapsed: true,
      deltaY: 0,
      scrollY: 5,
      nowMs: 10,
      lastSwitchMs: 0,
      minIntervalMs: 300,
    });
    assert.deepEqual(r, { collapsed: false, switched: true });
  });
});
