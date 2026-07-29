'use client';

/**
 * 页面滚动：下滑收起吸顶顶栏，上滑展开
 * 挂 class：is-header-hidden（见 globals.css）
 */
import { useEffect, useRef, useState } from 'react';
import { nextHeaderCollapsed } from './scrollHideHeader';

export function useScrollHideHeader(enabled = true) {
  const [collapsed, setCollapsed] = useState(false);
  const lastYRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setCollapsed(false);
      return;
    }
    lastYRef.current = window.scrollY || 0;
    const onScroll = () => {
      const y = window.scrollY || 0;
      setCollapsed((prev) => {
        const next = nextHeaderCollapsed(prev, y, lastYRef.current);
        lastYRef.current = y;
        return next;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enabled]);

  return collapsed;
}
