/**
 * 密码哈希：Web Crypto PBKDF2-SHA256（Workers / Node 均可用）
 */

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let binary = '';
    for (let i = 0; i < arr.length; i += 1) binary += String.fromCharCode(arr[i]!);
    return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
}

export type PasswordRecord = {
    algo: 'pbkdf2-sha256';
    iterations: number;
    salt: string;
    hash: string;
};

export async function hashPassword(password: string): Promise<PasswordRecord> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
        key,
        KEY_BITS,
    );
    return { algo: 'pbkdf2-sha256', iterations: ITERATIONS, salt: toBase64(salt), hash: toBase64(bits) };
}

export async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
    if (record.algo !== 'pbkdf2-sha256' || !record.salt || !record.hash) return false;
    const salt = fromBase64(record.salt);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: salt as BufferSource, iterations: record.iterations || ITERATIONS, hash: 'SHA-256' },
        key,
        KEY_BITS,
    );
    const actual = toBase64(bits);
    // 定长时间比较，避免提前返回
    if (actual.length !== record.hash.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i += 1) diff |= actual.charCodeAt(i) ^ record.hash.charCodeAt(i);
    return diff === 0;
}

export function randomToken(bytes = 32): string {
    const buf = crypto.getRandomValues(new Uint8Array(bytes));
    return toBase64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
