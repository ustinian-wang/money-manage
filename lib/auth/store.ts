/**
 * 用户 / 会话：存 KV（或本地 data/）文本键
 * keys: user:{id} · idx:username:{name} · idx:email:{email} · session:{token}
 */
import { hashPassword, randomToken, verifyPassword, type PasswordRecord } from './crypto.ts';

export const SESSION_COOKIE = 'mm_session';
export const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 天

export type PublicUser = {
    id: string;
    username: string;
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
    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const { env } = await getCloudflareContext({ async: true });
        const bag = env as {
            MONEY_DATA?: {
                get(key: string, type?: string): Promise<unknown>;
                put(key: string, value: string, options?: { expirationTtl?: number }): Promise<unknown>;
                delete?(key: string): Promise<unknown>;
            };
        };
        const binding = bag.MONEY_DATA;
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
    } catch {
        return null;
    }
}

async function readText(key: string): Promise<string | null> {
    const remote = await getRemoteStore();
    if (remote) return remote.getText(key);
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.join(process.cwd(), 'data', key);
    try {
        return await fs.readFile(file, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
    }
}

async function writeText(key: string, body: string, expirationTtl?: number): Promise<void> {
    const remote = await getRemoteStore();
    if (remote) {
        await remote.putText(key, body, expirationTtl);
        return;
    }
    // 本地：TTL 仅作元数据旁路，不主动过期（dev 足够）
    void expirationTtl;
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.join(process.cwd(), 'data', key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temp, body, 'utf8');
    await fs.rename(temp, file);
}

async function deleteText(key: string): Promise<void> {
    const remote = await getRemoteStore();
    if (remote?.deleteKey) {
        await remote.deleteKey(key);
        return;
    }
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    try {
        await fs.unlink(path.join(process.cwd(), 'data', key));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
}

function userKey(id: string) {
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

/** 用户名 3–32：字母数字下划线；或合法邮箱作登录名 */
export function validateUsername(username: string): string | null {
    if (username.length < 3 || username.length > 32) return '用户名长度需 3–32 位';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return '用户名仅允许字母、数字、下划线';
    return null;
}

export function validateEmail(email: string): string | null {
    if (email.length < 5 || email.length > 120) return '邮箱长度不合法';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '邮箱格式不正确';
    return null;
}

export function validatePassword(password: string): string | null {
    if (password.length < 8 || password.length > 72) return '密码长度需 8–72 位';
    return null;
}

function toPublic(user: UserRecord): PublicUser {
    return { id: user.id, username: user.username, email: user.email };
}

export async function findUserById(id: string): Promise<UserRecord | null> {
    const raw = await readText(userKey(id));
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
    const id = await readText(emailIndexKey(email));
    if (!id) return null;
    return findUserById(id.trim());
}

export async function registerUser(input: {
    username: string;
    email: string;
    password: string;
}): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string; status: number }> {
    const username = normalizeUsername(input.username);
    const email = normalizeEmail(input.email);
    const usernameErr = validateUsername(username);
    if (usernameErr) return { ok: false, error: usernameErr, status: 400 };
    const emailErr = validateEmail(email);
    if (emailErr) return { ok: false, error: emailErr, status: 400 };
    const passwordErr = validatePassword(input.password);
    if (passwordErr) return { ok: false, error: passwordErr, status: 400 };

    if (await findUserByUsername(username)) return { ok: false, error: '用户名已被占用', status: 409 };
    if (await findUserByEmail(email)) return { ok: false, error: '邮箱已被占用', status: 409 };

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
    await writeText(emailIndexKey(email), id);
    return { ok: true, user: toPublic(user) };
}

export async function authenticateUser(
    login: string,
    password: string,
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string; status: number }> {
    const trimmed = login.trim();
    if (!trimmed || !password) return { ok: false, error: '请输入账号与密码', status: 400 };
    const byEmail = trimmed.includes('@');
    const user = byEmail
        ? await findUserByEmail(normalizeEmail(trimmed))
        : await findUserByUsername(normalizeUsername(trimmed));
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
