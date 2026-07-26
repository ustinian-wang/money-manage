/**
 * 鉴权页路由：/login · /register（可选 returnUrl）
 * 仅允许站内相对路径，防开放重定向
 */

export type AuthHrefMode = 'login' | 'register';

export function safeReturnUrl(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

export function parseAuthMode(value: string | null | undefined): AuthHrefMode {
  return value === 'login' ? 'login' : 'register';
}

/** 构建鉴权页 href；默认回跳首页 */
export function authHref(mode: AuthHrefMode, returnUrl = '/'): string {
  const path = mode === 'login' ? '/login' : '/register';
  const safe = safeReturnUrl(returnUrl);
  if (safe === '/') return path;
  const q = new URLSearchParams({ returnUrl: safe });
  return `${path}?${q.toString()}`;
}
