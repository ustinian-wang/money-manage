'use client';

/**
 * 顶栏账号区：登录 · 注册 · 登出
 * 规则：账号最长 32、密码最长 72；无最短、无邮箱；必填即可
 * variant=bar：顶栏按钮+sheet（访客默认可进主应用）
 * variant=gate：可选全屏门禁（本产品默认不用；保留给「继续访客」等入口）
 */
import { FormEvent, FocusEvent, useEffect, useState } from 'react';
import { scrollFocusedFieldIntoView, useVisualViewport } from '../lib/useVisualViewport';

export type AuthUser = { id: string; username: string; email: string };
export type AuthMode = 'login' | 'register';

const USERNAME_MAX = 32;
const PASSWORD_MAX = 72;

type Props = {
    user: AuthUser | null;
    /** from：用于空账号绑定时区分「注册认领」与「登录二次确认」 */
    onAuthed: (user: AuthUser, meta: { from: AuthMode }) => void;
    onLogout: () => void;
    /** bar=顶栏；gate=全屏门禁（可选） */
    variant?: 'bar' | 'gate';
    /** 外部请求打开表单（如顶栏「注册保存」） */
    openRequest?: AuthMode | null;
    onOpenRequestConsumed?: () => void;
    /**
     * 已登录时是否渲染用户 chip + 登出。
     * 收进「更多」菜单时传 false。
     */
    showLoggedInControls?: boolean;
    /** 访客：只显示「注册保存」（登录放「更多」），移动端顶栏用 */
    registerOnly?: boolean;
};

export default function AuthBar({
    user,
    onAuthed,
    onLogout,
    variant = 'bar',
    openRequest = null,
    onOpenRequestConsumed,
    showLoggedInControls = true,
    registerOnly = false,
}: Props) {
    // 同步 --vv-height / --kb-inset，供门禁与 auth sheet CSS 使用
    useVisualViewport();
    const [open, setOpen] = useState(variant === 'gate');
    const [mode, setMode] = useState<AuthMode>('login');
    const [login, setLogin] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    // 父组件「注册保存」等：打开对应模式表单
    useEffect(() => {
        if (!openRequest || user) return;
        setMode(openRequest);
        setOpen(true);
        setError('');
        onOpenRequestConsumed?.();
    }, [openRequest, user, onOpenRequestConsumed]);

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
                onAuthed(data.user as AuthUser, { from: mode });
                if (variant === 'bar') setOpen(false);
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

    const form = (
        <div className={variant === 'gate'
            ? 'relative z-10 w-full max-w-md rounded-3xl bg-white p-5 shadow-xl sm:p-6'
            : 'relative z-10 w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl'}
        >
            {variant === 'bar' && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />}
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold sm:text-lg">{mode === 'login' ? '登录' : '注册账号'}</h2>
                {variant === 'bar' && (
                    <button type="button" className="text-xs text-slate-400" onClick={() => setOpen(false)}>关闭</button>
                )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400 sm:text-xs">
                {mode === 'register'
                    ? '注册后会把当前页面上的访客/示例数据认领到你的账号并同步云端。'
                    : '登录后读取你的云端数据；若账号为空，可选择绑定当前访客草稿。'}
            </p>
            <div className="mt-3 flex gap-2 text-xs">
                <button type="button" className={`touch-btn rounded-full px-3 py-1.5 ${mode === 'login' ? 'bg-[#17212b] text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => { setMode('login'); setError(''); }}>登录</button>
                <button type="button" className={`touch-btn rounded-full px-3 py-1.5 ${mode === 'register' ? 'bg-[#17212b] text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => { setMode('register'); setError(''); }}>注册</button>
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
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button type="submit" disabled={busy} className="touch-btn w-full rounded-xl bg-[#17212b] py-3 text-sm font-semibold text-white disabled:opacity-60">
                    {busy ? '处理中…' : mode === 'login' ? '登录' : '注册并认领数据'}
                </button>
            </form>
            {variant === 'gate' && (
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

    if (variant === 'gate') {
        return (
            <div
                className="auth-gate-root flex flex-col items-center bg-[#f6f8f5] px-4 py-10 text-[#17212b]"
                role="dialog"
                aria-modal="true"
                aria-label={mode === 'login' ? '登录' : '注册'}
            >
                <div className="mb-6 flex flex-col items-center gap-2 text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#17212b] text-lg font-bold text-white">M</div>
                    <p className="text-lg font-semibold">财务管理</p>
                    <p className="text-xs text-slate-400">登录同步云端，或继续访客体验</p>
                </div>
                {form}
            </div>
        );
    }

    // 访客顶栏：注册保存为主 CTA；registerOnly 时登录收进父级「更多」
    return (
        <>
            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => { setMode('register'); setOpen(true); setError(''); }}
                    className="touch-btn rounded-full bg-[#f07f62] px-3 text-[11px] font-semibold text-white hover:bg-[#df6e51]"
                >
                    注册保存
                </button>
                {!registerOnly && (
                    <button
                        type="button"
                        onClick={() => { setMode('login'); setOpen(true); setError(''); }}
                        className="touch-btn rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-[#17212b] hover:border-[#f07f62] hover:text-[#d9654a]"
                    >
                        登录
                    </button>
                )}
            </div>
            {open && (
                <div
                    className="auth-sheet-root fixed z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label={mode === 'login' ? '登录' : '注册'}
                >
                    <button type="button" className="absolute inset-0 cursor-default" aria-label="关闭" onClick={() => setOpen(false)} />
                    {form}
                </div>
            )}
        </>
    );
}

/** 供父组件「更多」菜单调用的登出（无 UI） */
export async function logoutSession(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
}
