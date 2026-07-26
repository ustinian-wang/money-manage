/**
 * 单字段文本 UX：一律原地 inline；blur 空值按 allowEmpty 落空或恢复
 * 需求：与数值 Editable 一致——点 → input → blur/Enter 保存，不弹 FloatPanel
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { commitTextField, formatTextFieldDisplay, usesInlineTextEdit } from './textFieldUi';

test('纯文本走 inline，不弹层', () => {
  assert.equal(usesInlineTextEdit(), true);
});

test('展示：空串用占位，非空原样', () => {
  assert.equal(formatTextFieldDisplay('', '未命名'), '未命名');
  assert.equal(formatTextFieldDisplay('房租', '未命名'), '房租');
});

test('blur 保存：允许空 → trim 后可落空串', () => {
  assert.equal(commitTextField('  ', '房租', { allowEmpty: true }), '');
  assert.equal(commitTextField(' 水电 ', 'x', { allowEmpty: true }), '水电');
});

test('blur 保存：不允许空 → 空恢复原值', () => {
  assert.equal(commitTextField('', '房租', { allowEmpty: false }), '房租');
  assert.equal(commitTextField('   ', '房租', { allowEmpty: false }), '房租');
  assert.equal(commitTextField(' 新名 ', '房租', { allowEmpty: false }), '新名');
});

test('默认 allowEmpty=true（支出名称/分类可空）', () => {
  assert.equal(commitTextField('', '原值'), '');
});
