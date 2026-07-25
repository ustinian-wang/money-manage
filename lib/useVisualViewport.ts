'use client';

import { useEffect, useState } from 'react';

/** 由 layout / visualViewport 推算键盘顶起 inset */
export function calcKeyboardInset(innerHeight: number, vvHeight: number, offsetTop: number) {
  return Math.max(0, innerHeight - vvHeight - offsetTop);
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

/** 焦点字段滚入可视区（键盘弹出后；默认延迟对齐 iOS VKB 动画） */
export function scrollFocusedFieldIntoView(target: EventTarget | null, delayMs = 280) {
  if (!(target instanceof HTMLElement)) return;
  if (!target.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea')) {
    return;
  }
  window.setTimeout(() => {
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  }, delayMs);
}
