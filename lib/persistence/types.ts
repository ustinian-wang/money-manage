export const CURRENT_SCHEMA_VERSION = 1;

export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type PersistedState = {
    schemaVersion: number;
    revision: number;
    updatedAt: string;
    profile: JsonObject;
    snapshots: JsonValue[];
    scenarios: Scenario[];
};

export type ScenarioOverride = {
    path: string;
    before?: JsonValue;
    after: JsonValue;
    effectiveMonth?: string;
};

export type Scenario = {
    id: string;
    name: string;
    type: 'baseline' | 'comparison';
    baseProfileId?: string;
    overrides: ScenarioOverride[];
    createdAt: string;
    updatedAt: string;
};

export function emptyState(): PersistedState {
    return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        revision: 0,
        updatedAt: new Date(0).toISOString(),
        profile: {},
        snapshots: [],
        scenarios: [],
    };
}

export function normalizeState(input: unknown): PersistedState {
    const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    const profile = source.profile && typeof source.profile === 'object' ? source.profile : {};
    const snapshots = Array.isArray(source.snapshots) ? source.snapshots : [];
    const scenarios = Array.isArray(source.scenarios) ? source.scenarios : [];
    const revision = Number.isInteger(source.revision) && Number(source.revision) >= 0 ? Number(source.revision) : 0;
    const updatedAt = typeof source.updatedAt === 'string' ? source.updatedAt : new Date(0).toISOString();
    return { schemaVersion: CURRENT_SCHEMA_VERSION, revision, updatedAt, profile: profile as JsonObject, snapshots, scenarios: scenarios as Scenario[] };
}
