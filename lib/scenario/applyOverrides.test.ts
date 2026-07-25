/**
 * 场景覆盖：路径覆盖 applyOverrides；compareProfiles 产出 baseline/comparison
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { applyOverrides } from './applyOverrides';
import { buildBaselineScenario, buildComparisonScenario, compareProfiles } from './compare';

describe('applyOverrides', () => {
    test('按 path 写入嵌套字段；跳过空 path', () => {
        const profile = { salary: 10000, nest: { a: 1 } };
        const next = applyOverrides(profile, [
            { path: 'salary', after: 12000 },
            { path: 'nest.b', after: 2 },
            { path: '', after: 9 },
        ]);
        assert.equal(next.salary, 12000);
        assert.equal((next.nest as { a: number; b: number }).a, 1);
        assert.equal((next.nest as { a: number; b: number }).b, 2);
        assert.equal(profile.salary, 10000); // 不改原对象
    });

    test('effectiveMonth 晚于当前月则跳过', () => {
        const next = applyOverrides(
            { x: 1 },
            [{ path: 'x', after: 9, effectiveMonth: '2030-01' }],
            '2026-07',
        );
        assert.equal(next.x, 1);
    });
});

describe('compare / build scenarios', () => {
    test('baseline 无覆盖；comparison 带 overrides', () => {
        const base = buildBaselineScenario('当前');
        assert.equal(base.type, 'baseline');
        assert.deepEqual(base.overrides, []);

        const cmp = buildComparisonScenario('加薪', [{ path: 'salary', after: 1 }]);
        assert.equal(cmp.type, 'comparison');
        assert.equal(cmp.overrides.length, 1);

        const { baseline, comparison } = compareProfiles({ salary: 10 }, cmp.overrides);
        assert.equal(baseline.salary, 10);
        assert.equal(comparison.salary, 1);
    });
});
