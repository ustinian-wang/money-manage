# money-manage

个人财务管理**原型**：在浏览器里调工资、资产与支出，即时重算到手收入、月度结余、30 年资产走势与剩余可支配收入占比走势。

主界面：`app/page.tsx`（Next.js App Router 单页）。仓库：<https://github.com/ustinian-wang/money-manage>

> **不以离线缓存为目标**：不注册 Service Worker 做页面/壳缓存；刷新即拿最新文档与资源（「保存到桌面」仅保留 manifest / iOS 引导）。

> 个税 / 五险一金为月度估算，结果仅供个人规划参考，不是完整 CFP / 投顾模型。

文档：[移动端 UX P0](docs/prd-mobile-ux.md) · [新用户首访审计](docs/first-visit-audit.md)（待跟进）

---

## 技术栈与运行

| 项 | 说明 |
| --- | --- |
| 框架 | Next.js 15、React 18、TypeScript |
| UI / 图 | Tailwind CSS；ECharts（`echarts-for-react`） |
| Node | `>=20 <23`，npm `>=10`（见 `package.json` → `engines`） |

```bash
npm install
npm run dev      # next dev --turbopack，默认 http://localhost:3000
npm run build
npm run start    # 生产启动（需先 build）
npm test         # 领域单测（可选）
```

可选 PM2：`npm run pm2:start` / `pm2:restart` / `pm2:stop` / `pm2:logs`（见 `ecosystem.config.cjs`）。

---

## 主要功能（对照当前页面）

### 1. 财务参数

四组：

| 分组 | 内容 |
| --- | --- |
| 收入信息 | 默认「只看到手」；可切「关心五险一金」。两套设置独立存储；结余/预测用统一出口可支配收入 |
| 资产与理财 | **现金 = 总资产 − 理财**（`LinkedFieldGroup` 等价联动）；理财占比、年化收益率、闲钱投资（百分比或固定月额） |
| 应急资金 | 应急资金月数、月度剩余、调整后可用资产（已扣分期承诺首付） |
| 退休与社保 | 可开关；出生日期 / 身份 / 参保日 / 缴费年限；**社保基数**可手改，并可用城市快捷填入当年常用基数 |

### 2. 支出管理

类型：`fixed` 固定 · `percentage` 按比例（相对可支配收入 + 理财月收益）· `installment` 分期 · `one_time` 一次性。

- **新增**：默认金额 `0`；挂上 DOM 后滚到新项（`data-expense-anchor`，桌面行 / 移动卡双锚点）
- **删除**：`ConfirmDialog`（FloatPanel field 矮卡）二次确认，**不用**裸 `window.confirm`

操作列 **分析**：打开「消费影响分析」浮层。

- **叠加全量**（默认）：对比「去掉本笔」vs「其他支出 + 本笔草稿」
- **仅本项**：对比「无支出」vs「仅本笔草稿」
- 浮层内改参只动 **草稿**，**不写回**支出表、**不触发**自动保存；可重置为已保存值

### 3. 资产走势与剩余可支配收入走势

- **资产走势**：从当前现金 + 理财起，按月复合收益 + 闲钱投资，预测约 30 年；Y 轴用 **万元**（`moneyWan`）；可看月度明细
- **剩余可支配收入走势 / 现金流比率**：约 360 个月；窄屏 `grid.right ≈ 68px`，避免 markLine 文案裁切

剩余可支配占比（页面内）：

```text
expensePct           = 当月总支出 / 可支配收入 × 100%
remainDisposablePct  = 100 − expensePct   （允许负值，表示超支）
```

分母为「可支配收入」（税后净收入），分期按当月真实月供。曲线水平线：满额 100%、打满 0%、警告 −10/−20/−50%（对应支出 110/120/150%）。

### 4. 本地自动保存与云同步

- **访客（未登录）**：改参约 400ms 防抖写入 `localStorage` 键 `money-manage-profile`（`schemaVersion: 4`）；**不**请求 `/api/profile`。UI 标明「访客 / 示例数据，仅本机临时」。
- **已登录**：同时写 localStorage，并 PUT `/api/profile` 到本人云端。
- **注册认领**：注册成功且云端为空时，把当前内存/本机草稿写入该账号。
- **登录空账号**：二次确认是否绑定当前访客草稿；已有云端数据则用云端。

### 5. 重启网站（纯客户端）

顶栏「更多 → 重启网站」：确认后 **仅** unregister Service Worker、清空 Cache Storage，再带 cache-bust 硬刷新。  
**不会**删除 localStorage 草稿、**不会**清登录 cookie、**不会**调用后端 restart。用于部署后浏览器仍拿旧资源时自救。

---

## 「一次性」支出口径

| 场景 | 口径 |
| --- | --- |
| 本月仪表盘 | 与固定支出一样计入当期 `monthlyExpenses` |
| 持续月支出 `recurring` | **不含** `one_time` |
| 月度资产预测 | 第 1 期（现在→下月）扣一次性；**month ≥ 2** 仅 recurring |
| 年度 / 分析 30 年资产 | **year 1** 扣一次；**year ≥ 2** 为 0 |

---

## 分析报告两种模式

设当前行支出为 `E`，草稿为 `draft`：

| 模式 | 消费前（before） | 测算（after） |
| --- | --- | --- |
| 叠加全量 | `expenses` 去掉 `E` | 其余支出 + `draft`（替换同 id） |
| 仅本项 | `[]` | `[draft]` |

两侧都走同一套 `computeFinanceResult`，再比剩余可支配占比、月度支出/剩余、分期月供与负债、可用资产、净资产，以及 30 年资产差额。

---

## 数据与隐私

- **访客可进**：打开即可用主界面（示例 / 本机草稿）；登出后回到访客，不强制全屏门禁
- **多用户**：注册 / 登录后，服务端只读写当前会话用户的数据（HttpOnly cookie `mm_session`）
- **本地缓存**：访客与登录都会写 `localStorage`（键 `money-manage-profile`）；`/api/profile` 须登录
- **注册认领 / 空账号绑定**：见上文「本地自动保存与云同步」；登录空账号有二次确认
- **重启网站**：纯客户端清 SW/Cache 后刷新；不碰草稿与会话
- **服务端键**：
  - `user:{id}` / `idx:username:*` / `idx:email:*` / `session:{token}`
  - `user:{id}/financial-profile.json` 与 `user:{id}/backups/*.json`
  - 本地 Node：落在 `data/` 同名路径；Cloudflare：Workers KV `MONEY_DATA`
- 密码：PBKDF2-SHA256，不明文。无邮箱、无找回密码（已知局限）
- 仓库内可能有 `data/`、`logs/`；`.gitignore` 已忽略备份与日志。个人财务 JSON **不要提交**

---

## 账号规则（速查）

| 字段 | 规则 |
| --- | --- |
| 账号 | 必填，最长 **32** 位；无最短、无字符集限制；全局唯一 |
| 密码 | 必填，最长 **72** 位；无最短长度 |
| 邮箱 | **不要求**（旧数据可兼容；新注册不填） |
| 登录 | 账号 + 密码 |

---

## 部署到 Cloudflare

```bash
npm install
wrangler login
npm run deploy       # OpenNext 构建并发布到 Workers
```

Worker 名：`money-manage`（见 `wrangler.jsonc`）。线上入口一般为 `https://money-manage.<account>.workers.dev`（以 `npm run deploy` 输出为准）。

本地用 Workers 运行时预览：`npm run preview`（含 KV 本地模拟）。日常开发仍可用 `npm run dev`（经 `initOpenNextCloudflareForDev` 注入 bindings）。

若要改用 R2（约 10GB）：在 [R2 Overview](https://dash.cloudflare.com/?to=/:account/r2) 开通后创建桶，把 `wrangler.jsonc` 的 `kv_namespaces` 换成 `r2_buckets`（binding 仍用 `MONEY_DATA`）。

---

## 已知局限

- 剩余可支配占比曲线分母固定为当前可支配收入
- 个税、社保、退休为简化估算，**非**完整理财规划师模型
- 鉴权：无邮箱验证、无找回密码；登录/注册仅有基础按 IP 频率限制
- 登出后回到访客主界面（本机草稿可继续）；云端数据需重新登录后读取
- 「重启网站」无法强制清掉浏览器 HTTP 磁盘缓存的全部条目（依赖 SW/Cache API + 硬刷新）

---

## 目录速览

```text
app/page.tsx          # 主 UI + 现场计算口径
app/login/page.tsx    # 登录独立页
app/register/page.tsx # 注册独立页（认领闸门）
app/auth/page.tsx     # 旧 /auth?mode= → redirect
app/AuthBar.tsx       # 顶栏跳转入口 + 鉴权表单
app/api/auth/*        # 注册、登录、登出、me
lib/auth/             # PBKDF2、会话、用户存 KV/data、空账号绑定
domain/               # 税 / 社保 / 分期 / 支出等领域逻辑与测试
lib/persistence/      # 按 userId 隔离的 profile 读写
data/                 # 本地数据（勿提交隐私）
tests/                # 集成向单测
```
