/**
 * 持久化：本地 data/*.json 读写（无 R2 上下文时）
 * 需求：文本文件型 DB；CF 上走同 key 的 R2 对象
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readState, writeState, listBackups, STATE_KEY } from './fileStore.js';

describe('fileStore 本地文本库', () => {
    it('读写 financial-profile.json 并递增 revision', async () => {
        const dataDir = path.join(process.cwd(), 'data');
        const stateFile = path.join(dataDir, STATE_KEY);
        await fs.mkdir(path.join(dataDir, 'backups'), { recursive: true });
        await fs.writeFile(stateFile, JSON.stringify({
            schemaVersion: 1,
            revision: 2,
            updatedAt: new Date(0).toISOString(),
            profile: { salary: 10000 },
            snapshots: [],
            scenarios: [{ id: 's1', name: 'base', type: 'baseline', overrides: [], createdAt: '', updatedAt: '' }],
        }, null, 2));

        const before = await readState();
        assert.equal(before.revision, 2);
        assert.equal((before.profile as { salary: number }).salary, 10000);

        // 只更新 profile，scenarios 应保留
        const after = await writeState({ profile: { salary: 12000 } }, 2);
        assert.equal(after.revision, 3);
        assert.equal((after.profile as { salary: number }).salary, 12000);
        assert.equal(after.scenarios.length, 1);

        const backups = await listBackups();
        assert.ok(backups.some((name) => name.includes('financial-profile-3-')));
    });
});
