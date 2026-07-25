/**
 * visualViewport 键盘 inset + 焦点滚入可视区
 * 需求：money-manage 移动端键盘顶起兼容
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { calcFocusScrollDelta, calcKeyboardInset } from './useVisualViewport';

describe('calcKeyboardInset 键盘顶起', () => {
  test('visualViewport 变矮时得到正 inset', () => {
    // layout 800，可视 500，offset 0 → 键盘约占 300
    assert.equal(calcKeyboardInset(800, 500, 0), 300);
  });

  test('无键盘时 inset 为 0', () => {
    assert.equal(calcKeyboardInset(800, 800, 0), 0);
  });

  test('含 offsetTop 时不重复扣减', () => {
    // Safari 偶发 offsetTop>0；inner - height - offset
    assert.equal(calcKeyboardInset(800, 500, 50), 250);
  });
});

describe('calcFocusScrollDelta 焦点落在 VV 内', () => {
  test('底边低于可视底 → 正增量（向下滚）', () => {
    // 可见顶 14、底 386；控件底 430 → 下滚 44
    assert.equal(calcFocusScrollDelta(380, 430, 14, 386), 44);
  });

  test('已在可视区内 → 0', () => {
    assert.equal(calcFocusScrollDelta(100, 140, 14, 386), 0);
  });

  test('顶边高于可视顶 → 负增量（向上滚）', () => {
    assert.equal(calcFocusScrollDelta(0, 40, 14, 386), -14);
  });
});
