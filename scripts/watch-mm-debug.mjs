#!/usr/bin/env node
/**
 * 常驻监听 logs/mm-debug.ndjson：有新上报则自动打印分析
 * 用法：node scripts/watch-mm-debug.mjs
 * 上报写入由 /api/debug-log 完成（含 analyze 字段）
 */
import { watch, existsSync, mkdirSync, openSync, readSync, closeSync, fstatSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(import.meta.url), '..', '..');
const logDir = path.join(root, 'logs');
const ndjson = path.join(logDir, 'mm-debug.ndjson');

mkdirSync(logDir, { recursive: true });
if (!existsSync(ndjson)) {
  writeFileSync(ndjson, '', 'utf8');
}

function printBanner() {
  console.log('[mm-debug-watch] listening', ndjson);
  console.log('[mm-debug-watch] 手机点「上报终端」后这里会自动分析');
}

let offset = 0;
try {
  const fd0 = openSync(ndjson, 'r');
  offset = fstatSync(fd0).size;
  closeSync(fd0);
} catch {
  offset = 0;
}

function consumeNew() {
  let fd;
  try {
    fd = openSync(ndjson, 'r');
    const st = fstatSync(fd);
    if (st.size < offset) offset = 0;
    if (st.size === offset) {
      closeSync(fd);
      return;
    }
    const len = st.size - offset;
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, offset);
    offset = st.size;
    closeSync(fd);
    fd = undefined;
    const text = buf.toString('utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let record;
      try {
        record = JSON.parse(trimmed);
      } catch {
        console.warn('[mm-debug-watch] skip bad line');
        continue;
      }
      console.log('\n========== 新上报 ==========');
      console.log('[mm-debug-watch] receivedAt=', record.receivedAt || '(?)');
      if (typeof record.analyze === 'string' && record.analyze) {
        console.log(record.analyze);
      } else {
        console.log('[mm-debug-watch] (no analyze field)');
      }
      console.log('========== 分析结束 ==========\n');
    }
  } catch (err) {
    if (fd != null) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
    console.warn('[mm-debug-watch] read error', err);
  }
}

printBanner();
consumeNew();

watch(ndjson, { persistent: true }, (event) => {
  if (event === 'rename') offset = 0;
  consumeNew();
});

setInterval(consumeNew, 1500);
