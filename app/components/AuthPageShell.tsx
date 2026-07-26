'use client';

/**
 * 鉴权页共用壳：已登录回跳、空账号绑定、认领摘要
 * 供 /login · /register 复用；不做 mode 糊页
 */
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthBar, { type AuthMeta, type AuthMode, type AuthUser } from '../AuthBar';
import { safeReturnUrl } from '../../lib/auth/authHref';
import { bindEmptyAccountAfterAuth } from '../../lib/auth/bindEmptyAccount';
import { claimSummaryLinesFromStorage } from '../../lib/auth/claimSummaryFromDraft';

type Props = {
  mode: AuthMode;
  title: string;
};

function AuthPageShellInner({ mode, title }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const returnUrl = safeReturnUrl(search.get('returnUrl'));
  const [ready, setReady] = useState(false);
  const [claimSummaryLines, setClaimSummaryLines] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const data = await meRes.json();
          if (data.user) {
            router.replace(returnUrl);
            return;
          }
        }
      } catch { /* 访客 */ }
      if (!cancelled) {
        if (mode === 'register') setClaimSummaryLines(claimSummaryLinesFromStorage());
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router, returnUrl, mode]);

  const goHomeGuest = () => {
    router.push('/');
  };

  const onAuthed = async (_user: AuthUser, meta: AuthMeta) => {
    await bindEmptyAccountAfterAuth(meta);
    router.push(returnUrl);
  };

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8f5] text-[#17212b]">
        <p className="text-sm text-slate-400">加载中…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8f5] text-[#17212b]" aria-label={title}>
      <AuthBar
        user={null}
        variant="page"
        initialMode={mode}
        lockMode
        claimSummaryLines={claimSummaryLines}
        onAuthed={(user, meta) => { void onAuthed(user, meta); }}
        onLogout={goHomeGuest}
      />
    </main>
  );
}

export default function AuthPageShell(props: Props) {
  return (
    <Suspense
      fallback={(
        <main className="flex min-h-screen items-center justify-center bg-[#f6f8f5] text-[#17212b]">
          <p className="text-sm text-slate-400">加载中…</p>
        </main>
      )}
    >
      <AuthPageShellInner {...props} />
    </Suspense>
  );
}
