/**
 * 浮层进出场 presence 规则
 * 需求：关闭时不要立刻卸载，留退场动画；减少动态效果时 delay=0
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OVERLAY_EXIT_MS,
  overlayExitDelayMs,
  resolveOverlayPresence,
} from './overlayPresence.ts';

describe('resolveOverlayPresence', () => {
  it('打开：挂载且 state=open', () => {
    assert.deepEqual(resolveOverlayPresence(true, false), {
      present: true,
      state: 'open',
      scheduleExit: false,
    });
    assert.deepEqual(resolveOverlayPresence(true, true), {
      present: true,
      state: 'open',
      scheduleExit: false,
    });
  });

  it('从未打开过就关闭：保持未挂载', () => {
    assert.deepEqual(resolveOverlayPresence(false, false), {
      present: false,
      state: 'closed',
      scheduleExit: false,
    });
  });

  it('从打开关闭：仍挂载、state=closed、排退场', () => {
    assert.deepEqual(resolveOverlayPresence(false, true), {
      present: true,
      state: 'closed',
      scheduleExit: true,
    });
  });
});

describe('overlayExitDelayMs', () => {
  it('正常动效用 OVERLAY_EXIT_MS；减少动效为 0', () => {
    assert.equal(overlayExitDelayMs(false), OVERLAY_EXIT_MS);
    assert.equal(overlayExitDelayMs(true), 0);
  });
});
