'use client';

/**
 * 二次确认：复用 FloatPanel field 矮卡（居中），勿用裸 window.confirm
 * zIndex = Z_INDEX.toast，盖在普通 sheet 之上
 */
import type { RefObject } from 'react';
import FloatPanel from './FloatPanel';
import { Z_INDEX } from '../../lib/ui/zIndex';

export type ConfirmDialogProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** 确认按钮文案；默认「确认」 */
  confirmLabel?: string;
  /** danger=红（删除）；primary=主题色（绑定等） */
  confirmTone?: 'danger' | 'primary';
};

const CONFIRM_BTN: Record<'danger' | 'primary', string> = {
  danger: 'touch-btn flex-1 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100',
  primary: 'touch-btn flex-1 rounded-xl bg-coral px-3 py-2.5 text-sm font-semibold text-white hover:bg-coral-hover',
};

export default function ConfirmDialog({
  open,
  anchorRef,
  title,
  message,
  onCancel,
  onConfirm,
  confirmLabel = '确认',
  confirmTone = 'danger',
}: ConfirmDialogProps) {
  return (
    <FloatPanel
      open={open}
      anchorRef={anchorRef}
      onClose={onCancel}
      width={340}
      maxHeightVh={42}
      center
      density="field"
      zIndex={Z_INDEX.toast}
      headerTitle={title}
    >
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{message}</p>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onCancel} className="touch-btn flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">取消</button>
        <button type="button" onClick={onConfirm} className={CONFIRM_BTN[confirmTone]}>{confirmLabel}</button>
      </div>
    </FloatPanel>
  );
}
