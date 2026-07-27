/**
 * ConfirmDialog / 登录空账号绑定：契约（无 window.confirm）
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const confirmDialog = readFileSync(new URL('./components/ConfirmDialog.tsx', import.meta.url), 'utf8');
const authShell = readFileSync(new URL('./components/AuthPageShell.tsx', import.meta.url), 'utf8');
const bindEmpty = readFileSync(new URL('../lib/auth/bindEmptyAccount.ts', import.meta.url), 'utf8');

describe('登录空账号 ConfirmDialog 契约', () => {
  it('ConfirmDialog 使用 Z_INDEX.toast + FloatPanel field', () => {
    assert.match(confirmDialog, /Z_INDEX\.toast/);
    assert.match(confirmDialog, /density="field"/);
    assert.match(confirmDialog, /from '\.\/FloatPanel'/);
  });

  it('AuthPageShell 注入 ConfirmDialog，不调用 window.confirm', () => {
    assert.match(authShell, /from '\.\/ConfirmDialog'/);
    assert.match(authShell, /confirmEmptyLogin:\s*askBindDraftConfirm/);
    assert.match(authShell, /EMPTY_LOGIN_BIND_MESSAGE/);
    assert.match(authShell, /confirmLabel="绑定草稿"/);
    assert.doesNotMatch(authShell, /window\.confirm/);
  });

  it('bindEmptyAccount 无 window.confirm 默认', () => {
    assert.doesNotMatch(bindEmpty, /window\.confirm/);
    assert.match(bindEmpty, /EMPTY_LOGIN_BIND_MESSAGE/);
  });
});
