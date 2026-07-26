/**
 * 访客草稿：仅 localStorage；无草稿回落 LIGHT_DEMO；绝不打云端
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIGHT_DEMO_ASSETS, LIGHT_DEMO_EXPENSES } from '../demoDefaults';
import {
  GUEST_PROFILE_KEY,
  loadGuestDraft,
  resolveGuestProfile,
  saveGuestDraft,
} from './guestDraft';

function mockStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    _map: map,
  };
}

describe('guestDraft 本机草稿', () => {
  it('saveGuestDraft 只写 localStorage 键 money-manage-profile', () => {
    const storage = mockStorage();
    const profile = { schemaVersion: 4, totalAssets: 99000, cash: 40000 };
    saveGuestDraft(profile, storage);
    assert.equal(storage.getItem(GUEST_PROFILE_KEY), JSON.stringify(profile));
    assert.equal(storage._map.size, 1);
  });

  it('loadGuestDraft 读回草稿；无键或坏 JSON 返回 null', () => {
    const ok = mockStorage({
      [GUEST_PROFILE_KEY]: JSON.stringify({ totalAssets: 120000 }),
    });
    assert.deepEqual(loadGuestDraft(ok), { totalAssets: 120000 });

    assert.equal(loadGuestDraft(mockStorage()), null);
    assert.equal(
      loadGuestDraft(mockStorage({ [GUEST_PROFILE_KEY]: '{broken' })),
      null,
    );
  });

  it('resolveGuestProfile：有草稿用草稿；无草稿回落 LIGHT_DEMO 资产与支出', () => {
    const fromDraft = resolveGuestProfile({ totalAssets: 120000, expenses: [{ name: '自定义' }] });
    assert.equal(fromDraft.source, 'draft');
    assert.equal((fromDraft.profile as { totalAssets: number }).totalAssets, 120000);

    const fromDemo = resolveGuestProfile(null);
    assert.equal(fromDemo.source, 'demo');
    const demo = fromDemo.profile as {
      totalAssets: number;
      cash: number;
      invest: number;
      investRatio: number;
      expenses: typeof LIGHT_DEMO_EXPENSES;
    };
    assert.equal(demo.totalAssets, LIGHT_DEMO_ASSETS.totalAssets);
    assert.equal(demo.cash, LIGHT_DEMO_ASSETS.cash);
    assert.equal(demo.invest, LIGHT_DEMO_ASSETS.invest);
    assert.equal(demo.investRatio, LIGHT_DEMO_ASSETS.investRatio);
    assert.deepEqual(
      demo.expenses.map((e) => e.name),
      LIGHT_DEMO_EXPENSES.map((e) => e.name),
    );
  });

  it('主页访客分支：用 guestDraft 且未登录不 enqueue 云端', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8');
    assert.match(src, /loadGuestDraft/);
    assert.match(src, /saveGuestDraft/);
    assert.doesNotMatch(src, /localStorage\.(get|set)Item\(['"]money-manage-profile['"]\)/);
    // 防抖保存：访客提前 return，不 PUT
    assert.match(src, /if\s*\(\s*!authUser\s*\)\s*return;/);
    assert.match(src, /profileSyncRef\.current\?\.enqueue/);
  });
});
