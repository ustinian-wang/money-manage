'use client';

/**
 * 浮层 presence：open→挂载入场；关闭→data-state=closed 播退场再卸载
 */
import { useEffect, useRef, useState } from 'react';
import {
  overlayExitDelayMs,
  resolveOverlayPresence,
  type OverlayMotionState,
} from './overlayPresence';

export function useOverlayPresence(open: boolean, onExited?: () => void) {
  const [present, setPresent] = useState(open);
  const [state, setState] = useState<OverlayMotionState>(open ? 'open' : 'closed');
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  useEffect(() => {
    const next = resolveOverlayPresence(open, present);
    if (open) {
      setPresent(true);
      setState('open');
      return;
    }
    if (!next.scheduleExit) return;
    setState('closed');
    const reduced =
      typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ms = overlayExitDelayMs(reduced);
    const timer = window.setTimeout(() => {
      setPresent(false);
      onExitedRef.current?.();
    }, ms);
    return () => window.clearTimeout(timer);
  }, [open, present]);

  return { present, state };
}
