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
  // 访客主界面：鉴权入口为跳转 /login · /register（SSR/CSR 均可能在 HTML 出现路径或 href）
  const markers = ['财务规划', '访客', '剩余'];
  const hit = markers.some((m) => html.includes(m));
  if (!hit) {
    fail(`首页 HTML 未见主界面标记（试过: ${markers.join(', ')}）`);
  }
  ok(`HTTP ${res.status}，主界面 shell 正常`);

  // 首页 CSR：/login·/register 可能在 hydration 后才出现；探针 HTML 或任一本页 script chunk
  const authInHtml = html.includes('/login') && html.includes('/register');
  if (authInHtml) {
    ok('首页 HTML 含 /login·/register 入口');
  } else {
    const base = BASE_URL.replace(/\/$/, '');
    const scriptPaths = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0]);
    let authInBundle = false;
    for (const rel of scriptPaths) {
      let chunkRes;
      try {
        chunkRes = await fetch(`${base}${rel}`);
      } catch {
        continue;
      }
      if (!chunkRes.ok) continue;
      const chunkJs = await chunkRes.text();
      if (chunkJs.includes('/login') && chunkJs.includes('/register')) {
        authInBundle = true;
        break;
      }
    }
    if (!authInBundle) {
      fail('首页 script bundle 未见 /login·/register（独立页鉴权可能被移除）');
    }
    ok('首页 script bundle 含 /login·/register（CSR 鉴权入口未破坏）');
  }

  const base = BASE_URL.replace(/\/$/, '');
  for (const path of ['/register', '/login']) {
    const url = `${base}${path}`;
    let pageRes;
    try {
      pageRes = await fetch(url, { redirect: 'follow' });
    } catch (err) {
      fail(`无法连接 ${url}: ${err.message}`);
    }
    if (!pageRes.ok) fail(`HTTP ${pageRes.status} from ${url}`);
    const pageHtml = await pageRes.text();
    if (!/(注册|登录|AuthBar|auth)/i.test(pageHtml)) {
      fail(`${path} HTML 未见鉴权页痕迹`);
    }
    ok(`HTTP ${pageRes.status}，${path} 可访问`);
  }
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
  if (!/(访客|剩余)/i.test(dom)) {
    fail('Chromium dump-dom 未见主界面痕迹');
  }
  ok(`Chromium ${VIEWPORT.width}×${VIEWPORT.height} dump-dom 含主界面痕迹`);
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
