'use client';

/**
 * 类 vConsole 调试浮层：默认开启
 * 刷新/上报均重新采集：页面 + 浮层 + 内页（subview/scroll/footer）
 * 关闭：?debug=0 或「关闭调试」；再开：?debug=1
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  collectDebugEnvSnapshot,
  formatDebugSnapshot,
  resolveDebugEnabled,
  summarizeDebugSnapshot,
  type DebugEnvSnapshot,
} from '../../lib/debugEnvSnapshot';
import { Z_INDEX } from '../../lib/ui/zIndex';

export default function DebugConsole() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<DebugEnvSnapshot | null>(null);
  const [status, setStatus] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setEnabled(resolveDebugEnabled());
  }, []);

  /** 双 rAF：等浮层/内页布局落稳再采 */
  const refresh = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const next = collectDebugEnvSnapshot();
        setSnap(next);
        console.info('[mm-debug]', next);
        setStatus(`已刷新最新 · ${summarizeDebugSnapshot(next)}`);
      });
    });
  }, []);

  useEffect(() => {
    if (!enabled || !open) return;
    refresh();
  }, [enabled, open, refresh]);

  if (!mounted || !enabled) return null;

  const text = snap ? formatDebugSnapshot(snap) : '';

  const copy = async () => {
    const payload = collectDebugEnvSnapshot();
    setSnap(payload);
    try {
      await navigator.clipboard.writeText(formatDebugSnapshot(payload));
      setStatus(`已复制最新 · ${summarizeDebugSnapshot(payload)}`);
    } catch {
      setStatus('复制失败，请手动选中文本');
    }
  };

  const report = async () => {
    const payload = collectDebugEnvSnapshot();
    setSnap(payload);
    console.info('[mm-debug]', payload);
    try {
      const res = await fetch('/api/debug-log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: formatDebugSnapshot(payload),
      });
      setStatus(
        res.ok
          ? `已上报最新（含内页）· ${summarizeDebugSnapshot(payload)}`
          : `上报失败 HTTP ${res.status}`,
      );
    } catch (err) {
      setStatus(`上报失败：${err instanceof Error ? err.message : 'network'}`);
    }
  };

  const disable = () => {
    window.localStorage.setItem('mm-debug', '0');
    setEnabled(false);
    setOpen(false);
  };

  return createPortal(
    <>
      <button
        type="button"
        className="mm-debug-fab"
        style={{ zIndex: Z_INDEX.toast + 10 }}
        aria-label={open ? '关闭调试' : '打开调试'}
        onClick={() => setOpen((v) => !v)}
      >
        dbg
      </button>
      {open && (
        <div className="mm-debug-panel" style={{ zIndex: Z_INDEX.toast + 11 }} role="dialog" aria-label="调试控制台">
          <div className="mm-debug-toolbar">
            <strong>Debug</strong>
            <button type="button" onClick={refresh}>刷新最新</button>
            <button type="button" onClick={() => void copy()}>复制</button>
            <button type="button" onClick={() => void report()}>上报终端</button>
            <button type="button" onClick={disable}>关闭调试</button>
          </div>
          {status && <p className="mm-debug-status">{status}</p>}
          <pre className="mm-debug-pre">{text || '点击「刷新最新」采集页面/浮层/内页…'}</pre>
        </div>
      )}
    </>,
    document.body,
  );
}
