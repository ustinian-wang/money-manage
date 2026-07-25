/**
 * visualViewport 键盘 inset 推算
 * 需求：money-manage 移动端键盘顶起兼容
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { calcKeyboardInset } from './useVisualViewport';

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
