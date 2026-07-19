import fs from 'node:fs/promises';
import path from 'node:path';
import { emptyState, normalizeState, PersistedState } from './types';

export const DATA_DIR = path.join(process.cwd(), 'data');
export const STATE_FILE = path.join(DATA_DIR, 'financial-profile.json');
export const BACKUP_DIR = path.join(DATA_DIR, 'backups');

async function ensureDataDir() {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
}

export async function readState(): Promise<PersistedState> {
    await ensureDataDir();
    try {
        return normalizeState(JSON.parse(await fs.readFile(STATE_FILE, 'utf8')));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
        throw new Error(`Unable to read financial state: ${(error as Error).message}`);
    }
}

export async function writeState(input: unknown, expectedRevision?: number) {
    await ensureDataDir();
    const current = await readState();
    if (expectedRevision !== undefined && expectedRevision !== current.revision) {
        const error = new Error('State revision conflict');
        (error as Error & { code?: string; current?: PersistedState }).code = 'REVISION_CONFLICT';
        (error as Error & { current?: PersistedState }).current = current;
        throw error;
    }
    const next = normalizeState(input);
    next.revision = current.revision + 1;
    next.updatedAt = new Date().toISOString();
    const tempFile = `${STATE_FILE}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempFile, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await fs.rename(tempFile, STATE_FILE);
    const backup = path.join(BACKUP_DIR, `financial-profile-${next.revision}-${Date.now()}.json`);
    await fs.copyFile(STATE_FILE, backup);
    return next;
}

export async function listBackups() {
    await ensureDataDir();
    return (await fs.readdir(BACKUP_DIR)).filter((file) => file.endsWith('.json')).sort().reverse();
}
