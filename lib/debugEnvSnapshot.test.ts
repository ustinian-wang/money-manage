/**
 * 调试快照：拼装、缝隙诊断、debug 开关
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildDebugEnvSnapshot,
  calcOverlayViewportGaps,
  formatDebugSnapshot,
  resolveDebugEnabled,
  type DebugOverlaySnap,
} from './debugEnvSnapshot';

function sampleOverlay(partial: Partial<DebugOverlaySnap> & Pick<DebugOverlaySnap, 'kind' | 'rect'>): DebugOverlaySnap {
  return {
    tag: 'div',
    id: '',
    className: '',
    attrs: { 'data-ux': 'sheet-page' },
    offset: {
      offsetWidth: partial.rect.width,
      offsetHeight: partial.rect.height,
      clientWidth: partial.rect.width,
      clientHeight: partial.rect.height,
      scrollWidth: partial.rect.width,
      scrollHeight: partial.rect.height,
    },
    computed: {
      position: 'fixed',
      top: '0px',
      right: 'auto',
      bottom: '0px',
      left: '0px',
      width: `${partial.rect.width}px`,
      height: `${partial.rect.height}px`,
      maxWidth: '100vw',
      maxHeight: 'none',
      minHeight: '0px',
      zIndex: '80',
      zIndexNum: 80,
      backgroundColor: 'rgb(255, 255, 255)',
      opacity: '1',
      visibility: 'visible',
      display: 'flex',
      transform: 'none',
      overflow: 'hidden',
      overflowY: 'hidden',
      pointerEvents: 'auto',
      boxSizing: 'border-box',
      paddingTop: '0px',
      paddingBottom: '0px',
      borderRadius: '0px',
    },
    gapsVsVv: null,
    gapsVsInner: null,
    ...partial,
  };
}

describe('calcOverlayViewportGaps 底缝诊断', () => {
  test('底边短于可视底 → bottomGap>0（透底风险）', () => {
    const gaps = calcOverlayViewportGaps(
      { top: 0, left: 0, width: 402, height: 680, bottom: 680, right: 402 },
      402,
      714,
    );
    assert.equal(gaps.bottomGap, 34);
    assert.equal(gaps.coversView, false);
  });

  test('贴满可视区 → coversView', () => {
    const gaps = calcOverlayViewportGaps(
      { top: 0, left: 0, width: 402, height: 714, bottom: 714, right: 402 },
      402,
      714,
    );
    assert.equal(gaps.bottomGap, 0);
    assert.equal(gaps.coversView, true);
  });

  test('100vh 虚高伸出可视底 → bottomGap<0', () => {
    const gaps = calcOverlayViewportGaps(
      { top: 0, left: 0, width: 402, height: 754, bottom: 754, right: 402 },
      402,
      714,
    );
    assert.equal(gaps.bottomGap, -40);
  });
});

describe('buildDebugEnvSnapshot', () => {
  test('overlays 按 zIndex 排序；floatPanels / innerPages 过滤', () => {
    const emptyCounts = {
      floatPanels: 0,
      backdrops: 0,
      dialogs: 0,
      overlays: 0,
      sheetSubviews: 0,
      floatScrolls: 0,
      floatFooters: 0,
    };
    const snap = buildDebugEnvSnapshot({
      now: new Date('2026-07-29T12:00:00.000Z'),
      ua: 'TestUA',
      standalone: true,
      page: {
        href: 'http://localhost/',
        pathname: '/',
        search: '',
        title: 't',
        visibilityState: 'visible',
        readyState: 'complete',
        sheetOpen: true,
        activeElement: null,
        main: null,
        counts: emptyCounts,
      },
      innerWidth: 390,
      innerHeight: 700,
      screenWidth: 390,
      screenHeight: 844,
      screenAvailHeight: 800,
      vv: { width: 390, height: 500, offsetTop: 0, offsetLeft: 0, scale: 1 },
      cssVars: { vvHeight: '(unset)', vvOffsetTop: '(unset)', kbInset: '(unset)' },
      safeArea: { top: 47, right: 0, bottom: 34, left: 0 },
      scrollY: 120,
      bodyClass: 'sheet-open',
      htmlClass: '',
      overlays: [
        sampleOverlay({
          kind: 'float-panel',
          rect: { top: 0, left: 0, width: 390, height: 700, bottom: 700, right: 390 },
          computed: {
            ...sampleOverlay({
              kind: 'float-panel',
              rect: { top: 0, left: 0, width: 390, height: 700, bottom: 700, right: 390 },
            }).computed,
            zIndexNum: 80,
            zIndex: '80',
          },
        }),
        sampleOverlay({
          kind: 'sheet-backdrop',
          rect: { top: 0, left: 0, width: 390, height: 700, bottom: 700, right: 390 },
          computed: {
            ...sampleOverlay({
              kind: 'sheet-backdrop',
              rect: { top: 0, left: 0, width: 390, height: 700, bottom: 700, right: 390 },
            }).computed,
            zIndexNum: 59,
            zIndex: '59',
          },
        }),
        sampleOverlay({
          kind: 'sheet-subview',
          attrs: { 'data-sheet-subview': 'tax' },
          rect: { top: 80, left: 0, width: 390, height: 500, bottom: 580, right: 390 },
        }),
        sampleOverlay({
          kind: 'float-scroll',
          rect: { top: 48, left: 0, width: 390, height: 600, bottom: 648, right: 390 },
        }),
      ],
    });
    assert.equal(snap.overlays[0].kind, 'sheet-backdrop');
    assert.equal(snap.floatPanels.length, 1);
    assert.equal(snap.innerPages.length, 2);
    assert.equal(snap.page.counts.sheetSubviews, 1);
    assert.equal(snap.page.counts.floatScrolls, 1);
    assert.equal(snap.zIndexContract.panel, 80);
    assert.match(formatDebugSnapshot(snap), /"innerPages"/);
    assert.match(formatDebugSnapshot(snap), /"sheet-subview"/);
  });
});

describe('resolveDebugEnabled', () => {
  test('本机默认开启；非本机（含 workers.dev）默认关闭', () => {
    assert.equal(resolveDebugEnabled('', 'localhost'), true);
    assert.equal(resolveDebugEnabled('', '127.0.0.1'), true);
    assert.equal(resolveDebugEnabled('', 'money-manage.wangjser.workers.dev'), false);
    assert.equal(resolveDebugEnabled('', 'example.com'), false);
  });

  test('query：true/1 开，0/false 关；不认 tue', () => {
    assert.equal(resolveDebugEnabled('?debug=true', 'example.com'), true);
    assert.equal(resolveDebugEnabled('?debug=1', 'example.com'), true);
    assert.equal(resolveDebugEnabled('?debug=0', 'localhost'), false);
    assert.equal(resolveDebugEnabled('?debug=false', 'localhost'), false);
    assert.equal(resolveDebugEnabled('?debug=tue', 'example.com'), false);
    assert.equal(resolveDebugEnabled('?debug=tue', 'localhost'), true);
  });

  test('query 写入 localStorage；非本机依赖 LS 持久化', () => {
    const store = new Map<string, string>();
    const prev = (globalThis as { window?: unknown }).window;
    (globalThis as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      },
      location: { search: '', hostname: 'money-manage.wangjser.workers.dev' },
    };
    try {
      assert.equal(resolveDebugEnabled('?debug=true', 'money-manage.wangjser.workers.dev'), true);
      assert.equal(store.get('mm-debug'), '1');
      assert.equal(resolveDebugEnabled('', 'money-manage.wangjser.workers.dev'), true);
      assert.equal(resolveDebugEnabled('?debug=0', 'money-manage.wangjser.workers.dev'), false);
      assert.equal(store.get('mm-debug'), '0');
      assert.equal(resolveDebugEnabled('', 'money-manage.wangjser.workers.dev'), false);
    } finally {
      if (prev === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window: unknown }).window = prev;
      }
    }
  });
});
