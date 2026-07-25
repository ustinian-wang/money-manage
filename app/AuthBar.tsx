'use client';

/**
 * 顶栏账号区：登录 / 注册 sheet + 当前用户 / 登出
 * 规则：用户名 3–32 字母数字下划线；邮箱唯一；密码 8–72
 */
import { FormEvent, useState } from 'react';

export type AuthUser = { id: string; username: string; email: string };

type Props = {
    user: AuthUser | null;
    onAuthed: (user: AuthUser) => void;
    onLogout: () => void;
};

export default function AuthBar({ user, onAuthed, onLogout }: Props) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [login, setLogin] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setBusy(true);
        try {
            const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
            const body = mode === 'login'
                ? { login, password }
                : { username, email, password };
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
                onAuthed(data.user as AuthUser);
                setOpen(false);
                setPassword('');
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
        return (
            <div className="flex items-center gap-1.5">
                <span className="max-w-[7rem] truncate rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 sm:max-w-[10rem]" title={user.email}>
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

    return (
        <>
            <button
                type="button"
                onClick={() => { setMode('login'); setOpen(true); setError(''); }}
                className="touch-btn rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-[#17212b] hover:border-[#f07f62] hover:text-[#d9654a]"
            >
                登录
            </button>
            {open && (
                <div className="auth-sheet-root fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={mode === 'login' ? '登录' : '注册'}>
                    <button type="button" className="absolute inset-0 cursor-default" aria-label="关闭" onClick={() => setOpen(false)} />
                    <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
                        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-base font-semibold">{mode === 'login' ? '登录' : '注册账号'}</h2>
                            <button type="button" className="text-xs text-slate-400" onClick={() => setOpen(false)}>关闭</button>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                            未登录仅本地试玩；登录后数据绑定到你的账号并同步服务端。
                        </p>
                        <div className="mt-3 flex gap-2 text-xs">
                            <button type="button" className={`rounded-full px-3 py-1 ${mode === 'login' ? 'bg-[#17212b] text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => { setMode('login'); setError(''); }}>登录</button>
                            <button type="button" className={`rounded-full px-3 py-1 ${mode === 'register' ? 'bg-[#17212b] text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => { setMode('register'); setError(''); }}>注册</button>
                        </div>
                        <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
                            {mode === 'login' ? (
                                <label className="block text-xs text-slate-500">用户名或邮箱
                                    <input className="field-input mt-1" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required />
                                </label>
                            ) : (
                                <>
                                    <label className="block text-xs text-slate-500">用户名（3–32，字母数字下划线）
                                        <input className="field-input mt-1" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" />
                                    </label>
                                    <label className="block text-xs text-slate-500">邮箱（唯一）
                                        <input className="field-input mt-1" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                    </label>
                                </>
                            )}
                            <label className="block text-xs text-slate-500">密码（8–72 位）
                                <input className="field-input mt-1" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={72} />
                            </label>
                            {error && <p className="text-xs text-red-600">{error}</p>}
                            <button type="submit" disabled={busy} className="touch-btn w-full rounded-xl bg-[#17212b] py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                                {busy ? '处理中…' : mode === 'login' ? '登录' : '注册并登录'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
