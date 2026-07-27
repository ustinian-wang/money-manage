/**
 * 用户 / 会话：存 KV（或本地 data/）文本键
 * keys: user:{id}/account.json · idx:username:{name} · idx:email:{email}（可选）· session:{token}
 * 兼容旧扁平键 user:{id}（本地曾与 profile 目录冲突，读时迁移）
 * 账号：仅最长；密码：注册最短 PASSWORD_MIN + 最长 PASSWORD_MAX（登录不复检最短）
 * 邮箱产品面不要求，存库可空
 */
import { hashPassword, randomToken, verifyPassword, type PasswordRecord } from './crypto';
import { deleteDataText, readDataText, writeDataText } from '../persistence/localFs';
import { getMoneyDataBinding } from '../persistence/cloudflareBinding';

export const SESSION_COOKIE = 'mm_session';
export const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 天
export const USERNAME_MAX = 32;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export type PublicUser = {
    id: string;
    username: string;
    /** 兼容旧数据；新注册可为空串 */
    email: string;
};

export type UserRecord = PublicUser & {
    password: PasswordRecord;
    createdAt: string;
};

export type SessionRecord = {
    userId: string;
    createdAt: string;
    expiresAt: string;
};

type RemoteStore = {
    getText(key: string): Promise<string | null>;
    putText(key: string, value: string, expirationTtl?: number): Promise<void>;
    deleteKey?(key: string): Promise<void>;
};

async function getRemoteStore(): Promise<RemoteStore | null> {
    const binding = await getMoneyDataBinding();
    if (!binding) return null;
    return {
        async getText(key) {
            const value = await binding.get(key, 'text');
            if (value == null) return null;
            if (typeof value === 'string') return value;
            if (typeof (value as { text?: () => Promise<string> }).text === 'function') {
                return (value as { text: () => Promise<string> }).text();
            }
            return String(value);
        },
        async putText(key, body, expirationTtl) {
            if (expirationTtl) await binding.put(key, body, { expirationTtl });
            else await binding.put(key, body);
        },
        async deleteKey(key) {
            if (typeof binding.delete === 'function') await binding.delete(key);
        },
    };
}

/** KV 键含冒号；本地落盘见 localFs（Win/Linux 共用） */
async function readText(key: string): Promise<string | null> {
    const remote = await getRemoteStore();
    if (remote) return remote.getText(key);
    return readDataText(key);
}

async function writeText(key: string, body: string, expirationTtl?: number): Promise<void> {
    const remote = await getRemoteStore();
    if (remote) {
        await remote.putText(key, body, expirationTtl);
        return;
    }
    // 本地：TTL 仅作元数据旁路，不主动过期（dev 足够）
    void expirationTtl;
    await writeDataText(key, body);
}

async function deleteText(key: string): Promise<void> {
    const remote = await getRemoteStore();
    if (remote?.deleteKey) {
        await remote.deleteKey(key);
        return;
    }
    await deleteDataText(key);
}

/** 用户记录：嵌套在 user:{id}/ 下，避免与 financial-profile 等同目录文件抢扁平路径 */
function userKey(id: string) {
    return `user:${id}/account.json`;
}
/** 旧扁平键（本地曾写成单文件，与 profile 目录冲突） */
function legacyUserKey(id: string) {
    return `user:${id}`;
}
function usernameIndexKey(username: string) {
    return `idx:username:${username.toLowerCase()}`;
}
function emailIndexKey(email: string) {
    return `idx:email:${email.toLowerCase()}`;
}
function sessionKey(token: string) {
    return `session:${token}`;
}

export function normalizeUsername(raw: string): string {
    return raw.trim();
}

export function normalizeEmail(raw: string): string {
    return raw.trim().toLowerCase();
}

/** 账号：必填 + 最长 USERNAME_MAX；无最短、无字符集限制 */
export function validateUsername(username: string): string | null {
    if (!username) return '请输入账号';
    if (username.length > USERNAME_MAX) return `账号最长 ${USERNAME_MAX} 位`;
    return null;
}

/** 邮箱可选：有值才校验格式（兼容旧账号；产品面不要求） */
export function validateEmail(email: string): string | null {
    if (!email) return null;
    if (email.length > 120) return '邮箱过长';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '邮箱格式不正确';
    return null;
}

/** 密码（注册用）：必填 + 最短 PASSWORD_MIN + 最长 PASSWORD_MAX；登录走 authenticateUser，不调用本函数 */
export function validatePassword(password: string): string | null {
    if (!password) return '请输入密码';
    if (password.length < PASSWORD_MIN) return `密码至少 ${PASSWORD_MIN} 位`;
    if (password.length > PASSWORD_MAX) return `密码最长 ${PASSWORD_MAX} 位`;
    return null;
}

function toPublic(user: UserRecord): PublicUser {
    return { id: user.id, username: user.username, email: user.email || '' };
}

export async function findUserById(id: string): Promise<UserRecord | null> {
    let raw = await readText(userKey(id));
    if (!raw) {
        raw = await readText(legacyUserKey(id));
        if (raw) {
            // 抬升到 account.json，释放扁平路径
            try {
                await writeText(userKey(id), raw.endsWith('\n') ? raw : `${raw}\n`);
                await deleteText(legacyUserKey(id));
            } catch {
                /* 迁移失败仍可用旧内容登录 */
            }
        }
    }
    if (!raw) return null;
    try {
        return JSON.parse(raw) as UserRecord;
    } catch {
        return null;
    }
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
    const id = await readText(usernameIndexKey(username));
    if (!id) return null;
    return findUserById(id.trim());
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
    if (!email) return null;
    const id = await readText(emailIndexKey(email));
    if (!id) return null;
    return findUserById(id.trim());
}

export async function registerUser(input: {
    username: string;
    email?: string;
    password: string;
}): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string; status: number }> {
    const username = normalizeUsername(input.username);
    const email = input.email ? normalizeEmail(input.email) : '';
    const usernameErr = validateUsername(username);
    if (usernameErr) return { ok: false, error: usernameErr, status: 400 };
    const emailErr = validateEmail(email);
    if (emailErr) return { ok: false, error: emailErr, status: 400 };
    const passwordErr = validatePassword(input.password);
    if (passwordErr) return { ok: false, error: passwordErr, status: 400 };

    if (await findUserByUsername(username)) return { ok: false, error: '账号已被占用', status: 409 };
    if (email && (await findUserByEmail(email))) return { ok: false, error: '邮箱已被占用', status: 409 };

    const id = randomToken(16);
    const user: UserRecord = {
        id,
        username,
        email,
        password: await hashPassword(input.password),
        createdAt: new Date().toISOString(),
    };
    await writeText(userKey(id), `${JSON.stringify(user)}\n`);
    await writeText(usernameIndexKey(username), id);
    if (email) await writeText(emailIndexKey(email), id);
    return { ok: true, user: toPublic(user) };
}

export async function authenticateUser(
    login: string,
    password: string,
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string; status: number }> {
    const trimmed = login.trim();
    if (!trimmed || !password) return { ok: false, error: '请输入账号与密码', status: 400 };
    // 优先按账号查；含 @ 时再尝试旧邮箱索引（兼容）
    let user = await findUserByUsername(normalizeUsername(trimmed));
    if (!user && trimmed.includes('@')) {
        user = await findUserByEmail(normalizeEmail(trimmed));
    }
    if (!user) return { ok: false, error: '账号或密码错误', status: 401 };
    const ok = await verifyPassword(password, user.password);
    if (!ok) return { ok: false, error: '账号或密码错误', status: 401 };
    return { ok: true, user: toPublic(user) };
}

export async function createSession(userId: string): Promise<string> {
    const token = randomToken(32);
    const now = Date.now();
    const record: SessionRecord = {
        userId,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + SESSION_TTL_SEC * 1000).toISOString(),
    };
    await writeText(sessionKey(token), `${JSON.stringify(record)}\n`, SESSION_TTL_SEC);
    return token;
}

export async function getSessionUser(token: string | undefined | null): Promise<PublicUser | null> {
    if (!token) return null;
    const raw = await readText(sessionKey(token));
    if (!raw) return null;
    let record: SessionRecord;
    try {
        record = JSON.parse(raw) as SessionRecord;
    } catch {
        return null;
    }
    if (!record.userId || new Date(record.expiresAt).getTime() < Date.now()) {
        await deleteText(sessionKey(token));
        return null;
    }
    const user = await findUserById(record.userId);
    return user ? toPublic(user) : null;
}

export async function destroySession(token: string | undefined | null): Promise<void> {
    if (!token) return;
    await deleteText(sessionKey(token));
}

/** 从 Request Cookie 头解析会话 token（无 Next 依赖，便于单测） */
export function readSessionToken(request: Request): string | null {
    const header = request.headers.get('cookie') || '';
    const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
    return match ? decodeURIComponent(match[1]!) : null;
}

/** 简易暴力防护：按 key 计数，超限拒绝（KV TTL / 本地旁路） */
export async function checkRateLimit(bucket: string, limit: number, windowSec: number): Promise<boolean> {
    const key = `ratelimit:${bucket}`;
    const raw = await readText(key);
    let count = 0;
    if (raw) {
        try {
            count = Number((JSON.parse(raw) as { count?: number }).count) || 0;
        } catch {
            count = 0;
        }
    }
    if (count >= limit) return false;
    await writeText(key, `${JSON.stringify({ count: count + 1 })}\n`, windowSec);
    return true;
}
