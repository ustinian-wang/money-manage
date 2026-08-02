/**
 * AppChrome / DebugConsole 接入契约
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

const dir = new URL('.', import.meta.url);
const layoutSrc = fs.readFileSync(new URL('./layout.tsx', dir), 'utf8');
const chromeSrc = fs.readFileSync(new URL('./components/AppChrome.tsx', dir), 'utf8');
const debugSrc = fs.readFileSync(new URL('./components/DebugConsole.tsx', dir), 'utf8');
const pageSrc = fs.readFileSync(new URL('./page.tsx', dir), 'utf8');
const globalsCss = fs.readFileSync(new URL('./globals.css', dir), 'utf8');

describe('调试浮层与顶栏滚动收起', () => {
  it('layout 挂 AppChrome（ViewportSync + DebugConsole）', () => {
    assert.match(layoutSrc, /from '\.\/components\/AppChrome'/);
    assert.match(layoutSrc, /<AppChrome>/);
    assert.match(chromeSrc, /ViewportSync/);
    assert.match(chromeSrc, /DebugConsole/);
  });

  it('DebugConsole：刷新最新、采集含内页、上报 /api/debug-log', () => {
    assert.match(debugSrc, /resolveDebugEnabled/);
    assert.match(debugSrc, /collectDebugEnvSnapshot/);
    assert.match(debugSrc, /summarizeDebugSnapshot/);
    assert.match(debugSrc, /刷新最新/);
    assert.match(debugSrc, /\/api\/debug-log/);
    assert.match(debugSrc, /mm-debug-fab/);
    assert.match(debugSrc, /promo-mobile\.html/);
    assert.match(debugSrc, /宣发\/页面/);
  });

  it('DebugConsole：导出到剪贴板 / 粘贴或文本导入覆盖', () => {
    assert.match(debugSrc, /导出用户数据/);
    assert.match(debugSrc, /已复制到剪贴板/);
    assert.match(debugSrc, /clipboard\.writeText/);
    assert.match(debugSrc, /serializeProfileForClipboard/);
    assert.match(debugSrc, /粘贴导入/);
    assert.match(debugSrc, /从文本导入/);
    assert.match(debugSrc, /parseImportProfileJson/);
    assert.match(debugSrc, /applyImportedProfile/);
    assert.match(debugSrc, /window\.confirm/);
    assert.match(pageSrc, /registerDebugLiveProfile/);
  });

  it('主页顶栏随滚动加 is-header-hidden', () => {
    assert.match(pageSrc, /useScrollHideHeader/);
    assert.match(pageSrc, /is-header-hidden/);
    assert.match(globalsCss, /\.mobile-sticky-top\.is-header-hidden/);
    assert.match(globalsCss, /translateY\(-100%\)/);
  });
});
