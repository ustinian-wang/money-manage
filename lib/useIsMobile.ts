'use client';

import { useEffect, useState } from 'react';

/** 移动交互断点：与 globals / Tailwind sm 对齐 */
export const MOBILE_MQ = '(max-width: 639px)';

/**
 * PC vs 移动端交互规范（不要混用）
 * - PC：锚点浮层、悬停说明、密表、可拖拽大面板、无遮罩
 * - 移动：底部抽屉 + 遮罩、触控卡片、分区跳转、大触控区、锁滚动
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return isMobile;
}
