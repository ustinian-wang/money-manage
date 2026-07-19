import type { JsonObject, Scenario, ScenarioOverride } from '../persistence/types';
import { applyOverrides } from './applyOverrides';

export function buildBaselineScenario(name = '当前方案'): Scenario {
    const now = new Date().toISOString();
    return { id: 'baseline', name, type: 'baseline', overrides: [], createdAt: now, updatedAt: now };
}

export function buildComparisonScenario(name: string, overrides: ScenarioOverride[], baseProfileId = 'default'): Scenario {
    const now = new Date().toISOString();
    return { id: `comparison-${Date.now()}`, name, type: 'comparison', baseProfileId, overrides, createdAt: now, updatedAt: now };
}

export function compareProfiles(profile: JsonObject, overrides: ScenarioOverride[]) {
    const baseline = profile;
    const comparison = applyOverrides(profile, overrides);
    return { baseline, comparison, overrides };
}
