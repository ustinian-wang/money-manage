# 发布前 UI 检查清单

> **定位**：Jest 管「代码对不对」；本清单 + 真实浏览器管「页面看起来对不对」。  
> 来源：[Notion 规范摘要](./notion-refactor-spec.md) · 交叉引用 [`tests/mobile-smoke.md`](../tests/mobile-smoke.md)

## 前置（两条命令）

```bash
cd projects/money-manage
npm test                              # 领域逻辑 + 组件行为
npm run dev                           # 终端 A：http://localhost:3000
npm run test:mobile-smoke             # 终端 B：HTTP + 可选 headless Chromium
```

`test:mobile-smoke` 通过 **不能** 替代下列人工项（层级、overflow、canvas 尺寸等 jsdom/Chromium dump-dom 不可靠）。

---

## A. Portal 与层级（375 + 桌面各验）

| # | 检查项 | 通过标准 | 备注 |
| --- | --- | --- | --- |
| A1 | 顶栏下拉 portal | 打开「访客 ∨ / 用户名 ∨」后，菜单四边完整可见；**不被** 顶栏裁切；滚动时顶栏始终展开 | 375 与 ≥1024 桌面各一次 |
| A2 | 顶栏收起后菜单 | 菜单已打开时向下轻滚使顶栏收起，菜单仍完整可见、可点 | 依赖 portal 到 `body` |
| A3 | FloatPanel 盖在内容之上 | 打开任意 field / panel sheet（如资产明细、消费分析），遮罩与面板盖住下方卡片与图表，不被 section 卡片压住 | 抽查 1 个 field + 1 个 panel |
| A4 | ConfirmDialog 盖在内容之上 | 触发删除确认（支出等），矮卡居中/底卡可见；点遮罩不关，仅取消/确认删除/Esc | 复用 FloatPanel field 矮卡 |

---

## B. 响应式与布局

| # | 检查项 | 通过标准 | 备注 |
| --- | --- | --- | --- |
| B1 | 375 无横向撑破 | DevTools 375×812（或 390×844）：`document.documentElement.scrollWidth <= window.innerWidth + 2` | 见 `first-visit-audit` 历史基准 |
| B2 | 主内容 min-w-0 | 长数字/表格在窄屏内换行或横滑，不出现整页右移 | 重点看支出表、顶栏 chips |
| B3 | 图表区域 | 「资产走势 / 现金流 / 退休」三图 **canvas 宽高均 > 0**（或 Console 无 echarts resize 报错） | 脚本不测 canvas；**人工必验** |

---

## C. 鉴权与导航（保留独立页，勿回滚单页 sheet）

| # | 检查项 | 通过标准 | 备注 |
| --- | --- | --- | --- |
| C1 | 访客直达主界面 | 未登录访问 `/`：见顶栏「访客」、示例条幅、主财务面板可用；**无**全屏登录门禁 | HTTP 冒烟已测文案标记 |
| C2 | 注册独立页 | 点「注册保存」→ URL 为 `/register`（非整页 auth sheet） | |
| C3 | 登录独立页 | 顶栏/菜单「登录」→ `/login` | |
| C4 | 页内互跳 | `/login` ↔ `/register` 可「去注册/去登录」；「继续访客体验」回 `/` | |

---

## D. 移动交互契约（`lib/ux-contract.ts`）

| # | 检查项 | 通过标准 | 备注 |
| --- | --- | --- | --- |
| D1 | 禁止浮层叠浮层 | ≤639px：已开 FloatPanel/sheet 时，**不再**弹出第二个 FloatPanel；二级编辑在父 sheet 内 push 子页（返回/Esc 先 pop） | 契约 §4 |
| D2 | InfoTip 不锁滚动 | 移动点 `?` 为贴锚气泡，点遮罩关闭，页面仍可滚 | 契约 §3 |
| D3 | 键盘 / visualViewport（可选） | 浮层或 `/login`/`/register` 聚焦输入框时，字段落在键盘上方；无白屏 | 见 `mobile-smoke.md` VV 近似步骤；真机 Safari 复核 |

---

## E. 发布前勾选（协调者）

- [ ] `npm test` 全绿
- [ ] `npm run test:mobile-smoke` 通过（dev 已起）
- [ ] A1–A4 portal/层级（375 + 桌面）
- [ ] B1–B3 响应式与图表
- [ ] C1–C4 鉴权独立页
- [ ] D1–D2 移动契约（D3 发版前抽样或真机）

**条目数**：清单表内 **14** 项（A1–A4、B1–B3、C1–C4、D1–D3），加上 E 节 7 条发布勾选。

---

## 刻意不测（与 mobile-smoke 一致）

- 完整注册→认领→登出数据持久化（需账号，手工回归）
- iOS 真实键盘高度 / 安全区 / 橡皮筋
- 「重启网站」真清 Cache 后的网络层
- z-index 数值是否已 Token 化（属流 A，本清单只验视觉结果）
