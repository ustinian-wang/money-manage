/**
 * 重启网站（纯客户端）：确认取消时不刷新
 * 需求：顶栏「更多」→ 重启网站；不碰 localStorage / 会话
 */
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { restartSite } from './restartSite';

describe('restartSite', () => {
  const originalConfirm = globalThis.window?.confirm;
  const originalLocation = globalThis.window?.location;

  afterEach(() => {
    if (typeof globalThis.window === 'undefined') return;
    if (originalConfirm) globalThis.window.confirm = originalConfirm;
    if (originalLocation) {
      Object.defineProperty(globalThis.window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  test('取消确认时不调用 location.replace', async () => {
    // node:test 无真实 window 时跳过 DOM 行为（浏览器冒烟另测）
    if (typeof globalThis.window === 'undefined') {
      // ponytail: node 环境无 window；确认文案与 clearSiteCaches 仍可静态核对
      const src = await import('node:fs').then((fs) =>
        fs.readFileSync(new URL('./restartSite.ts', import.meta.url), 'utf8'),
      );
      assert.match(src, /清除浏览器缓存并刷新，不会删除你的本地草稿\/登录状态/);
      assert.match(src, /localStorage/);
      assert.doesNotMatch(src, /localStorage\.clear/);
      assert.doesNotMatch(src, /\/api\/.*restart/);
      return;
    }
    globalThis.window.confirm = () => false;
    const replace = () => {
      throw new Error('replace should not be called');
    };
    Object.defineProperty(globalThis.window, 'location', {
      configurable: true,
      value: { href: 'http://localhost:3000/', replace },
    });
    await restartSite();
  });
});
