/**
 * 鉴权自检：PBKDF2 哈希 / 校验
 * 需求：密码不明文存储（Web Crypto）
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, randomToken, verifyPassword } from './crypto';

test('同密码可校验，错密码失败，哈希非明文', async () => {
    const record = await hashPassword('SecretPass1');
    assert.equal(record.algo, 'pbkdf2-sha256');
    assert.ok(record.salt);
    assert.ok(record.hash);
    assert.notEqual(record.hash, 'SecretPass1');
    assert.equal(await verifyPassword('SecretPass1', record), true);
    assert.equal(await verifyPassword('wrong-pass', record), false);
});

test('randomToken 为 URL-safe 且两次不同', () => {
    const a = randomToken(16);
    const b = randomToken(16);
    assert.ok(a.length > 10);
    assert.match(a, /^[A-Za-z0-9_-]+$/);
    assert.notEqual(a, b);
});
