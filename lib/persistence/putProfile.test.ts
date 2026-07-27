import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { enqueueProfilePut } from './putProfile';

describe('enqueueProfilePut', () => {
  it('串行 PUT；409 时用服务端 revision 重试并成功', async () => {
    const calls: number[] = [];
    let revision = 1;
    let putCount = 0;
    const oldFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      putCount += 1;
      const body = JSON.parse(String(init?.body || '{}')) as { revision?: number; state?: { profile?: { n?: number } } };
      calls.push(body.revision ?? -1);
      if (putCount === 1) {
        return new Response(JSON.stringify({ error: 'revision_conflict', state: { revision: 5 } }), { status: 409 });
      }
      assert.equal(body.revision, 5);
      return new Response(JSON.stringify({ revision: 6, profile: body.state?.profile }), { status: 200 });
    }) as typeof fetch;
    try {
      await enqueueProfilePut({ n: 1 }, {
        getRevision: () => revision,
        setRevision: (n) => { revision = n; },
      });
      assert.equal(revision, 6);
      assert.deepEqual(calls, [1, 5]);
    } finally {
      globalThis.fetch = oldFetch;
    }
  });

  it('连续 enqueue 只保留最后一次 profile', async () => {
    const profiles: unknown[] = [];
    let revision = 0;
    const oldFetch = globalThis.fetch;
    let resolveFirst!: () => void;
    const firstGate = new Promise<void>((r) => { resolveFirst = r; });
    let started = 0;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      started += 1;
      const body = JSON.parse(String(init?.body || '{}')) as { state?: { profile?: unknown } };
      if (started === 1) await firstGate;
      profiles.push(body.state?.profile);
      revision += 1;
      return new Response(JSON.stringify({ revision }), { status: 200 });
    }) as typeof fetch;
    try {
      const p1 = enqueueProfilePut({ n: 1 }, { getRevision: () => revision, setRevision: (n) => { revision = n; } });
      const p2 = enqueueProfilePut({ n: 2 }, { getRevision: () => revision, setRevision: (n) => { revision = n; } });
      const p3 = enqueueProfilePut({ n: 3 }, { getRevision: () => revision, setRevision: (n) => { revision = n; } });
      resolveFirst();
      await Promise.all([p1, p2, p3]);
      assert.ok(profiles.length >= 1 && profiles.length <= 2);
      assert.deepEqual(profiles[profiles.length - 1], { n: 3 });
    } finally {
      globalThis.fetch = oldFetch;
    }
  });
});
