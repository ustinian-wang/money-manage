/**
 * autosave：input/change 不写盘；blur / pagehide 才写 localStorage（并可 PUT）
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAutosave, LOCAL_REVISION_KEY, LOCAL_STATE_KEY } from './clientAutosave';
import type { PersistedState } from './types';

const sampleState = {
  schemaVersion: 1,
  revision: 3,
  updatedAt: '2026-07-27T00:00:00.000Z',
  profile: { totalAssets: 80000 },
  snapshots: [],
  scenarios: [],
} as PersistedState;

function withWindowStorage(run: (storage: Map<string, string>, writes: Array<{ url: string; method?: string }>) => Promise<void>) {
  const storage = new Map<string, string>();
  const writes: Array<{ url: string; method?: string }> = [];
  const oldWindow = globalThis.window;
  const oldFetch = globalThis.fetch;
  globalThis.window = {
    localStorage: {
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
      getItem(key: string) {
        return storage.get(key) ?? null;
      },
    },
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Window & typeof globalThis;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    writes.push({ url: String(url), method: init?.method });
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  return run(storage, writes).finally(() => {
    globalThis.window = oldWindow;
    globalThis.fetch = oldFetch;
  });
}

describe('createAutosave', () => {
  it('input/change 不写 localStorage；blur 才写并 PUT', async () => {
    await withWindowStorage(async (storage, writes) => {
      const autosave = createAutosave({ apiPath: '/api/profile', debounceMs: 1000 });
      autosave.onInput(sampleState);
      autosave.onChange({ ...sampleState, revision: 4 });
      assert.equal(storage.get(LOCAL_STATE_KEY), undefined);
      assert.equal(writes.length, 0);
      await autosave.onBlur(sampleState);
      assert.equal(storage.get(LOCAL_STATE_KEY), JSON.stringify(sampleState));
      assert.equal(writes.length, 1);
      assert.equal(writes[0].url, '/api/profile');
      assert.equal(writes[0].method, 'PUT');
    });
  });

  it('访客 localOnly：blur 写本机，永不 PUT', async () => {
    await withWindowStorage(async (storage, writes) => {
      const autosave = createAutosave({
        apiPath: '/api/profile',
        debounceMs: 10,
        localOnly: true,
      });
      autosave.onInput(sampleState);
      assert.equal(storage.get(LOCAL_STATE_KEY), undefined);
      await autosave.onBlur(sampleState);
      assert.equal(storage.get(LOCAL_STATE_KEY), JSON.stringify(sampleState));
      assert.equal(storage.get(LOCAL_REVISION_KEY), '3');
      await autosave.flush();
      assert.equal(writes.length, 0);
    });
  });
});
