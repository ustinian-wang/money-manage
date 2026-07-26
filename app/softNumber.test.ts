/**
 * 软数字：删 0→空→blur 变 0；编辑中空视同 0；非法 blur 恢复原值
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { softNumberCommit, softNumberIsInvalid, softNumberLive } from './softNumber';

test('编辑中空串视同 0，可继续输入', () => {
  assert.equal(softNumberLive(''), 0);
  assert.equal(softNumberLive('  '), 0);
  assert.equal(softNumberLive('12'), 12);
  assert.equal(softNumberLive('0'), 0);
});

test('编辑中非法不落数（返回 null）', () => {
  assert.equal(softNumberLive('abc'), null);
  assert.equal(softNumberLive('--'), null);
});

test('blur/commit：空 → 0', () => {
  assert.equal(softNumberCommit(''), 0);
  assert.equal(softNumberCommit('  '), 0);
  assert.equal(softNumberCommit('3.5'), 3.5);
});

test('blur/commit：非法无 fallback 时落 0（兼容）', () => {
  assert.equal(softNumberCommit('abc'), 0);
});

test('blur/commit：非法有 fallback 时恢复原值', () => {
  assert.equal(softNumberCommit('abc', 6.5), 6.5);
  assert.equal(softNumberCommit('--', 12), 12);
  assert.equal(softNumberCommit('8', 12), 8);
});

test('softNumberIsInvalid：非空且不可解析', () => {
  assert.equal(softNumberIsInvalid(''), false);
  assert.equal(softNumberIsInvalid('12'), false);
  assert.equal(softNumberIsInvalid('abc'), true);
  assert.equal(softNumberIsInvalid('--'), true);
});
