/**
 * 浮层统一标题栏：标题 + 关闭
 * FloatPanel 专用；业务内容勿再画一套标题/关闭
 */
import type { MouseEvent as ReactMouseEvent } from 'react';

export type PanelHeaderProps = {
  title: string;
  onClose: () => void;
  /** field 矮卡更紧；panel 默认 */
  density?: 'field' | 'panel';
  /** 移动 sheet：关闭按钮加 touch-btn */
  touchClose?: boolean;
  /** PC 可拖：标题栏可按住拖动 */
  draggable?: boolean;
  onMouseDown?: (event: ReactMouseEvent) => void;
};

export default function PanelHeader({
  title,
  onClose,
  density = 'panel',
  touchClose = false,
  draggable = false,
  onMouseDown,
}: PanelHeaderProps) {
  const isField = density === 'field';
  return (
    <div
      onMouseDown={onMouseDown}
      className={`flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 ${isField ? 'py-2.5' : 'py-3'} ${draggable ? 'cursor-move select-none' : ''}`}
      title={draggable ? '按住拖动面板' : undefined}
    >
      <h3 className={`min-w-0 truncate font-semibold text-slate-800 ${isField ? 'text-sm' : 'text-base'}`}>{title}</h3>
      <button
        type="button"
        onClick={onClose}
        className={`shrink-0 rounded-full px-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 ${touchClose ? 'touch-btn' : ''}`}
      >
        关闭
      </button>
    </div>
  );
}
