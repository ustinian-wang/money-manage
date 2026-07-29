/**
 * 浮层进出场 presence：open 关闭后延迟卸载，给退场动画留时间。
 * FloatPanel / 顶栏菜单共用；勿在业务里各写一套 setTimeout。
 */

export const OVERLAY_EXIT_MS = 280;

export type OverlayMotionState = 'open' | 'closed';

export function overlayExitDelayMs(prefersReducedMotion: boolean): number {
  return prefersReducedMotion ? 0 : OVERLAY_EXIT_MS;
}

/** 根据 open 与当前挂载态，决定是否仍挂载、data-state、是否要排退场定时器 */
export function resolveOverlayPresence(
  open: boolean,
  wasPresent: boolean,
): { present: boolean; state: OverlayMotionState; scheduleExit: boolean } {
  if (open) {
    return { present: true, state: 'open', scheduleExit: false };
  }
  if (!wasPresent) {
    return { present: false, state: 'closed', scheduleExit: false };
  }
  return { present: true, state: 'closed', scheduleExit: true };
}
