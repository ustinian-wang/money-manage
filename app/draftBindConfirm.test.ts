/**
 * ConfirmDialog / 登录空账号绑定 / 访客顶栏菜单：契约
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const confirmDialog = readFileSync(new URL('./components/ConfirmDialog.tsx', import.meta.url), 'utf8');
const authShell = readFileSync(new URL('./components/AuthPageShell.tsx', import.meta.url), 'utf8');
const bindEmpty = readFileSync(new URL('../lib/auth/bindEmptyAccount.ts', import.meta.url), 'utf8');
const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const authBar = readFileSync(new URL('./AuthBar.tsx', import.meta.url), 'utf8');

describe('登录空账号 ConfirmDialog 契约', () => {
  it('ConfirmDialog 使用 Z_INDEX.toast + FloatPanel field', () => {
    assert.match(confirmDialog, /Z_INDEX\.toast/);
    assert.match(confirmDialog, /density="field"/);
    assert.match(confirmDialog, /from '\.\/FloatPanel'/);
  });

  it('AuthPageShell 登录注入 ConfirmDialog，不调用 window.confirm', () => {
    assert.match(authShell, /from '\.\/ConfirmDialog'/);
    assert.match(authShell, /confirmEmptyLogin:\s*meta\.from === 'login' \? askBindDraftConfirm/);
    assert.match(authShell, /EMPTY_LOGIN_BIND_MESSAGE/);
    assert.match(authShell, /confirmLabel="绑定草稿"/);
    assert.doesNotMatch(authShell, /window\.confirm/);
    assert.doesNotMatch(authShell, /claimSummary/);
  });

  it('bindEmptyAccount 无 window.confirm 默认；注册写默认画像', () => {
    assert.doesNotMatch(bindEmpty, /window\.confirm/);
    assert.match(bindEmpty, /EMPTY_LOGIN_BIND_MESSAGE/);
    assert.match(bindEmpty, /REGISTER_DEFAULT_DATA_MESSAGE/);
    assert.match(bindEmpty, /defaultNewAccountProfile/);
    assert.match(bindEmpty, /meta\.from === 'register'/);
  });
});

describe('访客顶栏菜单', () => {
  it('圆形菜单文案为访客；下拉含登录/注册/重启；登录态无登录注册入口；无保存注册与顶栏 AuthBar', () => {
    // 圆钮：访客显示「访客」，不用「登录注册」
    assert.match(page, /authUser \? authUser\.username : '访客'/);
    assert.doesNotMatch(page, /登录注册/);
    assert.match(page, /REGISTER_DEFAULT_DATA_MESSAGE/);
    assert.match(page, /setRegisterConfirmOpen\(true\)/);
    assert.match(page, /继续注册/);
    // 访客菜单三项（顺序：登录 → 注册 → 重启）；登录态分支无登录/注册入口
    assert.match(page, />\s*登录\s*<\/button>[\s\S]*>\s*注册\s*<\/button>[\s\S]*>\s*重启网站\s*<\/button>/);
    assert.match(page, /\{authUser \? \([\s\S]*登出[\s\S]*\) : \([\s\S]*登录[\s\S]*注册[\s\S]*重启网站/);
    assert.doesNotMatch(page, /注册保存/);
    assert.doesNotMatch(page, /registerOnly/);
    // 主页不再渲染顶栏 AuthBar 独立入口
    assert.doesNotMatch(page, /<AuthBar[\s\S]*registerOnly/);
    assert.doesNotMatch(page, /import AuthBar,/);
  });

  it('AuthBar 表单无认领 radio / 注册保存', () => {
    assert.doesNotMatch(authBar, /注册保存/);
    assert.doesNotMatch(authBar, /claimMode/);
    assert.doesNotMatch(authBar, /用当前数据认领/);
    assert.doesNotMatch(authBar, /claimSummaryLines/);
  });
});
