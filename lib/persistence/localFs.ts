/**
 * 本地 data/ 路径：KV 逻辑键 → 跨平台安全相对路径
 * - 保留 `/` 为目录层级
 * - 段内非法字符（含 Windows 禁用的 `:` 等）替换为 `_`
 * - 读写均用 path.join，避免手写分隔符
 */
import path from 'node:path';
import fs from 'node:fs/promises';

export const DATA_DIR_NAME = 'data';

/** Windows 文件名非法 + 控制字符 */
const ILLEGAL_IN_SEGMENT = /[:*?"<>|\x00-\x1f]/g;

export function dataRoot(cwd = process.cwd()): string {
    return path.join(cwd, DATA_DIR_NAME);
}

/** 单个路径段消毒（Win/Linux 通用） */
export function sanitizeFsSegment(segment: string): string {
    let cleaned = segment.replace(ILLEGAL_IN_SEGMENT, '_').replace(/[. ]+$/g, '');
    if (!cleaned) cleaned = '_';
    // Windows 保留设备名
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) {
        cleaned = `_${cleaned}`;
    }
    return cleaned;
}

/**
 * KV 键 → data/ 下相对路径（使用当前平台分隔符）
 * 例：user:abc/financial-profile.json → user_abc/financial-profile.json
 * 例：ratelimit:login:::1 → ratelimit_login___1
 */
export function keyToRelativeFsPath(key: string): string {
    const parts = key
        .split(/[/\\]+/)
        .map(sanitizeFsSegment)
        .filter((part) => part.length > 0);
    if (parts.length === 0) return '_';
    return path.join(...parts);
}

/** 逻辑键 → data/ 下绝对路径（写入始终用此路径） */
export function resolveDataFile(key: string, cwd = process.cwd()): string {
    return path.join(dataRoot(cwd), keyToRelativeFsPath(key));
}

function isSafeLegacyRelative(key: string): boolean {
    // 仅当原键本身不含 Windows 非法字符时，才尝试旧路径（兼容 Linux 历史落盘）
    return !ILLEGAL_IN_SEGMENT.test(key) && !/[. ]$/.test(key);
}

/**
 * 解析可读路径：优先消毒路径；若无文件且原键在本平台可落盘，再试旧路径
 */
export async function resolveReadableDataFile(key: string, cwd = process.cwd()): Promise<string | null> {
    const primary = resolveDataFile(key, cwd);
    try {
        await fs.access(primary);
        return primary;
    } catch {
        /* try legacy */
    }
    if (!isSafeLegacyRelative(key)) return null;
    const legacy = path.join(dataRoot(cwd), ...key.split(/[/\\]+/).filter(Boolean));
    if (path.normalize(legacy) === path.normalize(primary)) return null;
    try {
        await fs.access(legacy);
        return legacy;
    } catch {
        return null;
    }
}

/** 原子写：Win 上目标已存在时 rename 可能失败，先删再移 */
export async function atomicWriteText(file: string, body: string): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temp, body, 'utf8');
    try {
        await fs.rename(temp, file);
    } catch {
        await fs.rm(file, { force: true });
        await fs.rename(temp, file);
    }
}

export async function readDataText(key: string, cwd = process.cwd()): Promise<string | null> {
    const file = (await resolveReadableDataFile(key, cwd)) ?? resolveDataFile(key, cwd);
    try {
        return await fs.readFile(file, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
    }
}

export async function writeDataText(key: string, body: string, cwd = process.cwd()): Promise<void> {
    await atomicWriteText(resolveDataFile(key, cwd), body);
}

export async function deleteDataText(key: string, cwd = process.cwd()): Promise<void> {
    const existing = await resolveReadableDataFile(key, cwd);
    const targets = existing ? [existing] : [resolveDataFile(key, cwd)];
    for (const file of targets) {
        try {
            await fs.unlink(file);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
    }
}

/** 列出 prefix 目录下 .json 文件名（返回逻辑前缀 + 文件名，与远端 list 语义对齐） */
export async function listDataJsonKeys(prefix: string, cwd = process.cwd()): Promise<string[]> {
    const normalized = prefix.replace(/\/$/, '');
    const dir = resolveDataFile(normalized, cwd);
    try {
        const names = await fs.readdir(dir);
        return names
            .filter((name) => name.endsWith('.json'))
            .map((name) => `${prefix.endsWith('/') ? prefix : `${prefix}/`}${name}`)
            .sort()
            .reverse();
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
    }
}
