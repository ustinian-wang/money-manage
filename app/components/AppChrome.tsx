'use client';

/**
 * 根壳客户端能力：VV 同步、焦点滚入、可选调试浮层
 */
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import ViewportSync from './ViewportSync';

const DebugConsole = dynamic(() => import('./DebugConsole'), { ssr: false });

export default function AppChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <ViewportSync />
      <DebugConsole />
      {children}
    </>
  );
}
