/**
 * PersistedState 归一化：缺字段补齐、非法 revision 归零
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CURRENT_SCHEMA_VERSION, emptyState, normalizeState } from './types';

describe('normalizeState / emptyState', () => {
    test('emptyState 初始 revision=0', () => {
        const s = emptyState();
        assert.equal(s.schemaVersion, CURRENT_SCHEMA_VERSION);
        assert.equal(s.revision, 0);
        assert.deepEqual(s.profile, {});
        assert.deepEqual(s.snapshots, []);
        assert.deepEqual(s.scenarios, []);
    });

    test('脏输入仍产出合法结构', () => {
        const s = normalizeState({
            revision: -1,
            profile: 'nope',
            snapshots: null,
            scenarios: [{ id: 's1', name: 'a', type: 'baseline', overrides: [], createdAt: '', updatedAt: '' }],
            updatedAt: '2026-01-01T00:00:00.000Z',
        });
        assert.equal(s.revision, 0);
        assert.deepEqual(s.profile, {});
        assert.deepEqual(s.snapshots, []);
        assert.equal(s.scenarios.length, 1);
        assert.equal(s.updatedAt, '2026-01-01T00:00:00.000Z');
    });
});
