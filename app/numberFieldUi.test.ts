/**
 * 数值字段 UX：自由金额无 max/无 slider；百分比范围联动才有 slider
 * 需求：自由输入不限制最大值也不出滚动条；有范围且与百分比联动才出滚动条
 * 补充：free → Editable 原地 inline；rangedPercent → 仍弹层
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { clampNumberField, showsNumberSlider, usesInlineNumberEdit } from './numberFieldUi';
import { softNumberCommit } from './softNumber';

test('自由字段不展示滚动条', () => {
  assert.equal(showsNumberSlider('free'), false);
  assert.equal(showsNumberSlider(), false);
});

test('百分比范围联动字段展示滚动条', () => {
  assert.equal(showsNumberSlider('rangedPercent'), true);
});

test('自由字段走 inline，不弹层', () => {
  assert.equal(usesInlineNumberEdit('free'), true);
  assert.equal(usesInlineNumberEdit(), true);
});

test('rangedPercent 不走 inline，仍弹层+slider', () => {
  assert.equal(usesInlineNumberEdit('rangedPercent'), false);
  assert.equal(showsNumberSlider('rangedPercent'), true);
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

// blur 保存路径：softNumberCommit → clampNumberField（与 Editable.onDraftBlur 对齐）
test('blur 保存：空/非法落 0 再 clamp', () => {
  assert.equal(clampNumberField(softNumberCommit(''), { min: 0 }), 0);
  assert.equal(clampNumberField(softNumberCommit('abc'), { min: 0 }), 0);
  assert.equal(clampNumberField(softNumberCommit('12.5'), { min: 0, max: 36 }), 12.5);
  assert.equal(clampNumberField(softNumberCommit('99'), { min: 0, max: 36 }), 36);
});
