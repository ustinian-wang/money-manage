/**
 * 统一 overlay / sticky 层级常量
 * 规范：docs/notion-refactor-spec.md 流 A；globals.css 中 --z-* 须与此同步
 */
export const Z_INDEX = {
  content: 1,
  header: 40,
  /** InfoTip 移动 backdrop、Dropdown 遮罩（比 dropdown 低 1） */
  dropdownBackdrop: 59,
  dropdown: 60,
  drawer: 70,
  modal: 80,
  toast: 100,
} as const;

export type ZIndexLayer = keyof typeof Z_INDEX;

/** 六档主阶梯（不含 dropdownBackdrop 等子层）；Tailwind theme 与此同源 */
export const Z_INDEX_LAYERS = [
  'content',
  'header',
  'dropdown',
  'drawer',
  'modal',
  'toast',
] as const;
