/**
 * 删除确认文案：支出/快照摘要
 * 需求：删除前确认须说清名称与金额摘要
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expenseDeleteMessage, snapshotDeleteMessage } from './deleteConfirm';

describe('expenseDeleteMessage', () => {
  it('含名称、类型与金额摘要；空名用未命名', () => {
    const msg = expenseDeleteMessage('', '固定金额', '¥1,000');
    assert.match(msg, /未命名/);
    assert.match(msg, /固定金额 · ¥1,000/);
    assert.match(msg, /取消不删除/);
  });
});

describe('snapshotDeleteMessage', () => {
  it('含名称、日期与工资摘要', () => {
    const msg = snapshotDeleteMessage('涨薪', '2027-01-01', '税前工资 ¥10,000 → ¥12,000');
    assert.match(msg, /「涨薪」/);
    assert.match(msg, /2027-01-01/);
    assert.match(msg, /¥10,000 → ¥12,000/);
  });
});
