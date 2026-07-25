/**
 * 软数字：删 0→空→blur 变 0；编辑中空视同 0
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { softNumberCommit, softNumberLive } from './softNumber';

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

test('blur/commit：空或非法修正为 0', () => {
  assert.equal(softNumberCommit(''), 0);
  assert.equal(softNumberCommit('  '), 0);
  assert.equal(softNumberCommit('abc'), 0);
  assert.equal(softNumberCommit('3.5'), 3.5);
});
