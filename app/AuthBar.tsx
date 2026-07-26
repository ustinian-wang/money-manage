'use client';

/**
 * 顶栏账号入口 + 鉴权表单
 * variant=bar：顶栏 Link 跳 /login · /register（不再内嵌 sheet）
 * variant=page：独立鉴权页表单（lockMode 时不在本页切 mode）
 * variant=gate：保留全屏门禁形态（可选）
 */
import Link from 'next/link';
import { FormEvent, FocusEvent, useEffect, useState } from 'react';
import { authHref } from '../lib/auth/authHref';
import { scrollFocusedFieldIntoView, useVisualViewport } from '../lib/useVisualViewport';
import { parseClaimMode, type ClaimMode } from '../lib/claimGate';

export type AuthUser = { id: string; username: string; email: string };
export type AuthMode = 'login' | 'register';
export type AuthMeta = { from: AuthMode; claimMode?: ClaimMode };

const USERNAME_MAX = 32;
const PASSWORD_MAX = 72;

type Props = {
    user: AuthUser | null;
    /** from：空账号绑定时区分注册认领 / 登录确认；注册含 claimMode（page/gate 必填） */
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
    /** 访客：只显示「注册保存」（登录放「更多」），移动端顶栏用 */
    registerOnly?: boolean;
    /** 注册前展示将认领的摘要行（P0-1） */
    claimSummaryLines?: string[];
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
    registerOnly = false,
    claimSummaryLines = [],
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
    // 注册：默认认领当前数据；可改「清空示例后再注册」
    const [claimMode, setClaimMode] = useState<ClaimMode>('keep');

    useEffect(() => {
        setMode(initialMode);
        setError('');
    }, [initialMode]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        if (mode === 'register' && confirm && confirm !== password) {
            setError('两次密码不一致');
            return;
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
                onAuthed?.(data.user as AuthUser, {
                    from: mode,
                    ...(mode === 'register' ? { claimMode: parseClaimMode(claimMode) } : {}),
                });
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
                    className="touch-btn rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:border-[#f07f62] hover:text-[#d9654a]"
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
                    ? '注册前请确认：认领当前数据，或清空示例后再开空账号。'
                    : '登录后读取你的云端数据；若账号为空，可选择绑定当前访客草稿。'}
            </p>
            <div className="mt-3 flex gap-2 text-xs">
                {lockMode ? (
                    <>
                        <span className={`touch-btn rounded-full px-3 py-1.5 ${mode === 'login' ? 'bg-[#17212b] text-white' : 'bg-slate-100 text-slate-600'}`}>
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
                        <button type="button" className={`touch-btn rounded-full px-3 py-1.5 ${mode === 'login' ? 'bg-[#17212b] text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => { setMode('login'); setError(''); }}>登录</button>
                        <button type="button" className={`touch-btn rounded-full px-3 py-1.5 ${mode === 'register' ? 'bg-[#17212b] text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => { setMode('register'); setError(''); setClaimMode('keep'); }}>注册</button>
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
                <label className="block text-xs text-slate-500">密码（最长 {PASSWORD_MAX} 位）
                    <input
                        className="field-input mt-1"
                        name="password"
                        type="password"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        maxLength={PASSWORD_MAX}
                    />
                </label>
                {mode === 'register' && (
                    <label className="block text-xs text-slate-500">确认密码（可选）
                        <input
                            className="field-input mt-1"
                            name="new-password"
                            type="password"
                            autoComplete="new-password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            maxLength={PASSWORD_MAX}
                        />
                    </label>
                )}
                {mode === 'register' && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                        <p className="text-[11px] font-semibold text-slate-600">将写入账号的摘要</p>
                        {claimSummaryLines.length > 0 ? (
                            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-slate-500">
                                {claimSummaryLines.map((line) => <li key={line}>{line}</li>)}
                            </ul>
                        ) : (
                            <p className="mt-1 text-[11px] text-slate-400">当前页面数据</p>
                        )}
                        <fieldset className="mt-2 space-y-1.5 border-0 p-0">
                            <legend className="sr-only">认领方式</legend>
                            <label className="flex items-start gap-2 text-[11px] leading-snug text-slate-600">
                                <input
                                    type="radio"
                                    className="mt-0.5 accent-[#f07f62]"
                                    name="claimMode"
                                    checked={claimMode === 'keep'}
                                    onChange={() => setClaimMode('keep')}
                                />
                                <span>用当前数据认领（含示例/你改过的）</span>
                            </label>
                            <label className="flex items-start gap-2 text-[11px] leading-snug text-slate-600">
                                <input
                                    type="radio"
                                    className="mt-0.5 accent-[#f07f62]"
                                    name="claimMode"
                                    checked={claimMode === 'clear'}
                                    onChange={() => setClaimMode('clear')}
                                />
                                <span>清空示例后再注册（空账号起步）</span>
                            </label>
                        </fieldset>
                    </div>
                )}
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button type="submit" disabled={busy} className="touch-btn w-full rounded-xl bg-[#17212b] py-3 text-sm font-semibold text-white disabled:opacity-60">
                    {busy ? '处理中…' : mode === 'login' ? '登录' : (claimMode === 'clear' ? '注册并开空账号' : '注册并认领数据')}
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
                className="auth-gate-root flex min-h-screen flex-col items-center bg-[#f6f8f5] px-4 py-10 text-[#17212b]"
                role="dialog"
                aria-modal="true"
                aria-label={mode === 'login' ? '登录' : '注册'}
            >
                <div className="mb-6 flex flex-col items-center gap-2 text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#17212b] text-lg font-bold text-white">M</div>
                    <p className="text-lg font-semibold">财务管理</p>
                    <p className="text-xs text-slate-400">
                        {variant === 'page'
                            ? (mode === 'login' ? '登录同步云端，或返回继续访客体验' : '注册认领数据，或返回继续访客体验')
                            : '登录同步云端，或继续访客体验'}
                    </p>
                </div>
                {formCard}
            </div>
        );
    }

    // 访客顶栏：注册保存 → /register；登录 → /login
    return (
        <div className="flex items-center gap-1.5">
            <Link
                href={authHref('register')}
                onClick={() => onBeforeNavigate?.()}
                className="touch-btn rounded-full bg-[#f07f62] px-3 text-[11px] font-semibold text-white hover:bg-[#df6e51]"
            >
                注册保存
            </Link>
            {!registerOnly && (
                <Link
                    href={authHref('login')}
                    onClick={() => onBeforeNavigate?.()}
                    className="touch-btn rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-[#17212b] hover:border-[#f07f62] hover:text-[#d9654a]"
                >
                    登录
                </Link>
            )}
        </div>
    );
}

/** 供父组件「更多」菜单调用的登出（无 UI） */
export async function logoutSession(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
}
