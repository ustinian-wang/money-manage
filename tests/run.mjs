/**
 * 递归收集 *.test.ts 并交给 node:test
 * 用法：npm test（见 package.json）
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SKIP = new Set(['node_modules', '.next', '.open-next', '.git', 'dist', 'logs', '.wrangler']);
const ROOTS = ['app', 'domain', 'lib', 'tests'];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.test.ts')) {
      out.push(relative(ROOT, p).split('\\').join('/'));
    }
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(join(ROOT, r))).sort((a, b) =>
  a.localeCompare(b),
);

if (files.length === 0) {
  console.error('No *.test.ts files found under:', ROOTS.join(', '));
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--import',
    './tests/ts-ext-resolve.mjs',
    '--test',
    ...files,
  ],
  { cwd: ROOT, stdio: 'inherit', env: process.env, shell: false },
);

process.exit(result.status ?? 1);
