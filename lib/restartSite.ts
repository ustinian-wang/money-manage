/**
 * 纯客户端「重启网站」：只动浏览器侧 Cache Storage + Service Worker，再硬刷新。
 * 不调后端、不重启服务器；不碰 localStorage / cookie（访客草稿与登录态保留）。
 */
export async function clearSiteCaches(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {
    /* ignore SW errors */
  }
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* ignore cache errors */
  }
}

/** 确认后清客户端缓存并以 cache-bust 硬刷新（不碰业务 localStorage / 会话 cookie） */
export async function restartSite(): Promise<void> {
  if (typeof window === 'undefined') return;
  const ok = window.confirm(
    '清除浏览器缓存并刷新，不会删除你的本地草稿/登录状态。\n（仅客户端处理，不重启服务器）\n继续？',
  );
  if (!ok) return;
  await clearSiteCaches();
  const url = new URL(window.location.href);
  url.searchParams.set('_mmr', String(Date.now()));
  window.location.replace(url.toString());
}
