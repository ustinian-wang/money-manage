/**
 * 分期年月、场景对比、autosave：与已删的财务快照 domain 解耦
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { termToMonths } from '../types/installment';
import { compareProfiles } from '../lib/scenario/compare';
import { applyOverrides } from '../lib/scenario/applyOverrides';
import { createAutosave, LOCAL_REVISION_KEY, LOCAL_STATE_KEY } from '../lib/persistence/clientAutosave';
import { clampNumberField, showsNumberSlider, usesInlineNumberEdit } from '../app/numberFieldUi';
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

test('autosave writes localStorage only on blur, not on input', async () => {
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
        assert.equal(storage.get(LOCAL_STATE_KEY), undefined);
        await autosave.onBlur(profile);
        assert.equal(storage.get(LOCAL_STATE_KEY), JSON.stringify(profile));
        assert.equal(storage.get(LOCAL_REVISION_KEY), '7');
        assert.equal(writes.length, 1);
        assert.match(writes[0].body, /"revision":7/);
    } finally {
        globalThis.window = oldWindow;
        globalThis.fetch = oldFetch;
    }
});

test('asset and percentage fields clamp without opening a slider panel', () => {
    const totalAssets = 800_000;
    // 现金 / 理财：相对总资产上下界（产品未再设固定 200 万硬顶）
    assert.equal(clampNumberField(-10, { min: 0, max: totalAssets }), 0);
    assert.equal(clampNumberField(totalAssets + 50, { min: 0, max: totalAssets }), totalAssets);
    assert.equal(clampNumberField(200_000, { min: 0, max: totalAssets }), 200_000);
    // 年化收益与理财占比：0..100
    assert.equal(clampNumberField(120, { min: 0, max: 100 }), 100);
    assert.equal(clampNumberField(-1, { min: 0, max: 100 }), 0);
    // 金额 ↔ 占比：ratio% * total
    const ratio = clampNumberField(25, { min: 0, max: 100 });
    assert.equal(totalAssets * ratio / 100, 200_000);
    assert.equal(showsNumberSlider('rangedPercent'), false);
    assert.equal(usesInlineNumberEdit('rangedPercent'), true);
});
