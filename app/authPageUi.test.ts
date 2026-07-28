/**
 * 登录/注册页 UI：居中表单 + 左上角 logo，无 overflow 壳与冗长说明
 * 需求：鉴权页精简
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const authBar = readFileSync(new URL('./AuthBar.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../lib/ui/authGateShell.ts', import.meta.url), 'utf8');

describe('鉴权页 UI 精简', () => {
  it('page/gate 不用 auth-gate-root 固定 overflow 壳', () => {
    assert.doesNotMatch(authBar, /auth-gate-root/);
    assert.doesNotMatch(shell, /auth-gate-root/);
  });

  it('左上角 logo 链回首页，含站点名', () => {
    assert.match(authBar, /href=["']\/["']/);
    assert.match(authBar, />财务规划</);
    assert.match(authBar, /aria-label=["']返回首页["']/);
  });

  it('无冗长说明与居中品牌装饰块', () => {
    assert.doesNotMatch(authBar, /新账号使用系统默认数据起步/);
    assert.doesNotMatch(authBar, /登录后读取你的云端数据/);
    assert.doesNotMatch(authBar, /登录同步云端/);
    assert.doesNotMatch(authBar, /注册默认数据起步/);
    // 居中大号 M 装饰（h-12）已去掉；左上角小 logo 仍用 h-7
    assert.doesNotMatch(authBar, /h-12 w-12/);
  });

  it('保留标题、主按钮与去登录/去注册', () => {
    assert.match(authBar, /去注册/);
    assert.match(authBar, /去登录/);
    assert.match(authBar, /mode === 'login' \? '登录' : '注册'/);
  });
});
