'use client';

/**
 * 主应用壳：同步 visualViewport CSS 变量；全局 focusin 滚入可视区
 */
import { useEffect } from 'react';
import { scrollFocusedFieldIntoView, useVisualViewport } from '../../lib/useVisualViewport';

export default function ViewportSync() {
  useVisualViewport();

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      scrollFocusedFieldIntoView(event.target);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  return null;
}
