'use client';

/**
 * 月度资产明细：打开态下沉到本组件，避免 setState 重渲整页图表；
 * 表体先画首屏行，再分帧补全，避免一次挂载 ~360 行卡主线程。
 */
import { startTransition, useEffect, useRef, useState, type ReactNode } from 'react';
import FloatPanel from './FloatPanel';

export type MonthlyAssetDetailRow = {
  month: number;
  label: string;
  cash: number;
  investment: number;
  total: number;
  available: number;
};

/** 首帧行数（约一屏多一点）；其余 rAF + startTransition 分块挂载 */
export const ASSET_DETAIL_INITIAL_ROWS = 48;
export const ASSET_DETAIL_CHUNK_ROWS = 80;

const money = (value: number) =>
  `¥${Math.round(value).toLocaleString('zh-CN')}`;

type Props = {
  rows: MonthlyAssetDetailRow[];
  /** 「真正可动用的钱」表头（可带 InfoTip） */
  availableHeader?: ReactNode;
};

/** 「查看明细」按钮 + 浮层；open state 不进 page 根组件 */
export function AssetDetailsEntry({
  rows,
  availableHeader,
}: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="text-sm font-semibold text-coral-deep"
      >
        查看明细
      </button>
      <FloatPanel
        open={open}
        anchorRef={btnRef}
        onClose={() => setOpen(false)}
        width={620}
        mode="sheet"
        density="panel"
        headerTitle="月度资产明细"
      >
        {open ? (
          <MonthlyAssetDetailTable
            rows={rows}
            availableHeader={availableHeader}
          />
        ) : null}
      </FloatPanel>
    </>
  );
}

export default function MonthlyAssetDetailTable({
  rows,
  availableHeader = '真正可动用的钱',
}: Props) {
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(ASSET_DETAIL_INITIAL_ROWS, rows.length),
  );

  useEffect(() => {
    setVisibleCount(Math.min(ASSET_DETAIL_INITIAL_ROWS, rows.length));
    if (rows.length <= ASSET_DETAIL_INITIAL_ROWS) return;

    let cancelled = false;
    let count = ASSET_DETAIL_INITIAL_ROWS;
    let raf = 0;

    const pump = () => {
      if (cancelled) return;
      count = Math.min(rows.length, count + ASSET_DETAIL_CHUNK_ROWS);
      startTransition(() => {
        if (!cancelled) setVisibleCount(count);
      });
      if (count < rows.length) {
        raf = window.requestAnimationFrame(pump);
      }
    };

    raf = window.requestAnimationFrame(pump);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [rows]);

  const visible =
    visibleCount >= rows.length ? rows : rows.slice(0, visibleCount);

  return (
    <div className="table-wrap table-scroll">
      <table>
        <thead>
          <tr>
            <th>月份</th>
            <th>现金余额</th>
            <th>理财资产</th>
            <th>预计总资产</th>
            <th>{availableHeader}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.month}>
              <td>{row.label}</td>
              <td>{money(row.cash)}</td>
              <td>{money(row.investment)}</td>
              <td>{money(row.total)}</td>
              <td>{money(row.available)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
