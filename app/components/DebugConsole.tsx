'use client';

/**
 * 类 vConsole 调试浮层
 * 本机默认开启；线上默认隐藏，?debug=true|1 开启并持久化，?debug=0|false 关闭
 * 刷新/上报均重新采集：页面 + 浮层 + 内页（subview/scroll/footer）
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  collectDebugEnvSnapshot,
  formatDebugSnapshot,
  resolveDebugEnabled,
  summarizeDebugSnapshot,
  type DebugEnvSnapshot,
} from '../../lib/debugEnvSnapshot';
import {
  applyImportedProfile,
  parseImportProfileJson,
  resolveExportProfile,
  serializeProfileForClipboard,
} from '../../lib/debugProfileTransfer';
import { Z_INDEX } from '../../lib/ui/zIndex';

const PROMO_LINKS: Array<{ href: string; label: string }> = [
  { href: '/promo-mobile.html', label: 'promo' },
  { href: '/promo-mobile.html?static=1', label: 'promo static' },
  { href: '/', label: '/' },
  { href: '/login', label: 'login' },
  { href: '/register', label: 'register' },
  { href: '/icons/icon-192.png', label: 'icon-192' },
  { href: '/icons/icon-512.png', label: 'icon-512' },
];

export default function DebugConsole() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<DebugEnvSnapshot | null>(null);
  const [status, setStatus] = useState('');
  const [mounted, setMounted] = useState(false);
  const [importText, setImportText] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

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

  /** 导出用户数据 → 剪贴板（主路径） */
  const exportProfile = async () => {
    try {
      const profile = await resolveExportProfile();
      if (!profile) {
        setStatus('无可导出的用户数据（本机草稿与云端均为空）');
        return;
      }
      const payload = serializeProfileForClipboard(profile);
      await navigator.clipboard.writeText(payload);
      setStatus('已复制到剪贴板');
    } catch (err) {
      setStatus(`导出失败：${err instanceof Error ? err.message : '无法写入剪贴板'}`);
    }
  };

  const runImportText = async (raw: string) => {
    const parsed = parseImportProfileJson(raw);
    if (!parsed.ok) {
      setStatus(`导入失败：${parsed.error}`);
      return;
    }

    const ok = window.confirm(
      '将用所选 JSON 覆盖当前用户数据（不可撤销）。\n登录态会写云端+本机；访客只写本机草稿。\n确定继续？',
    );
    if (!ok) {
      setStatus('已取消导入');
      return;
    }

    setStatus('正在导入覆盖…');
    const applied = await applyImportedProfile(parsed.profile);
    if (!applied.ok) {
      setStatus(`导入失败：${applied.error}`);
      return;
    }
    setStatus(applied.mode === 'user' ? '已覆盖云端+本机，刷新中…' : '已覆盖本机草稿，刷新中…');
    window.location.reload();
  };

  const pasteAndImport = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      setImportText(clip);
      await runImportText(clip);
    } catch {
      setStatus('读取剪贴板失败，请粘贴到下方文本框后点「从文本导入」');
    }
  };

  const onImportFile = async (file: File | null) => {
    if (!file) return;
    try {
      const raw = await file.text();
      setImportText(raw);
      await runImportText(raw);
    } catch {
      setStatus('读取文件失败');
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
            <button type="button" onClick={() => void exportProfile()}>导出用户数据</button>
            <button type="button" onClick={() => void pasteAndImport()}>粘贴导入</button>
            <button type="button" onClick={() => void runImportText(importText)}>从文本导入</button>
            <button type="button" onClick={() => importInputRef.current?.click()}>选文件导入</button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="mm-debug-file"
              aria-label="选择要导入的用户数据 JSON"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = '';
                void onImportFile(file);
              }}
            />
            <button type="button" onClick={disable}>关闭调试</button>
          </div>
          <label className="mm-debug-import">
            <span className="mm-debug-import-label">导入 JSON（可粘贴）</span>
            <textarea
              className="mm-debug-import-ta"
              rows={3}
              value={importText}
              placeholder='在此粘贴 profile JSON，或点「粘贴导入」'
              onChange={(event) => setImportText(event.target.value)}
              spellCheck={false}
            />
          </label>
          <nav className="mm-debug-links" aria-label="宣发/页面">
            <span className="mm-debug-links-label">宣发/页面</span>
            {PROMO_LINKS.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </nav>
          {status && <p className="mm-debug-status">{status}</p>}
          <pre className="mm-debug-pre">{text || '点击「刷新最新」采集页面/浮层/内页…'}</pre>
        </div>
      )}
    </>,
    document.body,
  );
}
