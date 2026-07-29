/**
 * 调试日志上报：终端打印 + 落盘 logs/mm-debug.ndjson 供常驻监听
 */
import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { analyzeDebugSnapshot, formatAnalyzeReport } from '../../../lib/analyzeDebugSnapshot';

const LOG_DIR = path.join(process.cwd(), 'logs');
const NDJSON = path.join(LOG_DIR, 'mm-debug.ndjson');
const LATEST = path.join(LOG_DIR, 'mm-debug-latest.json');

export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = { error: 'invalid json' };
  }
  const ua = req.headers.get('user-agent') || '';
  const receivedAt = new Date().toISOString();
  console.info('[mm-debug]', receivedAt, ua.slice(0, 80));
  console.info('[mm-debug]', typeof body === 'string' ? body : JSON.stringify(body, null, 2));

  const report = formatAnalyzeReport(analyzeDebugSnapshot(body));
  console.info('[mm-debug-analyze]\n' + report);

  try {
    await mkdir(LOG_DIR, { recursive: true });
    const record = {
      receivedAt,
      ua,
      snap: body,
      analyze: report,
    };
    await appendFile(NDJSON, `${JSON.stringify(record)}\n`, 'utf8');
    await writeFile(LATEST, JSON.stringify(record, null, 2), 'utf8');
  } catch (err) {
    console.warn('[mm-debug] write logs failed', err);
  }

  return NextResponse.json({ ok: true, analyze: report });
}
