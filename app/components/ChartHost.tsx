'use client';

/**
 * 图表宿主：接近视口后再动态加载 echarts，避免首屏主线程被大包阻塞。
 * 固定高度 + 可见/尺寸变化时 resize，避免 SSR/hydration 后 0×0。
 */
import { useEffect, useRef, useState } from 'react';

type ReactEChartsComponent = typeof import('echarts-for-react').default;

export default function ChartHost({
  option,
  className = '',
}: {
  option: Record<string, unknown>;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<InstanceType<ReactEChartsComponent> | null>(null);
  const [ReactECharts, setReactECharts] = useState<ReactEChartsComponent | null>(
    null,
  );
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          io.disconnect();
        }
      },
      { rootMargin: '240px 0px', threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport) return;
    let cancelled = false;
    const load = () => {
      void import('echarts-for-react').then((mod) => {
        if (!cancelled) setReactECharts(() => mod.default);
      });
    };
    // 等主线程空闲再拉 echarts，避免和首屏 hydration 抢 TBT
    let idleId: number | undefined;
    let timer: number | undefined;
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(load, { timeout: 1500 });
    } else {
      timer = window.setTimeout(load, 200);
    }
    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [nearViewport]);

  useEffect(() => {
    if (!ReactECharts) return;
    const el = wrapRef.current;
    if (!el) return;
    const resize = () => {
      try {
        chartRef.current?.getEchartsInstance()?.resize();
      } catch {
        /* chart may unmount */
      }
    };
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => resize())
        : null;
    ro?.observe(el);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          requestAnimationFrame(resize);
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    const timer = window.setTimeout(resize, 80);
    return () => {
      ro?.disconnect();
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [ReactECharts]);

  return (
    <div
      ref={wrapRef}
      className={`chart-box overflow-hidden rounded-2xl bg-slate-50 p-2 sm:p-3 ${className}`}
    >
      {ReactECharts ? (
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: '100%', width: '100%', minHeight: 220 }}
          opts={{ renderer: 'canvas' }}
          notMerge
          lazyUpdate
          onChartReady={(chart) => chart.resize()}
        />
      ) : null}
    </div>
  );
}
