'use client';

import { useEffect, useState } from 'react';
import { Z_INDEX } from '../lib/ui/zIndex';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * 浏览器「保存到桌面 / 添加到主屏幕」入口。
 * Chromium：beforeinstallprompt；Safari iOS：引导用分享菜单。
 */
export default function InstallToDesktop() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (standalone) {
      setInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome/.test(ua);
    if (isIos && isSafari) setIosHint(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // 不做 PWA 离线缓存：卸载旧 SW，避免壳/HTML 旧版；manifest 仍可用于「添加到主屏幕」
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        void Promise.all(regs.map((reg) => reg.unregister()));
      });
    }
    if (typeof caches !== 'undefined') {
      void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const onInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setDeferred(null);
  };

  if (deferred) {
    return (
      <button
        type="button"
        onClick={() => void onInstall()}
        className="touch-btn rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-[#17212b] hover:border-[#f07f62] hover:text-[#d9654a]"
        title="安装为桌面应用"
      >
        保存到桌面
      </button>
    );
  }

  if (iosHint) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowIosHelp((current) => !current)}
          className="touch-btn rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-[#17212b] hover:border-[#f07f62] hover:text-[#d9654a]"
        >
          保存到桌面
        </button>
        {showIosHelp && (
          <div className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm leading-6 text-slate-600 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-64 sm:p-3 sm:text-[11px] sm:leading-5 sm:shadow-xl" style={{ zIndex: Z_INDEX.drawer }}>
            <p className="font-semibold text-slate-800">添加到主屏幕</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>点底部分享按钮</li>
              <li>选择「添加到主屏幕」</li>
              <li>确认「添加」</li>
            </ol>
            <button type="button" className="touch-btn mt-3 w-full rounded-xl bg-[#17212b] text-xs font-semibold text-white sm:mt-2 sm:w-auto sm:bg-transparent sm:text-[#d9654a]" onClick={() => setShowIosHelp(false)}>知道了</button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
