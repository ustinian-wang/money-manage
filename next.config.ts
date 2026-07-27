import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;

// 本地 next dev 时注入 Wrangler bindings（含 KV MONEY_DATA）
// workerd/miniflare 在当前 Windows 环境会 access violation 崩溃；默认走 data/ 文件持久化
// 需要 Cloudflare 本地绑定时：CLOUDFLARE_DEV=1 npm run dev
if (process.env.CLOUDFLARE_DEV === '1') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initOpenNextCloudflareForDev } = require('@opennextjs/cloudflare');
  initOpenNextCloudflareForDev();
}
