'use client';

/**
 * 通用浮层：PC popover / 移动 sheet；field 矮卡居中
 * 供 ConfirmDialog、Editable、明细面板等复用
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import PanelHeader from './PanelHeader';
import { useIsMobile } from '../../lib/useIsMobile';
import { ensureFocusedInVisualViewportNow, scrollFocusedFieldIntoView } from '../../lib/useVisualViewport';
import { FLOAT_MARGIN, placeCenteredInViewport, placeNearAnchor, placeSheetAtBottom, readSafeAreaInsets, viewportBounds } from '../../lib/floatPlace';
import { Z_INDEX } from '../../lib/ui/zIndex';
import { acquireSheetBodyLock, blockOverlayEvent } from '../../lib/ui/overlayEvents';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export type FloatPanelProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  width?: number;
  maxHeightVh?: number;
  center?: boolean;
  zIndex?: number;
  /** PC 大面板可拖；移动 sheet 模式忽略 */
  draggable?: boolean;
  headerTitle?: string;
  /** auto=按断点；popover=PC 锚点浮层；sheet=移动底部抽屉 */
  mode?: 'auto' | 'popover' | 'sheet';
  /** tip/field 轻量；panel 全套 sheet（仅 panel 抬升 maxHeight） */
  density?: 'tip' | 'field' | 'panel';
  /** 固定底栏（不随内容滚动），如保存/取消 */
  footer?: ReactNode;
  children: ReactNode;
};

export default function FloatPanel({
  open,
  anchorRef,
  onClose,
  width = 256,
  maxHeightVh = 70,
  center = false,
  zIndex = Z_INDEX.panel,
  draggable = false,
  headerTitle,
  mode = 'auto',
  density = 'panel',
  footer,
  children,
}: FloatPanelProps) {
  const isMobile = useIsMobile();
  // tip：永不 sheet；field/panel：移动 auto→底卡；仅 panel 用全套抬升
  const asSheet = density !== 'tip' && (mode === 'sheet' || (mode === 'auto' && isMobile));
  const liftFloor = asSheet && density === 'panel';
  const lockBody = asSheet && density === 'panel';
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const userDraggedRef = useRef(false);
  const dragRef = useRef<{ startX: number; startY: number; origTop: number; origLeft: number } | null>(null);

  useEffect(() => {
    if (!open) {
      userDraggedRef.current = false;
      return;
    }
    const safe = readSafeAreaInsets();
    const place = () => {
      if (userDraggedRef.current) return;
      const anchor = anchorRef.current;
      const vv = window.visualViewport;
      const viewLeft = vv?.offsetLeft ?? 0;
      const viewW = vv?.width ?? window.innerWidth;
      const viewH = vv?.height ?? window.innerHeight;
      const vp = viewportBounds(vv, window.innerWidth, window.innerHeight, FLOAT_MARGIN, safe);
      const maxH = viewH * ((liftFloor ? Math.max(maxHeightVh, 72) : maxHeightVh) / 100);
      const panelH = Math.min(panelRef.current?.offsetHeight ?? 240, maxH);
      const panelW = asSheet && density === 'panel'
        ? viewW
        : Math.min(width, Math.max(0, vp.right - vp.left));
      let left: number;
      let top: number;
      let nextW = panelW;
      if (asSheet && density === 'panel') {
        // panel sheet：贴底全宽，仅防左右溢出
        const sheet = placeSheetAtBottom(panelH, vp, viewLeft, viewW, true);
        top = sheet.top;
        left = sheet.left;
        nextW = sheet.width;
      } else if (density === 'field' || center) {
        // field 小编辑：默认视口居中；被键盘挡住则上移夹紧
        const c = placeCenteredInViewport(panelW, panelH, vp);
        top = c.top;
        left = c.left;
      } else if (anchor) {
        const rect = anchor.getBoundingClientRect();
        const near = placeNearAnchor(rect, panelW, panelH, vp, 8, 'start');
        top = near.top;
        left = near.left;
      } else {
        const c = placeCenteredInViewport(panelW, panelH, vp);
        top = c.top;
        left = c.left;
      }
      setPos({ top, left, width: nextW });
      // 键盘改 VV 后浮层已上移/贴底；若焦点在面板内再校正一次内部滚动
      const active = document.activeElement;
      if (active && panelRef.current?.contains(active)) {
        ensureFocusedInVisualViewportNow(active);
      }
    };
    // 仅 panel sheet 锁滚动；field 矮卡 / tip / PC 不锁
    const releaseBodyLock = lockBody ? acquireSheetBodyLock(document.body) : undefined;
    place();
    const raf = window.requestAnimationFrame(() => {
      place();
      window.requestAnimationFrame(place);
    });
    const vv = window.visualViewport;
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    vv?.addEventListener('resize', place);
    vv?.addEventListener('scroll', place);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      vv?.removeEventListener('resize', place);
      vv?.removeEventListener('scroll', place);
      releaseBodyLock?.();
    };
  }, [open, anchorRef, width, maxHeightVh, center, asSheet, density, liftFloor, lockBody]);

  useEffect(() => {
    if (!open) return;
    const trigger = anchorRef.current;
    const raf = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(raf);
      trigger?.focus({ preventScroll: true });
    };
  }, [open, anchorRef]);

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onHeaderMouseDown = (event: ReactMouseEvent) => {
    if (!draggable || asSheet || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea, label')) return;
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startY: event.clientY, origTop: pos.top, origLeft: pos.left };
    const onMove = (moveEvent: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const panelW = Math.min(width, window.innerWidth - 32);
      const panelH = Math.min(panelRef.current?.offsetHeight ?? 240, window.innerHeight * (maxHeightVh / 100));
      const nextLeft = clamp(drag.origLeft + (moveEvent.clientX - drag.startX), 8, Math.max(8, window.innerWidth - panelW - 8));
      const nextTop = clamp(drag.origTop + (moveEvent.clientY - drag.startY), 8, Math.max(8, window.innerHeight - Math.min(panelH, 80) - 8));
      userDraggedRef.current = true;
      setPos((current) => ({ top: nextTop, left: nextLeft, width: current.width }));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (!open) return null;
  const sheetMaxVh = liftFloor ? Math.max(maxHeightVh, 78) : maxHeightVh;
  const isPanelSheet = asSheet && density === 'panel';
  const isFieldCard = asSheet && density === 'field';
  const panelWidth = pos.width
    || (isPanelSheet
      ? (typeof window !== 'undefined' ? window.innerWidth : width)
      : Math.min(width, typeof window !== 'undefined' ? window.innerWidth - 16 : width));
  // PC：仅显式标题/可拖时出标题栏；移动 panel/field：标题+关闭
  const showHeader = asSheet || Boolean(headerTitle) || draggable;
  return createPortal(
    <>
      {asSheet && (
        <div
          data-sheet-backdrop
          className="sheet-backdrop"
          style={{ zIndex: zIndex - 1 }}
          aria-hidden
          onPointerDown={blockOverlayEvent}
          onPointerUp={blockOverlayEvent}
          onClick={blockOverlayEvent}
        />
      )}
      <div
        ref={panelRef}
        data-float-panel
        data-ux={isPanelSheet ? 'sheet' : isFieldCard ? 'field-card' : 'popover'}
        data-density={density}
        role="dialog"
        aria-modal={asSheet ? 'true' : undefined}
        aria-label={headerTitle || '编辑'}
        tabIndex={-1}
        onKeyDown={onPanelKeyDown}
        onFocusCapture={(event) => { scrollFocusedFieldIntoView(event.target); }}
        className={`fixed flex flex-col overscroll-contain border border-slate-200 bg-white ${isPanelSheet ? 'rounded-t-3xl rounded-b-none border-b-0 shadow-2xl' : 'rounded-2xl shadow-xl'} overflow-hidden`}
        style={{
          top: pos.top,
          left: pos.left,
          zIndex,
          width: panelWidth,
          maxHeight: asSheet || density === 'field' || center
            ? `min(${sheetMaxVh}dvh, var(--vv-height, ${sheetMaxVh}vh))`
            : `${sheetMaxVh}vh`,
          // place() 已按 visualViewport 贴底/居中夹紧，勿再叠 --kb-inset
          paddingBottom: asSheet ? 'env(safe-area-inset-bottom, 0px)' : undefined,
        }}
      >
        {isPanelSheet && <div className="sheet-handle" aria-hidden />}
        {showHeader && (
          <PanelHeader
            title={headerTitle || '编辑'}
            onClose={onClose}
            density={isFieldCard ? 'field' : 'panel'}
            touchClose={asSheet}
            draggable={draggable && !asSheet}
            onMouseDown={onHeaderMouseDown}
          />
        )}
        <div data-float-scroll className={`min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain ${isFieldCard ? 'p-3' : 'p-4'}`}>
          {children}
        </div>
        {footer && (
          <div className={`shrink-0 border-t border-slate-100 bg-white ${isFieldCard ? 'px-3 py-2.5' : 'px-4 py-3'}`}>
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
