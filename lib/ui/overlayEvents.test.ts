/**
 * overlayEvents：backdrop 拦截 + 全屏内页滚动隔离
 * 需求：panel 无 mask 时 wheel/touch 不链式滚到背后主页面；[data-float-scroll] 仍可滚
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  acquireSheetBodyLock,
  blockOverlayEvent,
  isolateOverlayEvent,
  shouldBlockSheetTouchMove,
  shouldBlockSheetWheel,
} from './overlayEvents';

describe('blockOverlayEvent / isolateOverlayEvent', () => {
  it('backdrop 同时 preventDefault + stopPropagation', () => {
    const calls: string[] = [];
    blockOverlayEvent({
      preventDefault: () => calls.push('preventDefault'),
      stopPropagation: () => calls.push('stopPropagation'),
    });
    assert.deepEqual(calls, ['preventDefault', 'stopPropagation']);
  });

  it('isolate 只停冒泡（内页点击不穿透），不强制 preventDefault', () => {
    const calls: string[] = [];
    isolateOverlayEvent({
      stopPropagation: () => calls.push('stopPropagation'),
    });
    assert.deepEqual(calls, ['stopPropagation']);
  });
});

// 边界：无滚动区 / 不可滚 / 到顶到底仍朝外 → 拦；中间可滚 → 放行
describe('shouldBlockSheetWheel', () => {
  const scrollable = { scrollTop: 40, scrollHeight: 400, clientHeight: 200 };

  it('无内页滚动区则拦截', () => {
    assert.equal(shouldBlockSheetWheel(null, 10), true);
  });

  it('内容未溢出则拦截', () => {
    assert.equal(shouldBlockSheetWheel({ scrollTop: 0, scrollHeight: 100, clientHeight: 100 }, 10), true);
  });

  it('中间可滚时放行', () => {
    assert.equal(shouldBlockSheetWheel(scrollable, 10), false);
    assert.equal(shouldBlockSheetWheel(scrollable, -10), false);
  });

  it('到顶上滚 / 到底下滚拦截', () => {
    assert.equal(shouldBlockSheetWheel({ scrollTop: 0, scrollHeight: 400, clientHeight: 200 }, -10), true);
    assert.equal(
      shouldBlockSheetWheel({ scrollTop: 200, scrollHeight: 400, clientHeight: 200 }, 10),
      true,
    );
  });
});

describe('shouldBlockSheetTouchMove', () => {
  it('无滚动区或不可滚则拦截；可滚放行', () => {
    assert.equal(shouldBlockSheetTouchMove(null), true);
    assert.equal(shouldBlockSheetTouchMove({ scrollTop: 0, scrollHeight: 100, clientHeight: 100 }), true);
    assert.equal(shouldBlockSheetTouchMove({ scrollTop: 0, scrollHeight: 400, clientHeight: 200 }), false);
  });
});

describe('acquireSheetBodyLock', () => {
  it('多个 sheet 共用 body 锁，最后一个关闭后才释放', () => {
    const calls: string[] = [];
    const target = {
      classList: {
        add: (name: string) => calls.push(`add:${name}`),
        remove: (name: string) => calls.push(`remove:${name}`),
      },
    };
    const releaseFirst = acquireSheetBodyLock(target);
    const releaseSecond = acquireSheetBodyLock(target);
    releaseFirst();
    releaseFirst();
    assert.deepEqual(calls, ['add:sheet-open']);
    releaseSecond();
    assert.deepEqual(calls, ['add:sheet-open', 'remove:sheet-open']);
  });
});
