import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRetirementTimeline, calculateRetirement, GUANGZHOU_SOCIAL_RULE_2026, RETIREMENT_RULES } from './retirement';

test('retirement planning is opt-in and uses the 2026 Guangzhou rule base', () => {
    const result = calculateRetirement({ enabled: true, birthDate: '1990-06-01', identity: 'male', insuranceStartDate: '2020-01-01', plannedContributionYears: 20, contributionBase: 1000, ruleVersion: GUANGZHOU_SOCIAL_RULE_2026.ruleVersion, city: 'guangzhou' });
    assert.equal(result.contributionYears, 20);
    assert.equal(result.contributionBase, GUANGZHOU_SOCIAL_RULE_2026.minContributionBase);
    assert.match(result.retirementDate, /^20\d\d-\d\d-\d\d$/);
    assert.equal(result.ruleVersion, 'guangzhou-2026-v1');
    assert.equal(result.retirementAgeMonths >= 60 * 12, true);
});

test('rules are versioned and an unknown version is rejected', () => {
    assert.equal(RETIREMENT_RULES['guangzhou-2026-v1'].defaultContributionYears, 20);
    assert.throws(() => calculateRetirement({ enabled: true, birthDate: '1990-01-01', identity: 'male', insuranceStartDate: '2020-01-01', plannedContributionYears: 20, contributionBase: 10000, ruleVersion: 'unknown', city: 'guangzhou' }), /Unknown retirement rule version/);
});

test('planned contributions cannot continue beyond retirement', () => {
    const result = calculateRetirement({ enabled: true, birthDate: '1965-01-01', identity: 'male', insuranceStartDate: '2020-01-01', plannedContributionYears: 50, contributionBase: 10000, ruleVersion: GUANGZHOU_SOCIAL_RULE_2026.ruleVersion, city: 'guangzhou' });
    assert.ok(result.contributionMonths < 50 * 12);
    assert.ok(result.contributionEndDate <= result.retirementDate);
});

test('invalid dates and timeline parameters are rejected', () => {
    assert.throws(() => calculateRetirement({ enabled: true, birthDate: '1990-02-31', identity: 'male', insuranceStartDate: '2020-01-01', plannedContributionYears: 20, contributionBase: 10000, city: 'guangzhou' }), /birthDate/);
    assert.throws(() => buildRetirementTimeline({ enabled: true, birthDate: '1990-01-01', identity: 'male', insuranceStartDate: '2020-01-01', plannedContributionYears: 20, contributionBase: 10000, city: 'guangzhou' }, '2026-01-01', -1), /horizonMonths/);
});

test('timeline stops social insurance after retirement', () => {
    const points = buildRetirementTimeline({ enabled: true, birthDate: '1967-01-01', identity: 'male', insuranceStartDate: '2000-01-01', plannedContributionYears: 20, contributionBase: 10000, ruleVersion: GUANGZHOU_SOCIAL_RULE_2026.ruleVersion, city: 'guangzhou' }, '2026-01-01', 360);
    assert.equal(points.length, 360);
    assert.ok(points.some((point) => point.socialInsuranceEnabled));
    assert.ok(points.some((point) => !point.socialInsuranceEnabled));
});

test('disabled planning does not affect the timeline', () => {
    assert.deepEqual(buildRetirementTimeline({ enabled: false, birthDate: '1990-01-01', identity: 'male', insuranceStartDate: '2020-01-01', plannedContributionYears: 20, contributionBase: 10000, ruleVersion: GUANGZHOU_SOCIAL_RULE_2026.ruleVersion, city: 'guangzhou' }, '2026-01-01'), []);
});
