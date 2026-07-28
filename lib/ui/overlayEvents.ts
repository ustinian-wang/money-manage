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

/** 从事件目标向上找内页滚动容器。 */
export function findFloatScrollTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest('[data-float-scroll]');
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
    }
  };
}
