'use client';

/**
 * 兼容旧入口 /auth?mode=：redirect 到 /login 或 /register
 */
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authHref, parseAuthMode, safeReturnUrl } from '../../lib/auth/authHref';

function AuthRedirectInner() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const mode = parseAuthMode(search.get('mode'));
    const returnUrl = safeReturnUrl(search.get('returnUrl'));
    router.replace(authHref(mode, returnUrl));
  }, [router, search]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper text-ink">
      <p className="text-sm text-slate-400">正在跳转…</p>
    </main>
  );
}

export default function AuthRedirectPage() {
  return (
    <Suspense
      fallback={(
        <main className="flex min-h-screen items-center justify-center bg-paper text-ink">
          <p className="text-sm text-slate-400">正在跳转…</p>
        </main>
      )}
    >
      <AuthRedirectInner />
    </Suspense>
  );
}
