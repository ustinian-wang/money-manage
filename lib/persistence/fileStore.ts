/**
 * 财务状态持久化：本地 data/*.json；Cloudflare 用 KV/R2 同名「文本」键。
 * R2 免费约 10GB（需 Dashboard 开通）；未开通时用 Workers KV 存 JSON 文本。
 */
import { emptyState, normalizeState, PersistedState } from './types';

export const STATE_KEY = 'financial-profile.json';
export const BACKUP_PREFIX = 'backups/';

type RemoteStore = {
    getText(key: string): Promise<string | null>;
    putText(key: string, value: string): Promise<void>;
    listKeys(prefix: string): Promise<string[]>;
};

async function getRemoteStore(): Promise<RemoteStore | null> {
    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const { env } = await getCloudflareContext({ async: true });
        const bag = env as {
            MONEY_DATA?: {
                get(key: string, type?: string): Promise<unknown>;
                put(key: string, value: string): Promise<unknown>;
                list(options?: { prefix?: string }): Promise<{ keys?: { name: string }[]; objects?: { key: string }[] }>;
            };
        };
        const binding = bag.MONEY_DATA;
        if (!binding) return null;

        // R2：get 返回 R2ObjectBody；KV：get 直接返回 string
        return {
            async getText(key) {
                const value = await binding.get(key, 'text');
                if (value == null) return null;
                if (typeof value === 'string') return value;
                if (typeof (value as { text?: () => Promise<string> }).text === 'function') {
                    return (value as { text: () => Promise<string> }).text();
                }
                return String(value);
            },
            async putText(key, body) {
                await binding.put(key, body);
            },
            async listKeys(prefix) {
                const listed = await binding.list({ prefix });
                if (listed.objects) return listed.objects.map((item) => item.key).sort().reverse();
                if (listed.keys) return listed.keys.map((item) => item.name).sort().reverse();
                return [];
            },
        };
    } catch {
        return null;
    }
}

async function readText(key: string): Promise<string | null> {
    const remote = await getRemoteStore();
    if (remote) return remote.getText(key);
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.join(process.cwd(), 'data', key);
    try {
        return await fs.readFile(file, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
    }
}

async function writeText(key: string, body: string): Promise<void> {
    const remote = await getRemoteStore();
    if (remote) {
        await remote.putText(key, body);
        return;
    }
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.join(process.cwd(), 'data', key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temp, body, 'utf8');
    await fs.rename(temp, file);
}

async function listKeys(prefix: string): Promise<string[]> {
    const remote = await getRemoteStore();
    if (remote) return remote.listKeys(prefix);
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const dir = path.join(process.cwd(), 'data', prefix.replace(/\/$/, ''));
    try {
        const names = await fs.readdir(dir);
        return names.filter((name) => name.endsWith('.json')).map((name) => `${prefix}${name}`).sort().reverse();
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
    }
}

export async function readState(): Promise<PersistedState> {
    try {
        const raw = await readText(STATE_KEY);
        if (!raw) return emptyState();
        return normalizeState(JSON.parse(raw));
    } catch (error) {
        throw new Error(`Unable to read financial state: ${(error as Error).message}`);
    }
}

export async function writeState(input: unknown, expectedRevision?: number) {
    const current = await readState();
    if (expectedRevision !== undefined && expectedRevision !== current.revision) {
        const error = new Error('State revision conflict') as Error & { code?: string; current?: PersistedState };
        error.code = 'REVISION_CONFLICT';
        error.current = current;
        throw error;
    }
    const partial = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    const next = normalizeState({
        ...current,
        ...partial,
        profile: partial.profile ?? current.profile,
        snapshots: partial.snapshots ?? current.snapshots,
        scenarios: partial.scenarios ?? current.scenarios,
    });
    next.revision = current.revision + 1;
    next.updatedAt = new Date().toISOString();
    const body = `${JSON.stringify(next, null, 2)}\n`;
    await writeText(STATE_KEY, body);
    await writeText(`${BACKUP_PREFIX}financial-profile-${next.revision}-${Date.now()}.json`, body);
    return next;
}

export async function listBackups() {
    return (await listKeys(BACKUP_PREFIX)).map((key) => key.slice(BACKUP_PREFIX.length));
}

export const DATA_DIR = 'data';
export const STATE_FILE = STATE_KEY;
export const BACKUP_DIR = BACKUP_PREFIX;
