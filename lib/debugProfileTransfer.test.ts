/**
 * dbg profile 导出/导入：校验、解包、剪贴板序列化、覆盖路径
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyImportedProfile,
  parseImportProfileJson,
  registerDebugLiveProfile,
  resolveExportProfile,
  serializeProfileForClipboard,
  unwrapProfilePayload,
} from './debugProfileTransfer';
import { GUEST_PROFILE_KEY, loadGuestDraft } from './persistence/guestDraft';

describe('unwrapProfilePayload', () => {
  it('扁平 profile 原样返回；解包 API / PUT 包装', () => {
    const flat = { schemaVersion: 4, totalAssets: 1 };
    assert.equal(unwrapProfilePayload(flat), flat);
    assert.deepEqual(
      unwrapProfilePayload({ revision: 3, profile: flat, snapshots: [] }),
      flat,
    );
    assert.deepEqual(
      unwrapProfilePayload({ state: { profile: flat }, revision: 1 }),
      flat,
    );
  });
});

describe('serializeProfileForClipboard + parseImportProfileJson 闭环', () => {
  it('导出文本可再解析为同一 profile', () => {
    const profile = { schemaVersion: 4, totalAssets: 99000, cash: 40000, salary: 16667 };
    const text = serializeProfileForClipboard(profile);
    assert.match(text, /"schemaVersion": 4/);
    const parsed = parseImportProfileJson(text);
    assert.deepEqual(parsed, { ok: true, profile });
  });

  it('空内容 / 非法 JSON / 缺关键字段友好报错', () => {
    const empty = parseImportProfileJson('   ');
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.match(empty.error, /内容为空/);

    const badJson = parseImportProfileJson('{');
    assert.equal(badJson.ok, false);
    if (!badJson.ok) assert.match(badJson.error, /非法 JSON/);

    const missing = parseImportProfileJson('{"foo":1}');
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.match(missing.error, /缺少关键字段/);
  });

  it('拒绝调试环境快照', () => {
    const snap = JSON.stringify({
      overlays: [],
      vv: null,
      zIndexContract: {},
      schemaVersion: 4,
    });
    const r = parseImportProfileJson(snap);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /调试环境快照/);
  });

  it('接受扁平 profile 与包装形态', () => {
    const profile = { schemaVersion: 4, totalAssets: 99000, cash: 40000 };
    assert.deepEqual(parseImportProfileJson(JSON.stringify(profile)), {
      ok: true,
      profile,
    });
    assert.deepEqual(
      parseImportProfileJson(JSON.stringify({ revision: 2, profile, snapshots: [] })),
      { ok: true, profile },
    );
  });
});

describe('resolveExportProfile / applyImportedProfile', () => {
  it('优先 live provider', async () => {
    registerDebugLiveProfile(() => ({ schemaVersion: 4, salary: 8888 }));
    try {
      assert.deepEqual(await resolveExportProfile(), { schemaVersion: 4, salary: 8888 });
    } finally {
      registerDebugLiveProfile(null);
    }
  });

  it('访客导入只写本机 guest 键；校验失败不写', async () => {
    const store = new Map<string, string>();
    const prev = (globalThis as { localStorage?: Storage }).localStorage;
    const prevFetch = globalThis.fetch;
    (globalThis as { localStorage: Storage }).localStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => { store.set(k, v); },
      removeItem: (k) => { store.delete(k); },
      clear: () => store.clear(),
      key: () => null,
      get length() { return store.size; },
    } as Storage;
    globalThis.fetch = (async () => new Response(JSON.stringify({ user: null }), { status: 200 })) as typeof fetch;

    try {
      const bad = parseImportProfileJson('{"nope":true}');
      assert.equal(bad.ok, false);
      assert.equal(store.size, 0);

      const profile = { schemaVersion: 4, totalAssets: 12345, cash: 100 };
      const applied = await applyImportedProfile(profile);
      assert.deepEqual(applied, { ok: true, mode: 'guest' });
      assert.deepEqual(loadGuestDraft(), profile);
      assert.equal(store.has(GUEST_PROFILE_KEY), true);
    } finally {
      if (prev === undefined) {
        delete (globalThis as { localStorage?: Storage }).localStorage;
      } else {
        (globalThis as { localStorage: Storage }).localStorage = prev;
      }
      globalThis.fetch = prevFetch;
      registerDebugLiveProfile(null);
    }
  });

  it('登录导入：云端失败不写本机；成功则云端+本机', async () => {
    const store = new Map<string, string>();
    const prev = (globalThis as { localStorage?: Storage }).localStorage;
    const prevFetch = globalThis.fetch;
    (globalThis as { localStorage: Storage }).localStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => { store.set(k, v); },
      removeItem: (k) => { store.delete(k); },
      clear: () => store.clear(),
      key: () => null,
      get length() { return store.size; },
    } as Storage;

    const profile = { schemaVersion: 4, totalAssets: 50, salary: 1 };
    let putCalls = 0;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ user: { id: 'u1' } }), { status: 200 });
      }
      if (url.includes('/api/profile') && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify({ revision: 2, profile: {} }), { status: 200 });
      }
      if (url.includes('/api/profile') && init?.method === 'PUT') {
        putCalls += 1;
        if (putCalls === 1) {
          return new Response(JSON.stringify({ error: 'fail' }), { status: 500 });
        }
        return new Response(JSON.stringify({ revision: 3 }), { status: 200 });
      }
      return new Response('no', { status: 404 });
    }) as typeof fetch;

    try {
      const fail = await applyImportedProfile(profile);
      assert.equal(fail.ok, false);
      assert.equal(store.size, 0);

      const ok = await applyImportedProfile(profile);
      assert.deepEqual(ok, { ok: true, mode: 'user' });
      assert.deepEqual(loadGuestDraft({ userId: 'u1' }), profile);
      assert.equal(putCalls, 2);
    } finally {
      if (prev === undefined) {
        delete (globalThis as { localStorage?: Storage }).localStorage;
      } else {
        (globalThis as { localStorage: Storage }).localStorage = prev;
      }
      globalThis.fetch = prevFetch;
    }
  });

  it('登录导入：PUT 网络 throw 不写本机，错误含「网络」', async () => {
    const store = new Map<string, string>();
    const prev = (globalThis as { localStorage?: Storage }).localStorage;
    const prevFetch = globalThis.fetch;
    (globalThis as { localStorage: Storage }).localStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => { store.set(k, v); },
      removeItem: (k) => { store.delete(k); },
      clear: () => store.clear(),
      key: () => null,
      get length() { return store.size; },
    } as Storage;

    const profile = { schemaVersion: 4, totalAssets: 77, salary: 2 };

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ user: { id: 'u-net' } }), { status: 200 });
      }
      if (url.includes('/api/profile') && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify({ revision: 1, profile: {} }), { status: 200 });
      }
      if (url.includes('/api/profile') && init?.method === 'PUT') {
        throw new TypeError('Failed to fetch');
      }
      return new Response('no', { status: 404 });
    }) as typeof fetch;

    try {
      const fail = await applyImportedProfile(profile);
      assert.equal(fail.ok, false);
      if (!fail.ok) assert.match(fail.error, /网络/);
      assert.equal(store.size, 0);
      assert.equal(loadGuestDraft({ userId: 'u-net' }), null);
    } finally {
      if (prev === undefined) {
        delete (globalThis as { localStorage?: Storage }).localStorage;
      } else {
        (globalThis as { localStorage: Storage }).localStorage = prev;
      }
      globalThis.fetch = prevFetch;
    }
  });

  it('登录导入：409 一次后成功重试则写本机；连续两次 409 不写本机', async () => {
    const store = new Map<string, string>();
    const prev = (globalThis as { localStorage?: Storage }).localStorage;
    const prevFetch = globalThis.fetch;
    (globalThis as { localStorage: Storage }).localStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => { store.set(k, v); },
      removeItem: (k) => { store.delete(k); },
      clear: () => store.clear(),
      key: () => null,
      get length() { return store.size; },
    } as Storage;

    const profile = { schemaVersion: 4, totalAssets: 88, salary: 3 };
    let putCalls = 0;
    /** 'retry-ok' | 'retry-fail' */
    let putMode: 'retry-ok' | 'retry-fail' = 'retry-ok';

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ user: { id: 'u-409' } }), { status: 200 });
      }
      if (url.includes('/api/profile') && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify({ revision: 1, profile: {} }), { status: 200 });
      }
      if (url.includes('/api/profile') && init?.method === 'PUT') {
        putCalls += 1;
        if (putMode === 'retry-ok') {
          // 第 1 次 409（带 serverRev），第 2 次成功
          if (putCalls === 1) {
            return new Response(JSON.stringify({ state: { revision: 5 } }), { status: 409 });
          }
          return new Response(JSON.stringify({ revision: 6 }), { status: 200 });
        }
        // 两次都 409（putProfileOverwrite 最多 2 次 attempt）
        return new Response(JSON.stringify({ state: { revision: 5 + putCalls } }), { status: 409 });
      }
      return new Response('no', { status: 404 });
    }) as typeof fetch;

    try {
      const ok = await applyImportedProfile(profile);
      assert.deepEqual(ok, { ok: true, mode: 'user' });
      assert.deepEqual(loadGuestDraft({ userId: 'u-409' }), profile);
      assert.equal(putCalls, 2);

      store.clear();
      putCalls = 0;
      putMode = 'retry-fail';
      const fail = await applyImportedProfile(profile);
      assert.equal(fail.ok, false);
      if (!fail.ok) assert.match(fail.error, /冲突|revision/i);
      assert.equal(store.size, 0);
      assert.equal(loadGuestDraft({ userId: 'u-409' }), null);
      assert.equal(putCalls, 2);
    } finally {
      if (prev === undefined) {
        delete (globalThis as { localStorage?: Storage }).localStorage;
      } else {
        (globalThis as { localStorage: Storage }).localStorage = prev;
      }
      globalThis.fetch = prevFetch;
    }
  });
});

describe('parseImportProfileJson 非对象', () => {
  it('数组 / 原始值 JSON 导入失败', () => {
    for (const text of ['[]', 'null', '"hi"', '42', 'true']) {
      const r = parseImportProfileJson(text);
      assert.equal(r.ok, false, text);
      if (!r.ok) assert.match(r.error, /缺少有效的 profile 对象/);
    }
  });
});
