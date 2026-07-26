/**
 * authHref：/login · /register 与 returnUrl 白名单
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { authHref, parseAuthMode, safeReturnUrl } from './authHref';

describe('safeReturnUrl / parseAuthMode / authHref', () => {
  it('仅允许站内相对路径', () => {
    assert.equal(safeReturnUrl('/'), '/');
    assert.equal(safeReturnUrl('/foo?x=1'), '/foo?x=1');
    assert.equal(safeReturnUrl('https://evil.example'), '/');
    assert.equal(safeReturnUrl('//evil.example'), '/');
    assert.equal(safeReturnUrl(null), '/');
  });

  it('mode 默认 register；login 显式', () => {
    assert.equal(parseAuthMode('login'), 'login');
    assert.equal(parseAuthMode('register'), 'register');
    assert.equal(parseAuthMode(null), 'register');
  });

  it('拼 /login · /register；非首页才带 returnUrl', () => {
    assert.equal(authHref('login'), '/login');
    assert.equal(authHref('register'), '/register');
    assert.equal(authHref('login', '/charts'), '/login?returnUrl=%2Fcharts');
    assert.equal(authHref('register', '/charts'), '/register?returnUrl=%2Fcharts');
  });
});
