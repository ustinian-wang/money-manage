import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// ponytail: 不做 Next ISR R2 缓存；业务 JSON 走 MONEY_DATA binding
export default defineCloudflareConfig({});
