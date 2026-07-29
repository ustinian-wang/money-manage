/**
 * 吸顶顶栏收起/展开：纯函数契约
 * 需求：下滑收起、上滑展开；近顶始终展开
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { nextHeaderCollapsed } from './scrollHideHeader';

describe('nextHeaderCollapsed 顶栏随滚动显隐', () => {
  test('近顶（scrollY≤topShow）始终展开', () => {
    assert.equal(nextHeaderCollapsed(true, 0, 100), false);
    assert.equal(nextHeaderCollapsed(true, 24, 80), false);
    assert.equal(nextHeaderCollapsed(false, 10, 0), false);
  });

  test('下滑超过阈值则收起', () => {
    assert.equal(nextHeaderCollapsed(false, 100, 80), true);
    assert.equal(nextHeaderCollapsed(false, 90, 85), false); // delta=5 < 8
  });

  test('上滑超过阈值则展开', () => {
    assert.equal(nextHeaderCollapsed(true, 80, 100), false);
    assert.equal(nextHeaderCollapsed(true, 95, 100), true); // delta=-5 > -8
  });

  test('未达阈值保持原状', () => {
    assert.equal(nextHeaderCollapsed(true, 120, 118), true);
    assert.equal(nextHeaderCollapsed(false, 120, 118), false);
  });

  test('非法 scrollY 当 0，近顶展开', () => {
    assert.equal(nextHeaderCollapsed(true, Number.NaN, 50), false);
  });
});
