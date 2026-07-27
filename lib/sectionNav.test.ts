/**
 * 分区 chip 高亮与 sticky 滚动偏移
 * 需求：first-visit-audit P1-4 / P1-8
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickActiveSection, stickyAwareScrollY } from './sectionNav';

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
