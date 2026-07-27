'use client';

/**
 * 顶栏账号入口 + 鉴权表单
 * variant=bar：顶栏 Link（主页访客改走「访客」圆形菜单，一般不再用）
 * variant=page：独立鉴权页表单（lockMode 时不在本页切 mode）
 * variant=gate：保留全屏门禁形态（可选）
 */
import Link from 'next/link';
import { FormEvent, FocusEvent, useEffect, useState } from 'react';
import { authHref } from '../lib/auth/authHref';
import { authGateRootClassName } from '../lib/ui/authGateShell';
import { scrollFocusedFieldIntoView, useVisualViewport } from '../lib/useVisualViewport';

export type AuthUser = { id: string; username: string; email: string };
export type AuthMode = 'login' | 'register';
export type AuthMeta = { from: AuthMode };

const USERNAME_MAX = 32;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

type Props = {
    user: AuthUser | null;
    /** from：空账号绑定时区分注册默认初始化 / 登录确认 */
    onAuthed?: (user: AuthUser, meta: AuthMeta) => void;
    onLogout: () => void;
    /** bar=顶栏跳转；page=独立鉴权页；gate=全屏门禁（可选） */
    variant?: 'bar' | 'page' | 'gate';
    /** page/gate：初始模式 */
    initialMode?: AuthMode;
    /** page：锁定当前模式，用 Link 去另一页（不在本页 toggle） */
    lockMode?: boolean;
    /**
     * 已登录时是否渲染用户 chip + 登出。
     * 收进「更多」菜单时传 false。
     */
    showLoggedInControls?: boolean;
    /** 跳转鉴权页前冲刷本机草稿（避免 400ms 防抖未落盘） */
    onBeforeNavigate?: () => void;
};

export default function AuthBar({
    user,
    onAuthed,
    onLogout,
    variant = 'bar',
    initialMode = 'register',
    lockMode = false,
    showLoggedInControls = true,
    onBeforeNavigate,
}: Props) {
    // 同步 --vv-height / --kb-inset，供门禁与 auth 页 CSS 使用
    useVisualViewport();
    const [mode, setMode] = useState<AuthMode>(initialMode);
    const [login, setLogin] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setMode(initialMode);
        setError('');
    }, [initialMode]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        if (mode === 'register') {
            if (password.length < PASSWORD_MIN) {
                setError(`密码至少 ${PASSWORD_MIN} 位`);
                return;
            }
            if (!confirm) {
                setError('请确认密码');
                return;
            }
            if (confirm !== password) {
                setError('两次密码不一致');
                return;
            }
        }
        setBusy(true);
        try {
            const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
            const body = mode === 'login'
                ? { login, password }
                : { username, password };
            const response = await fetch(path, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(typeof data.error === 'string' ? data.error : '请求失败');
                return;
            }
            if (data.user) {
                onAuthed?.(data.user as AuthUser, { from: mode });
                setPassword('');
                setConfirm('');
            }
        } catch {
            setError('网络异常，请重试');
        } finally {
            setBusy(false);
        }
    };

    const logout = async () => {
        setBusy(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            onLogout();
        } finally {
            setBusy(false);
        }
    };

    if (user) {
        if (!showLoggedInControls) return null;
        return (
            <div className="flex items-center gap-1.5">
                <span className="max-w-[7rem] truncate rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 sm:max-w-[10rem]" title={user.username}>
                    {user.username}
                </span>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => void logout()}
                    className="touch-btn rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:border-coral hover:text-coral-deep"
                >
                    登出
                </button>
            </div>
        );
    }

    const onFormFocusCapture = (event: FocusEvent) => {
        scrollFocusedFieldIntoView(event.target);
    };

    const formCard = (
        <div className={variant === 'bar'
            ? 'relative z-10 w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl'
            : 'relative z-10 w-full max-w-md rounded-3xl bg-white p-5 shadow-xl sm:p-6'}
        >
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold sm:text-lg">{mode === 'login' ? '登录' : '注册账号'}</h2>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 sm:text-xs">
                {mode === 'register'
                    ? '新账号使用系统默认数据起步；当前访客测算草稿不会绑定到账号。'
                    : '登录后读取你的云端数据；若账号为空，可选择绑定当前访客草稿。'}
            </p>
            <div className="mt-3 flex gap-2 text-xs">
                {lockMode ? (
                    <>
                        <span className={`touch-btn rounded-full px-3 py-1.5 ${mode === 'login' ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600'}`}>
                            {mode === 'login' ? '登录' : '注册'}
                        </span>
                        <Link
                            href={authHref(mode === 'login' ? 'register' : 'login')}
                            className="touch-btn rounded-full bg-slate-100 px-3 py-1.5 text-slate-600"
                        >
                            {mode === 'login' ? '去注册' : '去登录'}
                        </Link>
                    </>
                ) : (
                    <>
                        <button type="button" className={`touch-btn rounded-full px-3 py-1.5 ${mode === 'login' ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => { setMode('login'); setError(''); }}>登录</button>
                        <button type="button" className={`touch-btn rounded-full px-3 py-1.5 ${mode === 'register' ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => { setMode('register'); setError(''); }}>注册</button>
                    </>
                )}
            </div>
            <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)} onFocusCapture={onFormFocusCapture}>
                {mode === 'login' ? (
                    <label className="block text-xs text-slate-500">账号
                        <input
                            className="field-input mt-1"
                            name="username"
                            inputMode="text"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            autoComplete="username"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            required
                            maxLength={USERNAME_MAX}
                        />
                    </label>
                ) : (
                    <label className="block text-xs text-slate-500">账号（最长 {USERNAME_MAX} 位）
                        <input
                            className="field-input mt-1"
                            name="username"
                            inputMode="text"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            autoComplete="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            maxLength={USERNAME_MAX}
                        />
                    </label>
                )}
                <label className="block text-xs text-slate-500">
                    {mode === 'register'
                        ? `密码（${PASSWORD_MIN}–${PASSWORD_MAX} 位）`
                        : `密码（最长 ${PASSWORD_MAX} 位）`}
                    <input
                        className="field-input mt-1"
                        name="password"
                        type="password"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={mode === 'register' ? PASSWORD_MIN : undefined}
                        maxLength={PASSWORD_MAX}
                    />
                </label>
                {mode === 'register' && (
                    <label className="block text-xs text-slate-500">确认密码
                        <input
                            className="field-input mt-1"
                            name="new-password"
                            type="password"
                            autoComplete="new-password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            required
                            minLength={PASSWORD_MIN}
                            maxLength={PASSWORD_MAX}
                        />
                    </label>
                )}
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button type="submit" disabled={busy} className="touch-btn w-full rounded-xl bg-ink py-3 text-sm font-semibold text-white disabled:opacity-60">
                    {busy ? '处理中…' : mode === 'login' ? '登录' : '注册'}
                </button>
            </form>
            {(variant === 'gate' || variant === 'page') && (
                <button
                    type="button"
                    className="mt-3 w-full text-center text-xs text-slate-500 underline"
                    onClick={() => onLogout()}
                >
                    继续访客体验
                </button>
            )}
        </div>
    );

    if (variant === 'gate' || variant === 'page') {
        return (
            <div
                className={authGateRootClassName()}
                role="dialog"
                aria-modal="true"
                aria-label={mode === 'login' ? '登录' : '注册'}
            >
                <div className="mb-6 flex flex-col items-center gap-2 text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-lg font-bold text-white">M</div>
                    <p className="text-lg font-semibold">财务规划</p>
                    <p className="text-xs text-slate-400">
                        {variant === 'page'
                            ? (mode === 'login' ? '登录同步云端，或返回继续访客体验' : '注册默认数据起步，或返回继续访客体验')
                            : '登录同步云端，或继续访客体验'}
                    </p>
                </div>
                {formCard}
            </div>
        );
    }

    // 兼容：主页访客入口已改为「访客」圆形菜单
    return (
        <div className="flex items-center gap-1.5">
            <Link
                href={authHref('register')}
                onClick={() => onBeforeNavigate?.()}
                className="touch-btn rounded-full bg-coral px-3 text-[11px] font-semibold text-white hover:bg-coral-hover"
            >
                注册
            </Link>
            <Link
                href={authHref('login')}
                onClick={() => onBeforeNavigate?.()}
                className="touch-btn rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-ink hover:border-coral hover:text-coral-deep"
            >
                登录
            </Link>
        </div>
    );
}

/** 供父组件「更多」菜单调用的登出（无 UI） */
export async function logoutSession(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
}
