/**
 * 鉴权壳：普通页面居中，不用 fixed overflow / auth-gate-root
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { authGateRootClassName, authPageShellMainClassName } from './authGateShell';

describe('authGateShell 鉴权页布局', () => {
  test('gate root 为 flex 居中，不含 auth-gate-root', () => {
    const cls = authGateRootClassName();
    assert.doesNotMatch(cls, /\bauth-gate-root\b/);
    assert.match(cls, /\bflex\b/);
    assert.match(cls, /\bitems-center\b/);
    assert.match(cls, /\bjustify-center\b/);
  });

  test('page shell 用 min-h-screen 撑满视口', () => {
    const cls = authPageShellMainClassName();
    assert.match(cls, /\bmin-h-screen\b/);
    assert.match(cls, /\brelative\b/);
  });
});
