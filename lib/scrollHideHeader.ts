/**
 * 吸顶顶栏：下滑收起、上滑展开
 * 需求：ui-checklist A2；近顶始终展开
 */

export type ScrollHideHeaderOpts = {
  /** 下滑超过此像素才收起 */
  downThreshold?: number;
  /** 上滑超过此像素才展开 */
  upThreshold?: number;
  /** scrollY 小于等于此值强制展开 */
  topShow?: number;
};

/**
 * 由滚动位移决定顶栏是否收起。
 * delta>0 向下；近顶强制展开；未达阈值保持原状。
 */
export function nextHeaderCollapsed(
  collapsed: boolean,
  scrollY: number,
  lastScrollY: number,
  opts: ScrollHideHeaderOpts = {},
): boolean {
  const downThreshold = opts.downThreshold ?? 8;
  const upThreshold = opts.upThreshold ?? 8;
  const topShow = opts.topShow ?? 24;
  const y = Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0;
  const last = Number.isFinite(lastScrollY) ? Math.max(0, lastScrollY) : 0;
  if (y <= topShow) return false;
  const delta = y - last;
  if (delta > downThreshold) return true;
  if (delta < -upThreshold) return false;
  return collapsed;
}
