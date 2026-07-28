'use client';

/**
 * select + 数字输入同行布局：全端强制一行（含窄屏）；极窄时靠 min-w-0 压缩。
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
      className={`flex min-w-0 flex-nowrap items-center gap-2${className ? ` ${className}` : ''}`}
    >
      <div className="shrink-0">{select}</div>
      <div className="min-w-0">{input}</div>
    </div>
  );
}
