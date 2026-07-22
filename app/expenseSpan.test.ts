/**
 * 支出时间区间：一次性/分期起止、退休前截断、时间轴短区间
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildTimelineMarks,
  clampInstallmentTerm,
  isActiveInMonth,
  maxTermBeforeRetirement,
  resolveExpenseSpan,
} from './expenseSpan.ts';

describe('resolveExpenseSpan', () => {
  it('一次性默认同月且为 point', () => {
    const span = resolveExpenseSpan(
      { id: '1', mode: 'one_time', startDate: '2026-07-15' },
      { today: '2026-07-22' },
    );
    assert.equal(span.start, '2026-07-15');
    assert.equal(span.end, '2026-07-15');
    assert.equal(span.kind, 'point');
  });

  it('一次性未设时间时默认为当前月 1 号', () => {
    const span = resolveExpenseSpan(
      { id: '1b', mode: 'one_time' },
      { today: '2026-07-22' },
    );
    assert.equal(span.start, '2026-07-01');
    assert.equal(span.end, '2026-07-01');
    assert.equal(span.kind, 'point');
  });

  it('分期 followRetirement 会截断期数', () => {
    const span = resolveExpenseSpan(
      {
        id: '2',
        mode: 'installment',
        startDate: '2026-07-01',
        term: 360,
        followRetirement: true,
      },
      { today: '2026-07-01', retirementDate: '2030-07-01' },
    );
    assert.equal(span.termMonths, maxTermBeforeRetirement('2026-07-01', '2030-07-01'));
    assert.ok(span.termMonths < 360);
    assert.equal(span.kind, 'range');
  });

  it('1 期分期为 point，2–3 期为 tick', () => {
    const one = resolveExpenseSpan({ id: 'a', mode: 'installment', startDate: '2026-01-01', term: 1 });
    const two = resolveExpenseSpan({ id: 'b', mode: 'installment', startDate: '2026-01-01', term: 2 });
    assert.equal(one.kind, 'point');
    assert.equal(two.kind, 'tick');
  });

  it('固定无结束为 open 连续', () => {
    const span = resolveExpenseSpan(
      { id: 'f', mode: 'fixed', startDate: '2026-07-01' },
      { today: '2026-07-01' },
    );
    assert.equal(span.kind, 'open');
    assert.equal(span.openEnded, true);
  });
});

describe('clampInstallmentTerm / isActiveInMonth', () => {
  it('未开启 followRetirement 不截断', () => {
    assert.equal(clampInstallmentTerm('2026-01-01', 120, false, '2030-01-01'), 120);
  });

  it('指定月只命中区间内支出', () => {
    const oneTime = { id: 'o', mode: 'one_time' as const, startDate: '2026-07-01' };
    assert.equal(isActiveInMonth(oneTime, '2026-07'), true);
    assert.equal(isActiveInMonth(oneTime, '2026-08'), false);
  });
});

describe('buildTimelineMarks', () => {
  it('短区间标记 kind 与颜色', () => {
    const marks = buildTimelineMarks(
      [{ id: 'o', name: '一次', mode: 'one_time', startDate: '2026-07-01' }],
      { o: '#f07f62' },
      { anchorMonth: '2026-07', today: '2026-07-01' },
    );
    assert.equal(marks.length, 1);
    assert.equal(marks[0].kind, 'point');
    assert.equal(marks[0].color, '#f07f62');
  });
});
