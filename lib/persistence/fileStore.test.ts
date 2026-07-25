/**
 * 持久化：按 userId 隔离的本地 data/*.json 读写
 * 需求：多用户 · user:{id}/financial-profile.json
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readState, writeState, listBackups, STATE_FILE, userScopedKey } from './fileStore.ts';

test('读写 user 作用域 profile 并递增 revision，用户间隔离', async () => {
    const userId = 'test-user-a';
    const stateFile = path.join(process.cwd(), 'data', userScopedKey(userId, STATE_FILE));
    await fs.mkdir(path.dirname(stateFile), { recursive: true });
    await fs.mkdir(path.join(process.cwd(), 'data', userScopedKey(userId, 'backups')), { recursive: true });
    await fs.writeFile(stateFile, JSON.stringify({
        schemaVersion: 1,
        revision: 2,
        updatedAt: new Date(0).toISOString(),
        profile: { salary: 10000 },
        snapshots: [],
        scenarios: [{ id: 's1', name: 'base', type: 'baseline', overrides: [], createdAt: '', updatedAt: '' }],
    }, null, 2));

    const before = await readState(userId);
    assert.equal(before.revision, 2);
    assert.equal((before.profile as { salary: number }).salary, 10000);

    const after = await writeState(userId, { profile: { salary: 12000 } }, 2);
    assert.equal(after.revision, 3);
    assert.equal((after.profile as { salary: number }).salary, 12000);
    assert.equal(after.scenarios.length, 1);

    // 另一用户读不到 A 的数据
    const other = await readState('test-user-b');
    assert.equal(other.revision, 0);
    assert.deepEqual(other.profile, {});

    const backups = await listBackups(userId);
    assert.ok(backups.some((name) => name.includes('financial-profile-3-')));
});
