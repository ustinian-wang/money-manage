'use client';

/**
 * select + 数字输入同行布局：全端强制一行（含窄屏）。
 * 数字槽优先：flex-1 + min-w；select 可略缩，避免挤没 SoftNumberInput。
 * SoftNumberInput 等由调用方传入，本组件只管布局（最小 API）。
 */
import type { ReactNode } from 'react';

export type SelectNumberFieldProps = {
  /** native <select>（或等价控件） */
  select: ReactNode;
  /** SoftNumberInput（或包裹后的数字槽） */
  input: ReactNode;
  className?: string;
};

export default function SelectNumberField({
  select,
  input,
  className = '',
}: SelectNumberFieldProps) {
  return (
    <div
      className={`flex min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2${className ? ` ${className}` : ''}`}
    >
      {/* select 可 shrink，窄屏时让位给数字 */}
      <div className="min-w-0 shrink">{select}</div>
      {/* 数字优先：min-w 保可读；覆盖 field-row 下 .field-value-with-unit 的 min-w-0/max-w 挤压 */}
      <div className="min-w-[6.75rem] flex-1 [&_.field-value-with-unit]:max-w-none [&_.field-value-with-unit]:min-w-[6.75rem]">
        {input}
      </div>
    </div>
  );
}
