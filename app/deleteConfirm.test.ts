/**
 * 删除确认文案：支出摘要
 * 需求：删除前确认须说清名称与金额摘要
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expenseDeleteMessage } from './deleteConfirm';

describe('expenseDeleteMessage', () => {
  it('含名称、类型与金额摘要；空名用未命名', () => {
    const msg = expenseDeleteMessage('', '固定金额', '¥1,000');
    assert.match(msg, /未命名/);
    assert.match(msg, /固定金额 · ¥1,000/);
    assert.match(msg, /取消不删除/);
  });
});
