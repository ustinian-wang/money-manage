import { createRequire } from 'node:module';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 缩小首包：按需解析大依赖的子路径（echarts 仍由 ChartHost 动态加载）
  experimental: {
    optimizePackageImports: ['echarts', 'echarts-for-react'],
  },
};

export default nextConfig;

// 本地 next dev 时注入 Wrangler bindings（含 KV MONEY_DATA）
// workerd/miniflare 在当前 Windows 环境会 access violation 崩溃；默认走 data/ 文件持久化
// 需要 Cloudflare 本地绑定时：CLOUDFLARE_DEV=1 npm run dev
if (process.env.CLOUDFLARE_DEV === '1') {
  const require = createRequire(import.meta.url);
  const { initOpenNextCloudflareForDev } = require('@opennextjs/cloudflare');
  initOpenNextCloudflareForDev();
}
