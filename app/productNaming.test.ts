/**
 * 产品命名：弱化「管理系统」，偏向财务规划 / 消费承受力测算
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('product naming', () => {
  it('用户可见文案统一为财务规划，无财务管理系统', () => {
    const layout = readFileSync(new URL('./layout.tsx', import.meta.url), 'utf8');
    const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
    const authBar = readFileSync(new URL('./AuthBar.tsx', import.meta.url), 'utf8');
    const manifest = readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');

    assert.match(layout, /title:\s*'Money Manage · 财务规划'/);
    assert.match(layout, /applicationName:\s*'财务规划'/);
    assert.doesNotMatch(layout, /财务管理系统/);
    assert.doesNotMatch(layout, /applicationName:\s*'财务管理'/);

    assert.match(page, />财务规划</);
    assert.match(page, /消费承受力测算/);
    assert.doesNotMatch(page, /财务管理系统/);
    assert.doesNotMatch(page, />财务管理</);

    assert.match(authBar, />财务规划</);
    assert.doesNotMatch(authBar, /财务管理系统/);
    assert.doesNotMatch(authBar, />财务管理</);

    assert.match(manifest, /"short_name":\s*"财务规划"/);
    assert.match(manifest, /消费承受力测算/);
    assert.doesNotMatch(manifest, /财务管理系统/);
    assert.doesNotMatch(manifest, /财务管理/);
  });
});
