'use client';

/**
 * 顶栏账号入口 + 鉴权表单
 * variant=bar：顶栏 Link（主页访客改走「访客」圆形菜单，一般不再用）
 * variant=page：独立鉴权页（左上角 logo + 居中表单）
 * variant=gate：同 page 的居中表单（可选，非 lockMode 可页内切 mode）
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
    // 同步 --vv-height / --kb-inset；键盘弹起时滚入焦点字段
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
        <div className="w-full max-w-sm">
            <h1 className="text-xl font-semibold">
                {mode === 'login' ? '登录' : '注册'}
            </h1>
            {!lockMode && (
                <div className="mt-3 flex gap-2 text-xs">
                    <button type="button" className={`touch-btn rounded-full px-3 py-1.5 ${mode === 'login' ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => { setMode('login'); setError(''); }}>登录</button>
                    <button type="button" className={`touch-btn rounded-full px-3 py-1.5 ${mode === 'register' ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => { setMode('register'); setError(''); }}>注册</button>
                </div>
            )}
            <form className="mt-5 space-y-3" onSubmit={(event) => void submit(event)} onFocusCapture={onFormFocusCapture}>
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
                    <label className="block text-xs text-slate-500">账号
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
                <label className="block text-xs text-slate-500">密码
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
            {lockMode ? (
                <p className="mt-4 text-center text-sm text-slate-500">
                    <Link
                        href={authHref(mode === 'login' ? 'register' : 'login')}
                        className="underline hover:text-ink"
                    >
                        {mode === 'login' ? '去注册' : '去登录'}
                    </Link>
                </p>
            ) : null}
        </div>
    );

    if (variant === 'gate' || variant === 'page') {
        return (
            <div className="relative flex min-h-0 flex-1 flex-col">
                {/* 左上角站点 logo：回首页 */}
                <Link
                    href="/"
                    className="absolute left-3 top-3 z-10 flex items-center gap-2 sm:left-6 sm:top-4"
                    aria-label="返回首页"
                >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-sm font-bold text-white">M</span>
                    <span className="text-sm font-semibold">财务规划</span>
                </Link>
                <div
                    className={authGateRootClassName()}
                    role="dialog"
                    aria-modal="true"
                    aria-label={mode === 'login' ? '登录' : '注册'}
                >
                    {formCard}
                </div>
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
