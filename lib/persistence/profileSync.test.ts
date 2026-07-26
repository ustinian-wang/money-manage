import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createProfileSyncQueue, type ProfileSyncStatus } from './profileSync';

const state = (value: number) => ({ profile: { value }, snapshots: [], scenarios: [] });

describe('createProfileSyncQueue', () => {
  it('serializes rapid edits and sends the latest queued profile with the confirmed revision', async () => {
    const requests: Array<{ revision: number; value: number }> = [];
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const queue = createProfileSyncQueue({
      initialRevision: 3,
      fetcher: async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { revision: number; state: { profile: { value: number } } };
        requests.push({ revision: body.revision, value: body.state.profile.value });
        if (requests.length === 1) await firstGate;
        return Response.json({ revision: body.revision + 1 });
      },
    });

    const first = queue.enqueue(state(1));
    const second = queue.enqueue(state(2));
    releaseFirst?.();
    await Promise.all([first, second, queue.flush()]);

    assert.deepEqual(requests, [
      { revision: 3, value: 1 },
      { revision: 4, value: 2 },
    ]);
    assert.equal(queue.revision, 5);
  });

  it('reports conflict with the current server revision and keeps retry explicit', async () => {
    const statuses: ProfileSyncStatus[] = [];
    const revisions: number[] = [];
    let attempt = 0;
    const queue = createProfileSyncQueue({
      initialRevision: 1,
      onStatus: (status) => statuses.push(status),
      fetcher: async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { revision: number };
        revisions.push(body.revision);
        attempt += 1;
        if (attempt === 1) {
          return Response.json({ error: 'revision_conflict', state: { revision: 4 } }, { status: 409 });
        }
        return Response.json({ revision: 5 });
      },
    });

    await queue.enqueue(state(1));
    assert.equal(statuses.at(-1)?.phase, 'conflict');
    assert.equal(queue.revision, 4);

    await queue.enqueue(state(1));
    assert.deepEqual(revisions, [1, 4]);
    assert.equal(statuses.at(-1)?.phase, 'synced');
  });

  it('reports network failure without claiming a cloud save', async () => {
    const statuses: ProfileSyncStatus[] = [];
    const queue = createProfileSyncQueue({
      onStatus: (status) => statuses.push(status),
      fetcher: async () => { throw new Error('offline'); },
    });

    await queue.enqueue(state(1));

    assert.deepEqual(statuses.map((status) => status.phase), ['syncing', 'failed']);
  });
});
