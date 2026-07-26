/**
 * 分期年月、场景对比、autosave：与已删的财务快照 domain 解耦
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { termToMonths } from '../types/installment';
import { compareProfiles } from '../lib/scenario/compare';
import { applyOverrides } from '../lib/scenario/applyOverrides';
import { createAutosave, LOCAL_REVISION_KEY, LOCAL_STATE_KEY } from '../lib/persistence/clientAutosave';
import type { PersistedState } from '../lib/persistence/types';

test('installment terms accept months and years', () => {
    assert.equal(termToMonths({ value: 36, unit: 'month' }), 36);
    assert.equal(termToMonths({ value: 3, unit: 'year' }), 36);
});

test('scenario comparison does not mutate the baseline profile', () => {
    const profile = { socialSecurity: { housingFund: { personalRate: 5 } } };
    const comparison = applyOverrides(profile, [{ path: 'socialSecurity.housingFund.personalRate', before: 5, after: 12 }]);
    assert.equal(profile.socialSecurity.housingFund.personalRate, 5);
    assert.equal(comparison.socialSecurity.housingFund.personalRate, 12);
    const compared = compareProfiles(profile, [{ path: 'socialSecurity.housingFund.personalRate', before: 5, after: 12 }]);
    assert.equal((compared.comparison as any).socialSecurity.housingFund.personalRate, 12);
});

test('autosave writes every interaction to localStorage and flushes on blur', async () => {
    const writes: Array<{ url: string; body: string }> = [];
    const storage = new Map<string, string>();
    const oldWindow = globalThis.window;
    const oldFetch = globalThis.fetch;
    globalThis.window = {
        localStorage: {
            setItem(key: string, value: string) { storage.set(key, value); },
            getItem(key: string) { return storage.get(key) ?? null; },
        },
        addEventListener() {},
        removeEventListener() {},
    } as unknown as Window & typeof globalThis;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
        writes.push({ url, body: String(init?.body) });
        return new Response(null, { status: 200 });
    }) as typeof fetch;

    try {
        // ponytail: 持久化 schema 仍带 snapshots:[]，业务不再写入
        const profile = { schemaVersion: 1, revision: 7, updatedAt: '2026-07-20T00:00:00.000Z', profile: {}, snapshots: [], scenarios: [] } as PersistedState;
        const autosave = createAutosave({ apiPath: '/api/profile', debounceMs: 1000 });
        autosave.onInput(profile);
        assert.equal(storage.get(LOCAL_STATE_KEY), JSON.stringify(profile));
        assert.equal(storage.get(LOCAL_REVISION_KEY), '7');
        await autosave.onBlur(profile);
        assert.equal(writes.length, 1);
        assert.match(writes[0].body, /"revision":7/);
    } finally {
        globalThis.window = oldWindow;
        globalThis.fetch = oldFetch;
    }
});

test('asset and percentage slider constraints are explicit contracts until production exports exist', { skip: 'No production asset validator or slider conversion export exists yet.' }, () => {
    assert.fail('Expected cash 0..2000000, investment <= total assets, return 0..100, and percentage/value conversion.');
});
