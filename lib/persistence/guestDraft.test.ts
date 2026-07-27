/**
 * 访客/本机草稿：按账号隔离 localStorage 键；无草稿回落 LIGHT_DEMO；绝不打云端
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIGHT_DEMO_ASSETS, LIGHT_DEMO_EXPENSES } from '../demoDefaults';
import {
  GUEST_PROFILE_KEY,
  LEGACY_PROFILE_KEY,
  loadGuestDraft,
  resolveGuestProfile,
  resolveProfileStorageKey,
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

describe('resolveProfileStorageKey 键名解析', () => {
  it('无 userId → 访客键 money-manage-profile:guest', () => {
    assert.equal(resolveProfileStorageKey(), GUEST_PROFILE_KEY);
    assert.equal(resolveProfileStorageKey(null), GUEST_PROFILE_KEY);
    assert.equal(resolveProfileStorageKey(''), GUEST_PROFILE_KEY);
    assert.equal(GUEST_PROFILE_KEY, 'money-manage-profile:guest');
  });

  it('有 userId → money-manage-profile:{userId}', () => {
    assert.equal(resolveProfileStorageKey('user-a'), 'money-manage-profile:user-a');
    assert.equal(resolveProfileStorageKey('user-b'), 'money-manage-profile:user-b');
  });
});

describe('guestDraft 本机草稿隔离', () => {
  it('访客 save/load 走 guest 键，不写旧单键', () => {
    const storage = mockStorage();
    const profile = { schemaVersion: 4, totalAssets: 99000, cash: 40000 };
    saveGuestDraft(profile, { storage });
    assert.equal(storage.getItem(GUEST_PROFILE_KEY), JSON.stringify(profile));
    assert.equal(storage.getItem(LEGACY_PROFILE_KEY), null);
    assert.deepEqual(loadGuestDraft({ storage }), profile);
  });

  it('登录用户与访客、另一账号互不覆盖', () => {
    const storage = mockStorage();
    const guest = { totalAssets: 1 };
    const userA = { totalAssets: 100 };
    const userB = { totalAssets: 200 };
    saveGuestDraft(guest, { storage });
    saveGuestDraft(userA, { storage, userId: 'a' });
    saveGuestDraft(userB, { storage, userId: 'b' });

    assert.deepEqual(loadGuestDraft({ storage }), guest);
    assert.deepEqual(loadGuestDraft({ storage, userId: 'a' }), userA);
    assert.deepEqual(loadGuestDraft({ storage, userId: 'b' }), userB);
    assert.equal(storage._map.size, 3);
  });

  it('loadGuestDraft 无键或坏 JSON 返回 null', () => {
    assert.equal(loadGuestDraft({ storage: mockStorage() }), null);
    assert.equal(
      loadGuestDraft({
        storage: mockStorage({ [GUEST_PROFILE_KEY]: '{broken' }),
      }),
      null,
    );
  });

  it('访客首次读：旧键 money-manage-profile 迁移到 guest 键并删除旧键', () => {
    const legacy = { totalAssets: 77777, cash: 1000 };
    const storage = mockStorage({
      [LEGACY_PROFILE_KEY]: JSON.stringify(legacy),
    });
    assert.deepEqual(loadGuestDraft({ storage }), legacy);
    assert.equal(storage.getItem(GUEST_PROFILE_KEY), JSON.stringify(legacy));
    assert.equal(storage.getItem(LEGACY_PROFILE_KEY), null);
  });

  it('guest 键已有数据时不覆盖，也不读另一账号键', () => {
    const storage = mockStorage({
      [GUEST_PROFILE_KEY]: JSON.stringify({ totalAssets: 11 }),
      [LEGACY_PROFILE_KEY]: JSON.stringify({ totalAssets: 99 }),
      'money-manage-profile:other': JSON.stringify({ totalAssets: 55 }),
    });
    assert.deepEqual(loadGuestDraft({ storage }), { totalAssets: 11 });
    assert.equal(storage.getItem(LEGACY_PROFILE_KEY), JSON.stringify({ totalAssets: 99 }));
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

  it('主页：hydrate/save 按账号键；登出不写访客键；blur 落盘、无 change 防抖写盘', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8');
    assert.match(src, /loadGuestDraft/);
    assert.match(src, /saveGuestDraft/);
    assert.doesNotMatch(src, /localStorage\.(get|set)Item\(['"]money-manage-profile['"]\)/);
    // 防抖仅本机；去掉本机→云端 sync queue
    assert.doesNotMatch(src, /createProfileSyncQueue/);
    assert.doesNotMatch(src, /profileSyncRef/);
    assert.doesNotMatch(src, /\.enqueue\(/);
    assert.doesNotMatch(src, /以本机数据覆盖云端/);
    assert.doesNotMatch(src, /profileSyncAlert/);
    // blur / 显式确认：money-manage-save；禁止对全量 state 做 400ms 防抖写盘
    assert.match(src, /addEventListener\(\s*['"]money-manage-save['"]/);
    assert.doesNotMatch(src, /setTimeout\(\s*\(\)\s*=>\s*\{\s*save\(\)/);
    // SoftNumber / Editable：blur 才提交父 state（联动）并 persist；change 只改 draft
    assert.match(src, /change 只改 draft；blur 才 onChange/);
    assert.match(src, /onChange=\{\(event\) => setDraft\(event\.target\.value\)\}/);
    assert.doesNotMatch(src, /commit\(live/);
    assert.doesNotMatch(src, /softNumberLive/);
    // SoftNumberInput：change 不 onCommit；blur 才 finish + money-manage-save
    const softStart = src.indexOf('function SoftNumberInput');
    const softEnd = src.indexOf('function formatExpensePayment', softStart);
    assert.ok(softStart >= 0 && softEnd > softStart, 'SoftNumberInput block bounds');
    const softFn = src.slice(softStart, softEnd);
    assert.match(softFn, /onChange=\{\(event\) => setDraft\(event\.target\.value\)\}/);
    assert.match(softFn, /onBlur=\{\(\) => \{\s*focusedRef\.current = false;\s*finish\(draft\);\s*window\.dispatchEvent\(new Event\(['"]money-manage-save['"]\)/);
    assert.doesNotMatch(softFn, /onChange=\{[^}]*onCommit/);
    // SoftNumber 父 onCommit 只改 state，禁止再挂 money-manage-save（否则 change 写盘）
    for (const key of ['onInsuranceBaseChange', 'onHousingFundBaseChange', 'onHousingPersonalChange'] as const) {
      const i = src.indexOf(`${key}=`);
      assert.ok(i >= 0, `missing ${key}`);
      const slice = src.slice(i, i + 220);
      assert.doesNotMatch(slice, /money-manage-save/, `${key} must not persist on SoftNumber onCommit`);
    }
    // TextEditable 自身 blur 落盘；父 onChange 勿再 saveEvent
    const teStart = src.indexOf('function TextEditable');
    const teEnd = src.indexOf('function Metric', teStart);
    assert.ok(teStart >= 0 && teEnd > teStart, 'TextEditable block bounds');
    const textEditableFn = src.slice(teStart, teEnd);
    assert.match(textEditableFn, /window\.dispatchEvent\(new Event\(['"]money-manage-save['"]\)/);
    assert.match(textEditableFn, /onChange=\{\(event\) => setDraft\(event\.target\.value\)\}/);
    assert.doesNotMatch(src, /TextEditable[^>]*onChange=\{\([^)]*\) => \{ updateExpense\([^)]*\); saveEvent\(\); \}\}/);
    // 登录写本机缓存带 userId；访客/认领读 guest
    assert.match(src, /saveGuestDraft\(\s*profile\s*,\s*\{\s*userId:/);
    // 登出：回到访客草稿，禁止把当前（登录）画像 save 进访客键
    assert.match(src, /handleLogout/);
    assert.match(src, /loadGuestDraft\(\)/);
    const logoutBlock = src.slice(src.indexOf('const handleLogout'), src.indexOf('// blur / 显式确认'));
    assert.doesNotMatch(logoutBlock, /saveGuestDraft/);
    assert.match(logoutBlock, /loadGuestDraft/);
  });
});
