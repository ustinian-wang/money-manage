/**
 * bindEmptyAccountAfterAuth：注册默认画像 / 登录确认绑定
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  bindEmptyAccountAfterAuth,
  defaultNewAccountProfile,
  REGISTER_DEFAULT_DATA_MESSAGE,
} from './bindEmptyAccount';
import { LIGHT_DEMO_ASSETS } from '../demoDefaults';

function mockFetch(handlers: Array<(url: string, init?: RequestInit) => Promise<Response> | Response>) {
  let i = 0;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const handler = handlers[i++];
    assert.ok(handler, `unexpected fetch #${i} ${url}`);
    return handler(url, init);
  };
}

describe('bindEmptyAccountAfterAuth', () => {
  it('源码不含 window.confirm（改由 ConfirmDialog 注入）', () => {
    const source = readFileSync(new URL('./bindEmptyAccount.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /window\.confirm/);
  });

  it('云端已有画像 → has_server，不 PUT', async () => {
    const fetchImpl = mockFetch([
      () => Response.json({ revision: 3, profile: { salary: 1 }, snapshots: [] }),
    ]);
    const result = await bindEmptyAccountAfterAuth({ from: 'login' }, { fetchImpl: fetchImpl as typeof fetch });
    assert.equal(result.status, 'has_server');
    if (result.status === 'has_server') assert.equal(result.revision, 3);
  });

  it('注册 → PUT 默认画像，不读访客草稿', async () => {
    let putBody: unknown;
    const fetchImpl = mockFetch([
      () => Response.json({ revision: 0, profile: {}, snapshots: [] }),
      (_url, init) => {
        putBody = JSON.parse(String(init?.body || '{}'));
        return Response.json({ revision: 1 });
      },
    ]);
    const result = await bindEmptyAccountAfterAuth(
      { from: 'register' },
      {
        fetchImpl: fetchImpl as typeof fetch,
        readDraft: () => ({ salary: 999, totalAssets: 1, expenses: [{ name: '草稿房租' }] }),
      },
    );
    assert.equal(result.status, 'bound');
    const state = (putBody as { state: { profile: { totalAssets: number; expenses: { name: string }[] } } }).state;
    assert.equal(state.profile.totalAssets, LIGHT_DEMO_ASSETS.totalAssets);
    assert.ok(state.profile.expenses?.some((e) => e.name === '房租'));
    assert.ok(!state.profile.expenses?.some((e) => e.name === '草稿房租'));
  });

  it('defaultNewAccountProfile 与轻演示一致', () => {
    const profile = defaultNewAccountProfile();
    assert.equal(profile.totalAssets, LIGHT_DEMO_ASSETS.totalAssets);
    assert.match(REGISTER_DEFAULT_DATA_MESSAGE, /默认数据/);
    assert.match(REGISTER_DEFAULT_DATA_MESSAGE, /不会把当前访客/);
  });

  it('登录空账号取消确认 → skipped', async () => {
    const fetchImpl = mockFetch([
      () => Response.json({ revision: 0, profile: {}, snapshots: [] }),
    ]);
    const result = await bindEmptyAccountAfterAuth(
      { from: 'login' },
      { fetchImpl: fetchImpl as typeof fetch, confirmEmptyLogin: () => false, readDraft: () => ({}) },
    );
    assert.equal(result.status, 'skipped');
  });

  it('登录空账号未注入确认 → skipped（不默认 window.confirm）', async () => {
    const fetchImpl = mockFetch([
      () => Response.json({ revision: 0, profile: {}, snapshots: [] }),
    ]);
    const result = await bindEmptyAccountAfterAuth(
      { from: 'login' },
      { fetchImpl: fetchImpl as typeof fetch, readDraft: () => ({ salary: 1 }) },
    );
    assert.equal(result.status, 'skipped');
  });

  it('登录空账号异步确认 → bound', async () => {
    let putBody: unknown;
    const fetchImpl = mockFetch([
      () => Response.json({ revision: 0, profile: {}, snapshots: [] }),
      (_url, init) => {
        putBody = JSON.parse(String(init?.body || '{}'));
        return Response.json({ revision: 2 });
      },
    ]);
    const result = await bindEmptyAccountAfterAuth(
      { from: 'login' },
      {
        fetchImpl: fetchImpl as typeof fetch,
        confirmEmptyLogin: async () => true,
        readDraft: () => ({ salary: 12000 }),
      },
    );
    assert.equal(result.status, 'bound');
    if (result.status === 'bound') assert.equal(result.revision, 2);
    const state = (putBody as { state: { profile: { salary: number } } }).state;
    assert.equal(state.profile.salary, 12000);
  });
});
