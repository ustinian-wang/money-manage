'use client';

/**
 * 关联数字（或任意成对）字段布局：宽屏并排、窄屏堆叠，中间链标表示等价联动。
 * SoftNumberInput 等由调用方以 children 传入，本组件只管布局（最小 API）。
 * alwaysRow：窄弹层内也强制一行（如资产配置理财金额↔占比）。
 */
import type { ReactNode } from 'react';

/** PS 锁比风格链标：表示等价联动（不可解锁） */
export function LinkLockIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export type LinkedNumberFieldsProps = {
  hint?: string;
  /** 左右两个字段（通常为 label + SoftNumberInput） */
  children: [ReactNode, ReactNode];
  /** true：始终一行；false：默认窄屏竖排、sm+ 横排 */
  alwaysRow?: boolean;
};

export default function LinkedNumberFields({
  hint,
  children,
  alwaysRow = false,
}: LinkedNumberFieldsProps) {
  return (
    <div className="linked-field-group rounded-xl border border-slate-200/90 bg-slate-50/70 px-2.5 py-2">
      <div className={alwaysRow ? 'flex flex-row items-stretch gap-1' : 'flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-1'}>
        <div className="min-w-0 flex-1">{children[0]}</div>
        <div
          className={alwaysRow
            ? 'flex w-7 shrink-0 flex-col items-center justify-center text-coral'
            : 'flex h-6 shrink-0 flex-row items-center justify-center gap-1 text-coral sm:h-auto sm:w-7 sm:flex-col sm:gap-0'}
          title="两项自动换算"
          aria-label="两项自动换算"
        >
          {alwaysRow ? (
            <>
              <span className="mb-0.5 h-2 w-px bg-coral/30" />
              <LinkLockIcon className="h-3.5 w-3.5" />
              <span className="mt-0.5 h-2 w-px bg-coral/30" />
            </>
          ) : (
            <>
              <span className="hidden h-2 w-px bg-coral/30 sm:mb-0.5 sm:block" />
              <span className="h-px w-6 bg-coral/30 sm:hidden" />
              <LinkLockIcon className="h-3.5 w-3.5" />
              <span className="h-px w-6 bg-coral/30 sm:hidden" />
              <span className="hidden h-2 w-px bg-coral/30 sm:mt-0.5 sm:block" />
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">{children[1]}</div>
      </div>
      {hint ? <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}
