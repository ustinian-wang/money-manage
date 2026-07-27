/**
 * 本地路径消毒：Win/Linux 共用
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import {
    keyToRelativeFsPath,
    resolveDataFile,
    readDataText,
    writeDataText,
    deleteDataText,
    sanitizeFsSegment,
} from './localFs';

test('sanitizeFsSegment 替换冒号等非法字符', () => {
    assert.equal(sanitizeFsSegment('user:abc'), 'user_abc');
    assert.equal(sanitizeFsSegment('ratelimit:login:::1'), 'ratelimit_login___1');
    assert.equal(sanitizeFsSegment('con'), '_con');
    assert.equal(sanitizeFsSegment('file.'), 'file');
});

test('keyToRelativeFsPath 保留目录层级且消毒段名', () => {
    const rel = keyToRelativeFsPath('user:abc/financial-profile.json');
    assert.equal(rel, path.join('user_abc', 'financial-profile.json'));
    assert.equal(keyToRelativeFsPath('ratelimit:login:::1'), 'ratelimit_login___1');
});

test('resolveDataFile 使用 path.join 拼到 data/', () => {
    const abs = resolveDataFile('user:x/a.json', '/tmp/proj');
    assert.equal(abs, path.join('/tmp/proj', 'data', 'user_x', 'a.json'));
});

test('write/read/delete 往返（临时目录）', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'mm-localfs-'));
    try {
        const key = 'ratelimit:login:::1';
        await writeDataText(key, '{"count":1}\n', cwd);
        const raw = await readDataText(key, cwd);
        assert.equal(raw, '{"count":1}\n');
        const expected = resolveDataFile(key, cwd);
        await fs.access(expected);
        await deleteDataText(key, cwd);
        assert.equal(await readDataText(key, cwd), null);
    } finally {
        await fs.rm(cwd, { recursive: true, force: true });
    }
});

test('write 嵌套键时抬升挡住的扁平文件', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'mm-localfs-hoist-'));
    try {
        const flatKey = 'user:collide';
        await writeDataText(flatKey, '{"id":"collide"}\n', cwd);
        await writeDataText('user:collide/financial-profile.json', '{"revision":1}\n', cwd);
        const profile = await readDataText('user:collide/financial-profile.json', cwd);
        assert.equal(profile, '{"revision":1}\n');
        // 原扁平内容仍可读（via __legacy_blob__）
        const account = await readDataText(flatKey, cwd);
        assert.match(account || '', /collide/);
        const dir = resolveDataFile(flatKey, cwd);
        const st = await fs.stat(dir);
        assert.equal(st.isDirectory(), true);
    } finally {
        await fs.rm(cwd, { recursive: true, force: true });
    }
});
