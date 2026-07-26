/**
 * 数值字段 UX：一律原地 inline；不为 slider 弹窗
 * 有明确 min/max → blur clamp；无 max 不设上界
 * 展示数值与单位分离（formatEditableNumber 不含 %/个月 等）
 * blur：空→0；非法→fallback 原值（与 Editable / softNumberCommit 对齐）
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { clampNumberField, formatEditableNumber, showsNumberSlider, usesInlineNumberEdit } from './numberFieldUi';
import { softNumberCommit, softNumberIsInvalid } from './softNumber';

test('自由字段不展示滚动条', () => {
  assert.equal(showsNumberSlider('free'), false);
  assert.equal(showsNumberSlider(), false);
});

test('rangedPercent 也不出滚动条（不为 slider 弹窗）', () => {
  assert.equal(showsNumberSlider('rangedPercent'), false);
});

test('自由字段走 inline，不弹层', () => {
  assert.equal(usesInlineNumberEdit('free'), true);
  assert.equal(usesInlineNumberEdit(), true);
});

test('rangedPercent 也走 inline（年化收益等只改一个数）', () => {
  assert.equal(usesInlineNumberEdit('rangedPercent'), true);
  assert.equal(showsNumberSlider('rangedPercent'), false);
});

test('展示数值不含单位（单位由 UI 外置）', () => {
  assert.equal(formatEditableNumber(12345), '12,345');
  assert.equal(formatEditableNumber(12.5), '12.5');
  assert.ok(!formatEditableNumber(6).includes('%'));
  assert.ok(!formatEditableNumber(6).includes('月'));
});

test('自由金额无 max：不设上界', () => {
  assert.equal(clampNumberField(500000, { min: 0 }), 500000);
  assert.equal(clampNumberField(3_000_000, { min: 0 }), 3_000_000);
  assert.equal(clampNumberField(-1, { min: 0 }), 0);
});

test('有业务 max 仍可 clamp，但不因此出滚动条（如应急月数）', () => {
  assert.equal(clampNumberField(40, { min: 0, max: 36 }), 36);
  assert.equal(showsNumberSlider('free'), false);
  assert.equal(usesInlineNumberEdit('free'), true);
});

test('百分比范围字段 clamp：受 [min,max] 约束', () => {
  assert.equal(clampNumberField(120, { min: 0, max: 100 }), 100);
  assert.equal(clampNumberField(-5, { min: 5, max: 12 }), 5);
  assert.equal(clampNumberField(8, { min: 5, max: 12 }), 8);
});

// blur 保存路径：空→0；非法→原值；合法→clamp
test('blur 保存：空落 0 再 clamp；非法恢复原值', () => {
  assert.equal(clampNumberField(softNumberCommit(''), { min: 0 }), 0);
  assert.equal(softNumberIsInvalid('abc'), true);
  assert.equal(softNumberCommit('abc', 6.5), 6.5);
  assert.equal(clampNumberField(softNumberCommit('12.5', 0), { min: 0, max: 36 }), 12.5);
  assert.equal(clampNumberField(softNumberCommit('99', 0), { min: 0, max: 36 }), 36);
});
