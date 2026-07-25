/**
 * 鉴权校验与注册/登录边界
 * 需求：账号最长 32、密码最长 72；无最短；邮箱可选
 * ponytail: 本地 data/ 落盘，测后尽力清理；不测 Cloudflare KV 路径
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
    PASSWORD_MAX,
    USERNAME_MAX,
    authenticateUser,
    createSession,
    destroySession,
    getSessionUser,
    normalizeEmail,
    normalizeUsername,
    registerUser,
    validateEmail,
    validatePassword,
    validateUsername,
} from './store';

describe('validateUsername / validatePassword / validateEmail', () => {
    test('账号必填且超长拒绝', () => {
        assert.equal(validateUsername(''), '请输入账号');
        assert.equal(validateUsername('a'.repeat(USERNAME_MAX)), null);
        assert.match(validateUsername('a'.repeat(USERNAME_MAX + 1)) || '', /最长/);
    });

    test('密码必填且超长拒绝，无最短限制', () => {
        assert.equal(validatePassword(''), '请输入密码');
        assert.equal(validatePassword('x'), null);
        assert.equal(validatePassword('p'.repeat(PASSWORD_MAX)), null);
        assert.match(validatePassword('p'.repeat(PASSWORD_MAX + 1)) || '', /最长/);
    });

    test('邮箱空通过；有值才校验格式与长度', () => {
        assert.equal(validateEmail(''), null);
        assert.equal(validateEmail('a@b.co'), null);
        assert.equal(validateEmail('not-an-email'), '邮箱格式不正确');
        assert.equal(validateEmail(`${'a'.repeat(118)}@x.co`), '邮箱过长');
    });

    test('normalize 去空白；邮箱小写', () => {
        assert.equal(normalizeUsername('  alice  '), 'alice');
        assert.equal(normalizeEmail('  Foo@Bar.COM '), 'foo@bar.com');
    });
});

describe('registerUser / authenticateUser / session', () => {
    const stamp = `${Date.now()}-${process.pid}`;
    const username = `u_${stamp}`.slice(0, USERNAME_MAX);
    const password = 'pw1';

    test('注册成功后可登录；错密/空登录失败；会话可读写可销毁', async () => {
        const created = await registerUser({ username, password });
        assert.equal(created.ok, true);
        if (!created.ok) return;

        // 重复账号
        const dup = await registerUser({ username, password: 'other' });
        assert.equal(dup.ok, false);
        if (!dup.ok) assert.equal(dup.status, 409);

        // 超长账号注册
        const longName = await registerUser({ username: 'x'.repeat(USERNAME_MAX + 1), password });
        assert.equal(longName.ok, false);
        if (!longName.ok) assert.equal(longName.status, 400);

        const okLogin = await authenticateUser(username, password);
        assert.equal(okLogin.ok, true);

        const badPass = await authenticateUser(username, 'wrong');
        assert.equal(badPass.ok, false);
        if (!badPass.ok) assert.equal(badPass.status, 401);

        const empty = await authenticateUser('', '');
        assert.equal(empty.ok, false);
        if (!empty.ok) assert.equal(empty.status, 400);

        const token = await createSession(created.user.id);
        const sessionUser = await getSessionUser(token);
        assert.equal(sessionUser?.id, created.user.id);
        assert.equal(sessionUser?.username, username);

        await destroySession(token);
        assert.equal(await getSessionUser(token), null);

        // 清理本测写入的用户索引与记录
        const data = path.join(process.cwd(), 'data');
        await fs.rm(path.join(data, `user:${created.user.id}`), { force: true });
        await fs.rm(path.join(data, `idx:username:${username.toLowerCase()}`), { force: true });
    });
});
