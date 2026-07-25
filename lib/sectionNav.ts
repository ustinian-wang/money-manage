/**
 * 移动分区导航：chip 高亮挑选 + sticky 预留下滚位置
 * 需求：first-visit-audit P1-4 / P1-8
 */

/** ratio 全 0 时按距视口中线最近分区兜底；否则取最大 intersectionRatio */
export function pickActiveSection(
  ids: string[],
  ratios: Record<string, number>,
  distanceToMid?: Record<string, number>,
): string {
  if (!ids.length) return '';
  let bestId = ids[0];
  let bestRatio = -1;
  for (const id of ids) {
    const ratio = ratios[id] ?? 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestId = id;
    }
  }
  if (bestRatio > 0) return bestId;
  if (!distanceToMid) return bestId;
  let nearest = ids[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const id of ids) {
    const dist = distanceToMid[id];
    if (dist == null || !Number.isFinite(dist)) continue;
    if (dist < bestDist) {
      bestDist = dist;
      nearest = id;
    }
  }
  return nearest;
}

/**
 * 目标元素相对文档顶部减去 sticky 高度后的 scrollY
 * @param elementTop 元素 getBoundingClientRect().top
 * @param pageYOffset window.scrollY / pageYOffset
 * @param stickyPx 吸顶栏高度（含 chips）
 */
export function stickyAwareScrollY(elementTop: number, pageYOffset: number, stickyPx: number): number {
  const sticky = Math.max(0, Number.isFinite(stickyPx) ? stickyPx : 0);
  const y = (Number.isFinite(pageYOffset) ? pageYOffset : 0)
    + (Number.isFinite(elementTop) ? elementTop : 0)
    - sticky;
  return Math.max(0, y);
}
