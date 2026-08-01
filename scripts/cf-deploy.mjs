/**
 * Windows 上 `opennextjs-cloudflare deploy` 会经 getPlatformProxy 拉起本机 workerd，
 * 常因 0xc0000005 崩溃。build 完成后直接 wrangler deploy 即可上传产物。
 * OPEN_NEXT_DEPLOY=true 避免 wrangler 再回跳到 opennextjs-cloudflare deploy。
 *
 * 若本机代理导致 wrangler API 挂起，可设 CF_DEPLOY_NO_PROXY=1 清掉代理环境变量。
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const env = { ...process.env, OPEN_NEXT_DEPLOY: 'true' };

// 从 .env.local 注入 CLOUDFLARE_API_TOKEN（若尚未设置）
const envLocal = resolve(process.cwd(), '.env.local');
if (!env.CLOUDFLARE_API_TOKEN && existsSync(envLocal)) {
  for (const line of readFileSync(envLocal, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*CLOUDFLARE_API_TOKEN\s*=\s*(.+?)\s*$/);
    if (m) {
      env.CLOUDFLARE_API_TOKEN = m[1].replace(/^['"]|['"]$/g, '');
      break;
    }
  }
}

if (env.CF_DEPLOY_NO_PROXY === '1') {
  for (const key of Object.keys(env)) {
    if (/proxy/i.test(key)) delete env[key];
  }
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['wrangler', 'deploy', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  },
);

process.exit(result.status ?? 1);
