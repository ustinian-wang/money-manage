/**
 * 鉴权壳高度 class：禁止 min-h-screen 盖住 --vv-height
 * 根因：假/真 VV 变矮时 min-height:100vh 使 canScroll=false，密码区被挡
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { authGateRootClassName, authPageShellMainClassName } from './authGateShell';

describe('authGateShell 鉴权壳高度', () => {
  test('gate root 含 auth-gate-root，不含 min-h-screen', () => {
    const cls = authGateRootClassName();
    assert.match(cls, /\bauth-gate-root\b/);
    assert.doesNotMatch(cls, /\bmin-h-screen\b/);
    // min-h-0 避免其它来源的 min-height 再次盖住 height: var(--vv-height)
    assert.match(cls, /\bmin-h-0\b/);
  });

  test('page shell 就绪态不含 min-h-screen', () => {
    assert.doesNotMatch(authPageShellMainClassName(), /\bmin-h-screen\b/);
  });
});
