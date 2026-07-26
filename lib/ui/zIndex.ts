/**
 * 统一 overlay / sticky 层级常量
 * 规范：docs/notion-refactor-spec.md 流 A；globals.css 中 --z-* 须与此同步
 *
 * 语义别名：mask/panel/topbarMenu 与主档同值，业务优先用语义名，禁止魔法数。
 */
export const Z_INDEX = {
  content: 1,
  header: 40,
  /** Dropdown 档遮罩（比 dropdown 低 1） */
  dropdownBackdrop: 59,
  /** 同 dropdownBackdrop：通用 mask 语义 */
  mask: 59,
  dropdown: 60,
  drawer: 70,
  /** 同 drawer：顶栏更多菜单 */
  topbarMenu: 70,
  modal: 80,
  /** 同 modal：一级 FloatPanel */
  panel: 80,
  /** 二级嵌套 FloatPanel（须 > panel） */
  nestedPanel: 90,
  /** InfoTip 移动 backdrop（须 >= nestedPanel，且 < tip） */
  tipBackdrop: 94,
  /** InfoTip 气泡（须 >= nestedPanel，且 < toast） */
  tip: 95,
  toast: 100,
} as const;

export type ZIndexLayer = keyof typeof Z_INDEX;

/** 主阶梯（不含 mask/backdrop/别名）；Tailwind theme 与此同源 */
export const Z_INDEX_LAYERS = [
  'content',
  'header',
  'dropdown',
  'drawer',
  'modal',
  'nestedPanel',
  'tip',
  'toast',
] as const;
