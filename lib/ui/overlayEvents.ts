export type BlockingOverlayEvent = {
  preventDefault: () => void;
  stopPropagation: () => void;
};

/** Keep a backdrop gesture from closing the overlay or reaching page controls. */
export function blockOverlayEvent(event: BlockingOverlayEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

/** 全屏内页：吞冒泡，避免点穿到背后主页面控件。 */
export function isolateOverlayEvent(event: { stopPropagation: () => void }): void {
  event.stopPropagation();
}

type ScrollMetrics = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

function isCssScrollPort(el: HTMLElement, axis: 'x' | 'y'): boolean {
  const style = getComputedStyle(el);
  const mode = axis === 'y' ? style.overflowY : style.overflowX;
  return /(auto|scroll|overlay)/.test(mode);
}

function canScroll(el: HTMLElement): boolean {
  const y = isCssScrollPort(el, 'y') && el.scrollHeight > el.clientHeight + 1;
  const x = isCssScrollPort(el, 'x') && el.scrollWidth > el.clientWidth + 1;
  return y || x;
}

/**
 * 从事件目标向上找浮层内真实可滚容器。
 * 优先可溢出的祖先（如 .table-scroll）；否则回退 [data-float-scroll]。
 * 避免外壳 overflow:hidden、内层表格才可滚时误判「不可滚」而 preventDefault。
 */
export function findFloatScrollTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  const panel = target.closest('[data-float-panel]');
  if (!panel) return target.closest('[data-float-scroll]');
  let cur: Element | null = target;
  while (cur && panel.contains(cur)) {
    if (cur instanceof HTMLElement && canScroll(cur)) return cur;
    if (cur === panel) break;
    cur = cur.parentElement;
  }
  return panel.querySelector('[data-float-scroll]');
}

/**
 * wheel 是否应 preventDefault：无内页滚动区，或已到顶/底仍朝外滚。
 * 内页仍可滚时返回 false，交给 [data-float-scroll]。
 */
export function shouldBlockSheetWheel(scrollEl: ScrollMetrics | null, deltaY: number): boolean {
  if (!scrollEl) return true;
  if (scrollEl.scrollHeight <= scrollEl.clientHeight + 1) return true;
  if (deltaY < 0 && scrollEl.scrollTop <= 0) return true;
  if (deltaY > 0 && scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 1) {
    return true;
  }
  return false;
}

/**
 * touchmove 是否应 preventDefault：落在非滚动区，或滚动区本身不可滚。
 * 可滚的 [data-float-scroll] 放行；边界链式滚动靠 overscroll-behavior: contain。
 */
export function shouldBlockSheetTouchMove(scrollEl: ScrollMetrics | null): boolean {
  if (!scrollEl) return true;
  return scrollEl.scrollHeight <= scrollEl.clientHeight + 1;
}

type SheetBodyLockTarget = {
  classList: Pick<DOMTokenList, 'add' | 'remove'>;
};

let sheetBodyLockCount = 0;
let sheetScrollIsolationCleanup: (() => void) | undefined;
let sheetPrevThemeColor: string | null = null;

function installSheetScrollIsolation(): () => void {
  const onWheel = (event: WheelEvent) => {
    const el = findFloatScrollTarget(event.target);
    const metrics = el
      ? {
          scrollTop: (el as HTMLElement).scrollTop,
          scrollHeight: (el as HTMLElement).scrollHeight,
          clientHeight: (el as HTMLElement).clientHeight,
        }
      : null;
    event.stopPropagation();
    if (shouldBlockSheetWheel(metrics, event.deltaY)) {
      event.preventDefault();
    }
  };
  const onTouchMove = (event: TouchEvent) => {
    const el = findFloatScrollTarget(event.target);
    const metrics = el
      ? {
          scrollTop: (el as HTMLElement).scrollTop,
          scrollHeight: (el as HTMLElement).scrollHeight,
          clientHeight: (el as HTMLElement).clientHeight,
        }
      : null;
    event.stopPropagation();
    if (shouldBlockSheetTouchMove(metrics)) {
      event.preventDefault();
    }
  };
  document.addEventListener('wheel', onWheel, { passive: false, capture: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
  return () => {
    document.removeEventListener('wheel', onWheel, true);
    document.removeEventListener('touchmove', onTouchMove, true);
  };
}

/** Keep concurrent sheets from releasing another sheet's global scroll lock. */
export function acquireSheetBodyLock(target: SheetBodyLockTarget): () => void {
  sheetBodyLockCount += 1;
  if (sheetBodyLockCount === 1) {
    target.classList.add('sheet-open');
    // node 单测无 document；浏览器里顺带拦住 wheel/touch 链式滚到背后页
    if (typeof document !== 'undefined') {
      sheetScrollIsolationCleanup = installSheetScrollIsolation();
      // Safari 半透明导航：theme-color 改白，栏背后少透出深色/杂色
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        sheetPrevThemeColor = meta.getAttribute('content');
        meta.setAttribute('content', '#ffffff');
      }
      document.documentElement.classList.add('sheet-open');
    }
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    sheetBodyLockCount = Math.max(0, sheetBodyLockCount - 1);
    if (sheetBodyLockCount === 0) {
      target.classList.remove('sheet-open');
      sheetScrollIsolationCleanup?.();
      sheetScrollIsolationCleanup = undefined;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('sheet-open');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta && sheetPrevThemeColor != null) {
          meta.setAttribute('content', sheetPrevThemeColor);
          sheetPrevThemeColor = null;
        }
      }
    }
  };
}
