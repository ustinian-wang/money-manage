/**
 * 会话 cookie 解析：从 Cookie 头读 mm_session
 * ponytail: 测 store.readSessionToken；不加载 next/server
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SESSION_COOKIE, readSessionToken } from './store';

describe('readSessionToken', () => {
    test('无 cookie / 无匹配返回 null', () => {
        assert.equal(readSessionToken(new Request('http://local/')), null);
        assert.equal(
            readSessionToken(new Request('http://local/', { headers: { cookie: 'other=1' } })),
            null,
        );
    });

    test('解析 mm_session，支持 URL 编码与多 cookie', () => {
        const token = 'abc.def_ghi';
        const req = new Request('http://local/', {
            headers: { cookie: `a=1; ${SESSION_COOKIE}=${encodeURIComponent(token)}; b=2` },
        });
        assert.equal(readSessionToken(req), token);
    });
});
