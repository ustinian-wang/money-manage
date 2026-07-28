'use client';

/**
 * 内页外壳：顶栏（标题+关闭/返回）+ 内容滚动区 + 可选底栏。
 * FloatPanel density=panel 全屏内页与 field 矮卡共用此壳，避免业务各写一套布局。
 * 定位/遮罩/portal 仍由 FloatPanel 负责；safe-area 由外层 padding 消化。
 */
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import PanelHeader from './PanelHeader';

export type SheetPageShellProps = {
  title?: string;
  onClose: () => void;
  /** 同 sheet 子页：返回一级（不关整层） */
  onBack?: () => void;
  footer?: ReactNode;
  /** panel=内页感；field=矮卡紧凑 padding */
  density?: 'field' | 'panel';
  /** 移动 sheet：关闭/返回加 touch-btn */
  touchClose?: boolean;
  draggable?: boolean;
  onHeaderMouseDown?: (event: ReactMouseEvent) => void;
  showHeader?: boolean;
  children: ReactNode;
};

export default function SheetPageShell({
  title,
  onClose,
  onBack,
  footer,
  density = 'panel',
  touchClose = false,
  draggable = false,
  onHeaderMouseDown,
  showHeader = true,
  children,
}: SheetPageShellProps) {
  const isField = density === 'field';
  return (
    <>
      {showHeader && (
        <PanelHeader
          title={title || '编辑'}
          onClose={onClose}
          onBack={onBack}
          density={isField ? 'field' : 'panel'}
          touchClose={touchClose}
          draggable={draggable}
          onMouseDown={onHeaderMouseDown}
        />
      )}
      <div
        data-float-scroll
        className={`min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain ${isField ? 'p-3' : 'p-4'}`}
      >
        {children}
      </div>
      {footer && (
        <div
          data-float-footer
          className={`shrink-0 border-t border-slate-100 bg-white ${isField ? 'px-3 py-2.5' : 'px-4 py-3'}`}
        >
          {footer}
        </div>
      )}
    </>
  );
}
