/**
 * 真机调试快照：VV / 安全区 / 各浮层尺寸·层级·渲染样式
 * 供 DebugConsole 展示、复制、上报终端
 */
import { Z_INDEX } from './ui/zIndex';

export type DebugRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

/** 相对可视区缝隙：bottomGap>0 表示底边未铺满（易透出背后） */
export type DebugViewportGaps = {
  viewTop: number;
  viewBottom: number;
  topGap: number;
  bottomGap: number;
  leftGap: number;
  rightGap: number;
  coversView: boolean;
};

export type DebugComputedBox = {
  position: string;
  top: string;
  right: string;
  bottom: string;
  left: string;
  width: string;
  height: string;
  maxWidth: string;
  maxHeight: string;
  minHeight: string;
  zIndex: string;
  zIndexNum: number;
  backgroundColor: string;
  opacity: string;
  visibility: string;
  display: string;
  transform: string;
  overflow: string;
  overflowY: string;
  pointerEvents: string;
  boxSizing: string;
  paddingTop: string;
  paddingBottom: string;
  borderRadius: string;
};

export type DebugOverlaySnap = {
  kind: string;
  tag: string;
  id: string;
  className: string;
  attrs: Record<string, string>;
  rect: DebugRect;
  offset: { offsetWidth: number; offsetHeight: number; clientWidth: number; clientHeight: number; scrollWidth: number; scrollHeight: number };
  computed: DebugComputedBox;
  gapsVsVv: DebugViewportGaps | null;
  gapsVsInner: DebugViewportGaps | null;
  children?: {
    scroll?: DebugRect | null;
    footer?: DebugRect | null;
    /** 内页内的 data-sheet-subview */
    subviews?: Array<{ name: string; rect: DebugRect; offsetHeight: number; scrollHeight: number }>;
  };
};

export type DebugPageSnap = {
  href: string;
  pathname: string;
  search: string;
  title: string;
  visibilityState: string;
  readyState: string;
  sheetOpen: boolean;
  activeElement: { tag: string; id: string; className: string; type: string; name: string } | null;
  main: DebugRect | null;
  counts: {
    floatPanels: number;
    backdrops: number;
    dialogs: number;
    overlays: number;
    /** 全屏内页子视图 data-sheet-subview */
    sheetSubviews: number;
    /** SheetPageShell 滚动区 */
    floatScrolls: number;
    floatFooters: number;
  };
};

export type DebugEnvSnapshot = {
  at: string;
  ua: string;
  standalone: boolean;
  page: DebugPageSnap;
  inner: { width: number; height: number };
  screen: { width: number; height: number; availHeight: number };
  vv: {
    width: number;
    height: number;
    offsetTop: number;
    offsetLeft: number;
    scale: number;
  } | null;
  cssVars: { vvHeight: string; vvOffsetTop: string; kbInset: string };
  safeArea: { top: number; right: number; bottom: number; left: number };
  scrollY: number;
  bodyClass: string;
  htmlClass: string;
  /** 契约 z-index 表，便于对照 computed.zIndex */
  zIndexContract: typeof Z_INDEX;
  /** 所有浮层/遮罩，按 z-index 升序 */
  overlays: DebugOverlaySnap[];
  /** 仅 [data-float-panel]，便于快速扫 */
  floatPanels: DebugOverlaySnap[];
  /** 内页：subview + float-scroll + float-footer */
  innerPages: DebugOverlaySnap[];
};

export type DebugEnvInput = {
  now?: Date;
  ua: string;
  standalone: boolean;
  page: DebugPageSnap;
  innerWidth: number;
  innerHeight: number;
  screenWidth: number;
  screenHeight: number;
  screenAvailHeight: number;
  vv: DebugEnvSnapshot['vv'];
  cssVars: DebugEnvSnapshot['cssVars'];
  safeArea: DebugEnvSnapshot['safeArea'];
  scrollY: number;
  bodyClass: string;
  htmlClass: string;
  overlays: DebugOverlaySnap[];
};

/**
 * 相对可视盒缝隙。
 * bottomGap>0 → 控件底边高于可视底（底缝透出）；<0 → 伸出可视底外。
 */
export function calcOverlayViewportGaps(
  rect: DebugRect,
  viewWidth: number,
  viewHeight: number,
  viewOffsetTop = 0,
  viewOffsetLeft = 0,
): DebugViewportGaps {
  const viewTop = viewOffsetTop;
  const viewBottom = viewOffsetTop + Math.max(0, viewHeight);
  const viewLeft = viewOffsetLeft;
  const viewRight = viewOffsetLeft + Math.max(0, viewWidth);
  const topGap = round1(rect.top - viewTop);
  const bottomGap = round1(viewBottom - rect.bottom);
  const leftGap = round1(rect.left - viewLeft);
  const rightGap = round1(viewRight - rect.right);
  return {
    viewTop,
    viewBottom,
    topGap,
    bottomGap,
    leftGap,
    rightGap,
    coversView: topGap <= 1 && bottomGap <= 1 && leftGap <= 1 && rightGap <= 1,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 由已采集字段拼快照（便于单测，不碰 DOM） */
export function buildDebugEnvSnapshot(input: DebugEnvInput): DebugEnvSnapshot {
  const overlays = [...(input.overlays || [])].sort(
    (a, b) => a.computed.zIndexNum - b.computed.zIndexNum,
  );
  const floatPanels = overlays.filter((o) => o.kind === 'float-panel');
  const innerPages = overlays.filter((o) => (
    o.kind === 'sheet-subview' || o.kind === 'float-scroll' || o.kind === 'float-footer'
  ));
  const page = input.page;
  return {
    at: (input.now ?? new Date()).toISOString(),
    ua: input.ua || '',
    standalone: Boolean(input.standalone),
    page: {
      ...page,
      counts: {
        floatPanels: floatPanels.length,
        backdrops: overlays.filter((o) => o.kind === 'sheet-backdrop').length,
        dialogs: overlays.filter((o) => o.kind === 'dialog' || o.attrs.role === 'dialog').length,
        overlays: overlays.length,
        sheetSubviews: overlays.filter((o) => o.kind === 'sheet-subview').length,
        floatScrolls: overlays.filter((o) => o.kind === 'float-scroll').length,
        floatFooters: overlays.filter((o) => o.kind === 'float-footer').length,
      },
    },
    inner: { width: input.innerWidth, height: input.innerHeight },
    screen: {
      width: input.screenWidth,
      height: input.screenHeight,
      availHeight: input.screenAvailHeight,
    },
    vv: input.vv,
    cssVars: input.cssVars,
    safeArea: input.safeArea,
    scrollY: Number.isFinite(input.scrollY) ? input.scrollY : 0,
    bodyClass: input.bodyClass || '',
    htmlClass: input.htmlClass || '',
    zIndexContract: Z_INDEX,
    overlays,
    floatPanels,
    innerPages,
  };
}

/** 一行摘要：刷新/上报后展示在 dbg 面板 */
export function summarizeDebugSnapshot(snap: DebugEnvSnapshot): string {
  const panels = snap.floatPanels;
  const gaps = panels.map((p) => p.gapsVsVv?.bottomGap).filter((n): n is number => typeof n === 'number');
  const gapTxt = gaps.length
    ? ` bottomGap=[${gaps.join(',')}]`
    : ' floatPanels=0';
  const c = snap.page.counts;
  return `${snap.at.slice(11, 19)} overlays=${c.overlays} panels=${c.floatPanels} inner=${c.sheetSubviews}+scroll${c.floatScrolls} dialogs=${c.dialogs}${gapTxt} vv=${snap.vv?.height ?? '?'} sheetOpen=${snap.page.sheetOpen}`;
}

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '(unset)';
}

function readSafeArea(): DebugEnvSnapshot['safeArea'] {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;'
    + 'padding-top:env(safe-area-inset-top,0px);'
    + 'padding-right:env(safe-area-inset-right,0px);'
    + 'padding-bottom:env(safe-area-inset-bottom,0px);'
    + 'padding-left:env(safe-area-inset-left,0px);';
  document.body.appendChild(el);
  const cs = getComputedStyle(el);
  const out = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  el.remove();
  return out;
}

function rectOf(el: Element): DebugRect {
  const r = el.getBoundingClientRect();
  return {
    top: round1(r.top),
    left: round1(r.left),
    width: round1(r.width),
    height: round1(r.height),
    bottom: round1(r.bottom),
    right: round1(r.right),
  };
}

function parseZIndex(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

function readComputedBox(el: HTMLElement): DebugComputedBox {
  const cs = getComputedStyle(el);
  return {
    position: cs.position,
    top: cs.top,
    right: cs.right,
    bottom: cs.bottom,
    left: cs.left,
    width: cs.width,
    height: cs.height,
    maxWidth: cs.maxWidth,
    maxHeight: cs.maxHeight,
    minHeight: cs.minHeight,
    zIndex: cs.zIndex,
    zIndexNum: parseZIndex(cs.zIndex),
    backgroundColor: cs.backgroundColor,
    opacity: cs.opacity,
    visibility: cs.visibility,
    display: cs.display,
    transform: cs.transform === 'none' ? 'none' : cs.transform,
    overflow: cs.overflow,
    overflowY: cs.overflowY,
    pointerEvents: cs.pointerEvents,
    boxSizing: cs.boxSizing,
    paddingTop: cs.paddingTop,
    paddingBottom: cs.paddingBottom,
    borderRadius: cs.borderRadius,
  };
}

function pickAttrs(el: HTMLElement, names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    const v = el.getAttribute(name);
    if (v != null && v !== '') out[name] = v;
  }
  return out;
}

type OverlayProbe = {
  kind: string;
  selector: string;
  attrNames?: string[];
  withChrome?: boolean;
};

const OVERLAY_PROBES: OverlayProbe[] = [
  { kind: 'float-panel', selector: '[data-float-panel]', attrNames: ['data-ux', 'data-density', 'aria-label', 'aria-modal'], withChrome: true },
  { kind: 'sheet-underlay', selector: '[data-sheet-underlay], .sheet-page-underlay', attrNames: ['data-sheet-underlay'] },
  { kind: 'sheet-backdrop', selector: '[data-sheet-backdrop], .sheet-backdrop', attrNames: ['data-sheet-backdrop'] },
  { kind: 'sheet-subview', selector: '[data-sheet-subview]', attrNames: ['data-sheet-subview'] },
  { kind: 'float-scroll', selector: '[data-float-scroll]', attrNames: [] },
  { kind: 'float-footer', selector: '[data-float-footer]', attrNames: [] },
  { kind: 'dialog', selector: '[role="dialog"]', attrNames: ['role', 'aria-label', 'aria-modal'] },
  { kind: 'header-more-menu', selector: '.header-more-menu', attrNames: ['role'] },
  { kind: 'mobile-sticky-top', selector: '.mobile-sticky-top', attrNames: [] },
  { kind: 'auth-gate', selector: '.auth-gate-root', attrNames: [] },
  { kind: 'auth-sheet', selector: '.auth-sheet-root', attrNames: [] },
  { kind: 'debug-fab', selector: '.mm-debug-fab', attrNames: [] },
  { kind: 'debug-panel', selector: '.mm-debug-panel', attrNames: ['role'] },
];

function snapOverlay(
  el: HTMLElement,
  kind: string,
  attrNames: string[],
  withChrome: boolean,
  vv: DebugEnvSnapshot['vv'],
  innerW: number,
  innerH: number,
): DebugOverlaySnap {
  const rect = rectOf(el);
  const computed = readComputedBox(el);
  const gapsVsVv = vv
    ? calcOverlayViewportGaps(rect, vv.width, vv.height, vv.offsetTop, vv.offsetLeft)
    : null;
  const gapsVsInner = calcOverlayViewportGaps(rect, innerW, innerH, 0, 0);
  const scrollEl = withChrome ? el.querySelector<HTMLElement>('[data-float-scroll]') : null;
  const footerEl = withChrome ? el.querySelector<HTMLElement>('[data-float-footer]') : null;
  const subviewEls = withChrome
    ? Array.from(el.querySelectorAll<HTMLElement>('[data-sheet-subview]'))
    : [];
  return {
    kind,
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    className: typeof el.className === 'string' ? el.className : '',
    attrs: pickAttrs(el, attrNames),
    rect,
    offset: {
      offsetWidth: el.offsetWidth,
      offsetHeight: el.offsetHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
    },
    computed,
    gapsVsVv,
    gapsVsInner,
    children: withChrome
      ? {
        scroll: scrollEl ? rectOf(scrollEl) : null,
        footer: footerEl ? rectOf(footerEl) : null,
        subviews: subviewEls.map((node) => ({
          name: node.getAttribute('data-sheet-subview') || '',
          rect: rectOf(node),
          offsetHeight: node.offsetHeight,
          scrollHeight: node.scrollHeight,
        })),
      }
      : undefined,
  };
}

function readActiveElement() {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || el === document.body) return null;
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    className: typeof el.className === 'string' ? el.className.slice(0, 120) : '',
    type: el.getAttribute('type') || '',
    name: el.getAttribute('name') || '',
  };
}

function readPageSnap(bodyClass: string): DebugPageSnap {
  const main = document.querySelector('main');
  return {
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    title: document.title || '',
    visibilityState: document.visibilityState,
    readyState: document.readyState,
    sheetOpen: /\bsheet-open\b/.test(bodyClass),
    activeElement: readActiveElement(),
    main: main ? rectOf(main) : null,
    counts: {
      floatPanels: 0,
      backdrops: 0,
      dialogs: 0,
      overlays: 0,
      sheetSubviews: 0,
      floatScrolls: 0,
      floatFooters: 0,
    },
  };
}

/** 从当前页面采集调试快照（页面 + 浮层 + 内页 subview/scroll/footer） */
export function collectDebugEnvSnapshot(): DebugEnvSnapshot {
  const vvApi = window.visualViewport;
  const vv = vvApi
    ? {
      width: vvApi.width,
      height: vvApi.height,
      offsetTop: vvApi.offsetTop,
      offsetLeft: vvApi.offsetLeft,
      scale: vvApi.scale,
    }
    : null;
  const innerW = window.innerWidth;
  const innerH = window.innerHeight;
  const bodyClass = document.body.className;
  const seen = new Set<HTMLElement>();
  const overlays: DebugOverlaySnap[] = [];
  for (const probe of OVERLAY_PROBES) {
    const nodes = document.querySelectorAll<HTMLElement>(probe.selector);
    nodes.forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      overlays.push(
        snapOverlay(el, probe.kind, probe.attrNames || [], Boolean(probe.withChrome), vv, innerW, innerH),
      );
    });
  }
  return buildDebugEnvSnapshot({
    ua: navigator.userAgent,
    standalone: Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone
      || window.matchMedia('(display-mode: standalone)').matches,
    ),
    page: readPageSnap(bodyClass),
    innerWidth: innerW,
    innerHeight: innerH,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    screenAvailHeight: window.screen.availHeight,
    vv,
    cssVars: {
      vvHeight: readCssVar('--vv-height'),
      vvOffsetTop: readCssVar('--vv-offset-top'),
      kbInset: readCssVar('--kb-inset'),
    },
    safeArea: readSafeArea(),
    scrollY: window.scrollY || 0,
    bodyClass,
    htmlClass: document.documentElement.className,
    overlays,
  });
}

const DEBUG_LS_KEY = 'mm-debug';

/** 默认开启；?debug=0 / localStorage=0 关闭；?debug=1 强制开启 */
export function resolveDebugEnabled(search = typeof window !== 'undefined' ? window.location.search : ''): boolean {
  const q = new URLSearchParams(search).get('debug');
  if (typeof window === 'undefined') {
    if (q === '0' || q === 'false') return false;
    return true;
  }
  if (q === '1' || q === 'true') {
    window.localStorage.setItem(DEBUG_LS_KEY, '1');
    return true;
  }
  if (q === '0' || q === 'false') {
    window.localStorage.setItem(DEBUG_LS_KEY, '0');
    return false;
  }
  return window.localStorage.getItem(DEBUG_LS_KEY) !== '0';
}

export function formatDebugSnapshot(snap: DebugEnvSnapshot): string {
  return JSON.stringify(snap, null, 2);
}
