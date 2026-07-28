/**
 * 浮层视口夹紧：优先 visualViewport，出界则上下翻转 / 左右夹紧。
 * 供 InfoTip、field 矮卡、PC popover；panel sheet 用 placeSheetAtBottom。
 */

export type RectLike = { top: number; left: number; right: number; bottom: number; width: number; height: number };

export type SafeInsets = { top: number; right: number; bottom: number; left: number };

export type ViewportBox = { left: number; top: number; right: number; bottom: number };

/** 默认安全边距（8–12px 中取 10） */
export const FLOAT_MARGIN = 10;

export const ZERO_SAFE: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

/** 由 visualViewport（或 layout 回退）+ margin + safe-area 得到可见夹紧盒 */
export function viewportBounds(
  vv: { offsetLeft: number; offsetTop: number; width: number; height: number } | null | undefined,
  innerW: number,
  innerH: number,
  margin = FLOAT_MARGIN,
  safe: SafeInsets = ZERO_SAFE,
): ViewportBox {
  const left0 = vv?.offsetLeft ?? 0;
  const top0 = vv?.offsetTop ?? 0;
  const w = vv?.width ?? innerW;
  const h = vv?.height ?? innerH;
  return {
    left: left0 + margin + safe.left,
    top: top0 + margin + safe.top,
    right: left0 + w - margin - safe.right,
    bottom: top0 + h - margin - safe.bottom,
  };
}

/**
 * 锚点下方优先；底部出界则翻到上方；左右夹紧。
 * align=center 时水平以锚点中线对齐（InfoTip）；start 贴锚点左缘（popover）。
 */
export function placeNearAnchor(
  anchor: RectLike,
  panelW: number,
  panelH: number,
  vp: ViewportBox,
  gap = 8,
  align: 'start' | 'center' = 'start',
): { top: number; left: number; flipped: boolean } {
  const idealLeft = align === 'center'
    ? anchor.left + anchor.width / 2 - panelW / 2
    : anchor.left;
  let left = clamp(idealLeft, vp.left, Math.max(vp.left, vp.right - panelW));
  let top = anchor.bottom + gap;
  let flipped = false;
  if (top + panelH > vp.bottom) {
    const above = anchor.top - gap - panelH;
    // 上方能放下，或上方剩余空间更大 → 翻转
    if (above >= vp.top || (vp.bottom - top) < (anchor.top - gap - vp.top)) {
      top = clamp(above, vp.top, Math.max(vp.top, vp.bottom - panelH));
      flipped = true;
    } else {
      top = clamp(top, vp.top, Math.max(vp.top, vp.bottom - panelH));
    }
  } else {
    top = clamp(top, vp.top, Math.max(vp.top, vp.bottom - panelH));
  }
  left = clamp(left, vp.left, Math.max(vp.left, vp.right - panelW));
  return { top, left, flipped };
}

/**
 * 相对 viewport 居中；若底边被键盘/可视区挡住则上移夹紧（field 小编辑默认）。
 */
export function placeCenteredInViewport(
  panelW: number,
  panelH: number,
  vp: ViewportBox,
): { top: number; left: number } {
  const left = clamp((vp.left + vp.right - panelW) / 2, vp.left, Math.max(vp.left, vp.right - panelW));
  let top = (vp.top + vp.bottom - panelH) / 2;
  if (top + panelH > vp.bottom) top = vp.bottom - panelH;
  top = clamp(top, vp.top, Math.max(vp.top, vp.bottom - panelH));
  return { top, left };
}

/**
 * sheet 贴 visualViewport 底边；fullBleed 铺满视口宽，否则水平居中并夹紧。
 * 调用方应对 panel sheet 传入「底边不吃 margin/safe」的盒子，否则会露出底部空隙。
 */
export function placeSheetAtBottom(
  panelH: number,
  vp: ViewportBox,
  viewLeft: number,
  viewWidth: number,
  fullBleed: boolean,
): { top: number; left: number; width: number } {
  const width = fullBleed ? Math.max(0, viewWidth) : Math.min(viewWidth, Math.max(0, vp.right - vp.left));
  const left = fullBleed
    ? viewLeft
    : clamp(viewLeft + (viewWidth - width) / 2, vp.left, Math.max(vp.left, vp.right - width));
  const top = Math.max(vp.top, vp.bottom - panelH);
  return { top, left, width };
}

/**
 * panel sheet 贴底用视口：顶仍用夹紧盒（避顶栏/margin），底贴 VV 真底。
 * safe-area 由面板 paddingBottom 消化，勿再从 bottom 预扣，否则遮罩会从底缝漏出。
 * 半高 sheet 仍可用；移动 density=panel 全屏内页改走 sheetFullscreenViewport。
 */
export function sheetFlushViewport(
  vv: { offsetTop: number; height: number } | null | undefined,
  clamped: ViewportBox,
  viewLeft: number,
  viewWidth: number,
  fallbackHeight: number,
): ViewportBox {
  const top0 = vv?.offsetTop ?? 0;
  const h = vv?.height ?? fallbackHeight;
  return {
    left: viewLeft,
    top: clamped.top,
    right: viewLeft + Math.max(0, viewWidth),
    bottom: top0 + Math.max(0, h),
  };
}

/**
 * 移动 panel 全屏内页：顶底均贴 VV 真边（不预扣 margin/safe）。
 * safe-area 由面板 paddingTop/Bottom 消化；优先用 placeFullscreenInViewport 拿 top/left/宽高。
 */
export function sheetFullscreenViewport(
  vv: { offsetTop: number; height: number } | null | undefined,
  viewLeft: number,
  viewWidth: number,
  fallbackHeight: number,
): ViewportBox {
  const top0 = vv?.offsetTop ?? 0;
  const h = vv?.height ?? fallbackHeight;
  return {
    left: viewLeft,
    top: top0,
    right: viewLeft + Math.max(0, viewWidth),
    bottom: top0 + Math.max(0, h),
  };
}

/**
 * 移动 panel 全屏内页：宽高与 top/left 一次性贴满 visualViewport（不吃 margin/safe）。
 * 勿再经 placeSheetAtBottom 拼装，避免半高语义残留；safe-area 只走面板内 padding。
 */
export function placeFullscreenInViewport(
  vv: { offsetLeft: number; offsetTop: number; width: number; height: number } | null | undefined,
  fallbackW: number,
  fallbackH: number,
): { top: number; left: number; width: number; height: number } {
  const left = vv?.offsetLeft ?? 0;
  const top = vv?.offsetTop ?? 0;
  const width = Math.max(0, vv?.width ?? fallbackW);
  const height = Math.max(0, vv?.height ?? fallbackH);
  return { top, left, width, height };
}

/**
 * 面板用高 = min(内容自然高, 视口上限)。
 * 显式写入 height，避免仅靠 max-height 时内容撑破 VV、body 锁死后无法滚到底。
 */
export function calcPanelUsedHeight(naturalHeight: number, maxHeight: number): number {
  const nat = Math.max(0, Number.isFinite(naturalHeight) ? naturalHeight : 0);
  const max = Math.max(0, Number.isFinite(maxHeight) ? maxHeight : 0);
  return Math.min(nat, max);
}

/**
 * 由 chrome（非滚动区）+ 滚动体 scrollHeight 还原自然总高。
 * 在已施加 max-height 时仍可用：scrollHeight 反映内容，clientHeight 反映可视。
 */
export function measurePanelNaturalHeight(
  panelOffsetHeight: number,
  scrollClientHeight: number,
  scrollScrollHeight: number,
): number {
  const chrome = Math.max(0, panelOffsetHeight - Math.max(0, scrollClientHeight));
  return chrome + Math.max(0, scrollScrollHeight);
}

/** 读取 env(safe-area-inset-*)；失败则全 0（ponytail: 每次 place 轻量 probe，不缓存跨页） */
export function readSafeAreaInsets(): SafeInsets {
  if (typeof document === 'undefined') return ZERO_SAFE;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;'
    + 'padding-top:env(safe-area-inset-top,0px);'
    + 'padding-right:env(safe-area-inset-right,0px);'
    + 'padding-bottom:env(safe-area-inset-bottom,0px);'
    + 'padding-left:env(safe-area-inset-left,0px);';
  document.body.appendChild(el);
  const cs = getComputedStyle(el);
  const safe = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  el.remove();
  return safe;
}
