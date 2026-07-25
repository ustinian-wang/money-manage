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

/** 顶栏 chrome 收起防抖阈值（px）；过小易抖，过大延迟感强 */
export const HEADER_COLLAPSE_THRESHOLD = 10;

/** hide/show 最短间隔（ms）；临界区反复反向时抑制抖动 */
export const HEADER_COLLAPSE_MIN_INTERVAL_MS = 220;

/**
 * 根据滚动增量决定顶栏 chrome（标题/菜单/访客条）是否收起；导航 chips 始终保留。
 * deltaY>0 向下滚 → 收起；deltaY<0 向上滚 → 展开；|delta|≤threshold 保持。
 * 近页顶强制展开，避免首屏抖动。
 */
export function nextHeaderCollapsed(
  collapsed: boolean,
  deltaY: number,
  scrollY: number,
  threshold: number = HEADER_COLLAPSE_THRESHOLD,
): boolean {
  const th = Math.max(0, Number.isFinite(threshold) ? threshold : HEADER_COLLAPSE_THRESHOLD);
  const y = Number.isFinite(scrollY) ? scrollY : 0;
  const d = Number.isFinite(deltaY) ? deltaY : 0;
  if (y <= th) return false;
  if (d > th) return true;
  if (d < -th) return false;
  return collapsed;
}

export type HeaderCollapseDecision = { collapsed: boolean; switched: boolean };

/**
 * 在 nextHeaderCollapsed 之上加最短切换间隔，避免临界区来回抖。
 * 近页顶强制展开不受间隔限制（否则会卡在收起态）。
 */
export function decideHeaderCollapsed(input: {
  collapsed: boolean;
  deltaY: number;
  scrollY: number;
  nowMs: number;
  lastSwitchMs: number;
  threshold?: number;
  minIntervalMs?: number;
}): HeaderCollapseDecision {
  const th = input.threshold ?? HEADER_COLLAPSE_THRESHOLD;
  const minMs = Math.max(
    0,
    Number.isFinite(input.minIntervalMs) ? (input.minIntervalMs as number) : HEADER_COLLAPSE_MIN_INTERVAL_MS,
  );
  const desired = nextHeaderCollapsed(input.collapsed, input.deltaY, input.scrollY, th);
  if (desired === input.collapsed) return { collapsed: input.collapsed, switched: false };
  const nearTop = (Number.isFinite(input.scrollY) ? input.scrollY : 0) <= th;
  // 近顶展开：立即放行
  if (nearTop && !desired) return { collapsed: false, switched: true };
  const elapsed = (Number.isFinite(input.nowMs) ? input.nowMs : 0)
    - (Number.isFinite(input.lastSwitchMs) ? input.lastSwitchMs : 0);
  if (elapsed < minMs) return { collapsed: input.collapsed, switched: false };
  return { collapsed: desired, switched: true };
}
