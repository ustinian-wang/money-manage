'use client';

/**
 * 鉴权页共用壳：已登录回跳、空账号绑定、认领摘要
 * 供 /login · /register 复用；不做 mode 糊页
 */
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthBar, { type AuthMeta, type AuthMode, type AuthUser } from '../AuthBar';
import ConfirmDialog from './ConfirmDialog';
import { safeReturnUrl } from '../../lib/auth/authHref';
import {
  EMPTY_LOGIN_BIND_MESSAGE,
  bindEmptyAccountAfterAuth,
} from '../../lib/auth/bindEmptyAccount';
import { claimSummaryLinesFromStorage } from '../../lib/auth/claimSummaryFromDraft';
import { authPageShellMainClassName } from '../../lib/ui/authGateShell';

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
  const [bindConfirmOpen, setBindConfirmOpen] = useState(false);
  const bindConfirmResolverRef = useRef<((ok: boolean) => void) | null>(null);
  const bindConfirmAnchorRef = useRef<HTMLElement | null>(null);

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

  const askBindDraftConfirm = () => new Promise<boolean>((resolve) => {
    bindConfirmResolverRef.current = resolve;
    setBindConfirmOpen(true);
  });

  const settleBindConfirm = (ok: boolean) => {
    const resolve = bindConfirmResolverRef.current;
    bindConfirmResolverRef.current = null;
    setBindConfirmOpen(false);
    resolve?.(ok);
  };

  const onAuthed = async (_user: AuthUser, meta: AuthMeta) => {
    await bindEmptyAccountAfterAuth(meta, {
      confirmEmptyLogin: askBindDraftConfirm,
    });
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
    <main ref={bindConfirmAnchorRef} className={authPageShellMainClassName()} aria-label={title}>
      <AuthBar
        user={null}
        variant="page"
        initialMode={mode}
        lockMode
        claimSummaryLines={claimSummaryLines}
        onAuthed={(user, meta) => { void onAuthed(user, meta); }}
        onLogout={goHomeGuest}
      />
      <ConfirmDialog
        open={bindConfirmOpen}
        anchorRef={bindConfirmAnchorRef}
        title="绑定访客草稿"
        message={EMPTY_LOGIN_BIND_MESSAGE}
        confirmLabel="绑定草稿"
        confirmTone="primary"
        onCancel={() => settleBindConfirm(false)}
        onConfirm={() => settleBindConfirm(true)}
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
