/**
 * bindEmptyAccountAfterAuth：空账号认领 / 清空 / 登录确认
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bindEmptyAccountAfterAuth } from './bindEmptyAccount';

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
  it('云端已有画像 → has_server，不 PUT', async () => {
    const fetchImpl = mockFetch([
      () => Response.json({ revision: 3, profile: { salary: 1 }, snapshots: [] }),
    ]);
    const result = await bindEmptyAccountAfterAuth({ from: 'login' }, { fetchImpl: fetchImpl as typeof fetch });
    assert.equal(result.status, 'has_server');
    if (result.status === 'has_server') assert.equal(result.revision, 3);
  });

  it('注册 clear → PUT 空画像', async () => {
    let putBody: unknown;
    const fetchImpl = mockFetch([
      () => Response.json({ revision: 0, profile: {}, snapshots: [] }),
      (_url, init) => {
        putBody = JSON.parse(String(init?.body || '{}'));
        return Response.json({ revision: 1 });
      },
    ]);
    const result = await bindEmptyAccountAfterAuth(
      { from: 'register', claimMode: 'clear' },
      {
        fetchImpl: fetchImpl as typeof fetch,
        readDraft: () => ({ salary: 999, totalAssets: 80000, expenses: [{ name: '房租' }] }),
      },
    );
    assert.equal(result.status, 'bound');
    const state = (putBody as { state: { profile: { salary: number; expenses: unknown[] } } }).state;
    assert.equal(state.profile.salary, 0);
    assert.deepEqual(state.profile.expenses, []);
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
});
