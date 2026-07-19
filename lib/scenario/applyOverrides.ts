import type { JsonObject, JsonValue, ScenarioOverride } from '../persistence/types';

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

export function applyOverrides<T extends JsonObject>(profile: T, overrides: ScenarioOverride[], effectiveMonth?: string): T {
    const result = clone(profile);
    for (const override of overrides) {
        if (effectiveMonth && override.effectiveMonth && override.effectiveMonth > effectiveMonth) continue;
        const parts = override.path.split('.').filter(Boolean);
        if (!parts.length) continue;
        let cursor: Record<string, JsonValue> = result;
        for (const part of parts.slice(0, -1)) {
            if (!cursor[part] || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) cursor[part] = {};
            cursor = cursor[part] as Record<string, JsonValue>;
        }
        cursor[parts[parts.length - 1]] = clone(override.after);
    }
    return result;
}
