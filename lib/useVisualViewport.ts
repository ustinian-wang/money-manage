'use client';

import { useEffect, useState } from 'react';

/** 焦点相对可视区的边距（12–16px） */
export const FOCUS_VV_MARGIN = 14;

/** 由 layout / visualViewport 推算键盘顶起 inset */
export function calcKeyboardInset(innerHeight: number, vvHeight: number, offsetTop: number) {
  return Math.max(0, innerHeight - vvHeight - offsetTop);
}

/**
 * 焦点元素相对 visualViewport 可见盒的滚动增量（正=向下滚 scrollTop）。
 * elTop/elBottom、visibleTop/visibleBottom 同一坐标系（一般为 layout viewport）。
 */
export function calcFocusScrollDelta(
  elTop: number,
  elBottom: number,
  visibleTop: number,
  visibleBottom: number,
): number {
  if (elBottom > visibleBottom) return elBottom - visibleBottom;
  if (elTop < visibleTop) return elTop - visibleTop;
  return 0;
}

/**
 * 焦点可视底边：VV 底与浮层 footer 顶取更严者，避免滚进底栏后面仍判「已可见」。
 * footerTop=null 时仅扣 margin。
 */
export function calcFocusVisibleBottom(
  viewBottom: number,
  margin: number,
  footerTop: number | null,
): number {
  const vvCap = viewBottom - margin;
  if (footerTop == null || !Number.isFinite(footerTop)) return vvCap;
  return Math.min(vvCap, footerTop - margin);
}

export type VisualViewportState = {
  height: number;
  offsetTop: number;
  keyboardInset: number;
};

function readVisualViewport(): VisualViewportState {
  if (typeof window === 'undefined') {
    return { height: 0, offsetTop: 0, keyboardInset: 0 };
  }
  const vv = window.visualViewport;
  const height = vv?.height ?? window.innerHeight;
  const offsetTop = vv?.offsetTop ?? 0;
  return {
    height,
    offsetTop,
    keyboardInset: calcKeyboardInset(window.innerHeight, height, offsetTop),
  };
}

function syncCssVars(state: VisualViewportState) {
  const root = document.documentElement;
  root.style.setProperty('--vv-height', `${state.height}px`);
  root.style.setProperty('--vv-offset-top', `${state.offsetTop}px`);
  root.style.setProperty('--kb-inset', `${state.keyboardInset}px`);
  // 阈值略大于地址栏抖动；供 gate 在键盘打开时改 justify，避免居中裁切
  root.classList.toggle('kb-open', state.keyboardInset > 40);
}

/**
 * 同步 visualViewport → CSS 变量（--vv-height / --vv-offset-top / --kb-inset）
 * 供门禁、auth sheet、FloatPanel 在键盘弹出时收高度。
 */
export function useVisualViewport() {
  const [state, setState] = useState<VisualViewportState>(() => readVisualViewport());

  useEffect(() => {
    const apply = () => {
      const next = readVisualViewport();
      syncCssVars(next);
      setState(next);
    };
    apply();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    return () => {
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      document.documentElement.classList.remove('kb-open');
    };
  }, []);

  return state;
}

const FOCUSABLE_SEL = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea';

export function isFocusableField(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement && target.matches(FOCUSABLE_SEL);
}

/** 在 root 内找可纵向滚动的祖先（浮层 body / auth sheet）；不锁 touch-action */
function findScrollParent(el: HTMLElement, root: Element | null): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    const oy = style.overflowY;
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    if (root && node === root) break;
    node = node.parentElement;
  }
  if (root instanceof HTMLElement) {
    const body = root.querySelector<HTMLElement>('.overflow-y-auto, [data-float-scroll]');
    if (body) return body;
  }
  return root instanceof HTMLElement ? root : null;
}

/** 立即：按 VV 可见底边校正焦点（优先滚浮层/auth 容器） */
export function ensureFocusedInVisualViewportNow(
  target: EventTarget | null,
  margin = FOCUS_VV_MARGIN,
) {
  if (!isFocusableField(target) || !document.contains(target)) return;
  const vv = window.visualViewport;
  const viewTop = vv?.offsetTop ?? 0;
  const viewBottom = viewTop + (vv?.height ?? window.innerHeight);
  const shell = target.closest<HTMLElement>('[data-float-panel], .auth-sheet-root, .auth-gate-root');
  const footer = shell?.querySelector<HTMLElement>('[data-float-footer]');
  const footerTop = footer ? footer.getBoundingClientRect().top : null;
  const visibleTop = viewTop + margin;
  const visibleBottom = calcFocusVisibleBottom(viewBottom, margin, footerTop);
  const rect = target.getBoundingClientRect();
  const delta = calcFocusScrollDelta(rect.top, rect.bottom, visibleTop, visibleBottom);
  if (delta === 0) return;

  const scroller = findScrollParent(target, shell);
  if (scroller) {
    scroller.scrollTop += delta;
    return;
  }
  // 无内部 scroller：nearest，避免 block:center 把背后页面乱滚而 fixed 浮层不动
  target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

let activeFocusCleanup: (() => void) | null = null;

/**
 * 焦点字段滚入 visualViewport（延迟对齐键盘动画 + VV resize/scroll 再校正）。
 * 返回取消函数；新一次调用会取消上一次。
 */
export function scrollFocusedFieldIntoView(target: EventTarget | null, delayMs = 280) {
  if (!isFocusableField(target)) return () => {};
  activeFocusCleanup?.();
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    ensureFocusedInVisualViewportNow(target);
  };
  const timer = window.setTimeout(run, delayMs);
  const vv = window.visualViewport;
  // 键盘动画中 VV 会连续变矮：再校正一次
  const onVv = () => {
    if (cancelled) return;
    window.setTimeout(run, 40);
  };
  vv?.addEventListener('resize', onVv);
  vv?.addEventListener('scroll', onVv);
  const cleanup = () => {
    cancelled = true;
    window.clearTimeout(timer);
    vv?.removeEventListener('resize', onVv);
    vv?.removeEventListener('scroll', onVv);
    if (activeFocusCleanup === cleanup) activeFocusCleanup = null;
  };
  activeFocusCleanup = cleanup;
  return cleanup;
}
