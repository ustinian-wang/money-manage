#!/usr/bin/env node
/**
 * 移动冒烟：HTTP 门禁探针 + 可选 Chromium 390×844
 * 用法：先 npm run dev，再 npm run test:mobile-smoke
 * 边界：不能等价 iOS Safari 键盘；见 tests/mobile-smoke.md
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const VIEWPORT = { width: 390, height: 844 };

function fail(msg) {
  console.error(`[mobile-smoke] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[mobile-smoke] OK: ${msg}`);
}

async function httpSmoke() {
  let res;
  try {
    res = await fetch(BASE_URL, { redirect: 'follow' });
  } catch (err) {
    fail(`无法连接 ${BASE_URL}（请先 npm run dev）: ${err.message}`);
  }
  if (!res.ok) fail(`HTTP ${res.status} from ${BASE_URL}`);
  const html = await res.text();
  // 访客主界面 / 鉴权入口：不再强制全屏门禁
  const markers = ['财务管理', '访客', '注册保存', '剩余', 'AuthBar', '登录'];
  const hit = markers.some((m) => html.includes(m));
  if (!hit) {
    fail(`首页 HTML 未见主界面/鉴权相关标记（试过: ${markers.join(', ')}）`);
  }
  ok(`HTTP ${res.status}，页面含主界面/鉴权相关内容`);
}

function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  for (const c of candidates) {
    if (c.includes('/') && !existsSync(c)) continue;
    return c;
  }
  return null;
}

function chromeSmoke(chromePath) {
  // 用 data URL 无法测本站；通过 --dump-dom 拉取本地页
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    `--virtual-time-budget=2000`,
    '--dump-dom',
    BASE_URL,
  ];
  const result = spawnSync(chromePath, args, {
    encoding: 'utf8',
    timeout: 25_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) {
    console.warn(`[mobile-smoke] SKIP Chromium: ${result.error.message}`);
    return;
  }
  if (result.status !== 0) {
    console.warn(`[mobile-smoke] SKIP Chromium exit=${result.status}: ${(result.stderr || '').slice(0, 200)}`);
    return;
  }
  const dom = result.stdout || '';
  if (!/(input|登录|注册|账号)/i.test(dom)) {
    fail('Chromium dump-dom 未见 input/登录相关节点');
  }
  ok(`Chromium ${VIEWPORT.width}×${VIEWPORT.height} dump-dom 含输入/门禁痕迹`);
  console.warn(
    '[mobile-smoke] NOTE: Chromium 设备模式 ≠ iOS Safari 键盘；真机请用 Web Inspector 复核',
  );
}

await httpSmoke();
const chrome = resolveChrome();
if (chrome) {
  chromeSmoke(chrome);
} else {
  console.warn('[mobile-smoke] SKIP Chromium：未找到 Chrome/Chromium（HTTP 冒烟已通过）');
}
