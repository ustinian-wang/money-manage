# money-manage：Notion 规范整改摘要

> 来源：[前端测试与真机兼容：如何从开发阶段减少回归与层级覆盖问题](https://app.notion.com/p/3a953ce58d728145a5d9f3a8f78834c2)  
> 抓取：2026-07-26（cursor-ide-browser，页面公开可读）  
> 约束：**保留** `/login` `/register` 独立页 + `AuthPageShell` + `/auth?mode=` redirect + 顶栏 portal 菜单；**勿**合并回单页鉴权。不 commit（本轮）。

## Notion 要点（中文摘要）

### 结论

Jest/jsdom 只能覆盖业务逻辑与组件行为，**不能**可靠验证真实布局、z-index、overflow、遮挡、响应式。真机兼容问题应优先用**设计规范**降低概率，再用少量真实浏览器检查补洞。

### 为何 Jest 不够

| 适合 Jest | 不适合单靠 Jest |
| --- | --- |
| 渲染 / 点击 / API / Store / 路由 | 弹窗是否盖在最上层 |
| 领域计算、纯函数 | header/footer 遮挡、小屏溢出、overflow 裁剪 |

### 设计侧：降低真机兼容问题

1. **统一层级规范**：禁止业务里随手 `z-index: 999999`；统一定义 Content / Header / Dropdown / Drawer / Modal / Toast 常量。
2. **Overlay 挂到 body**：弹窗/抽屉/Tooltip 用 portal（React：`createPortal`；Notion 文中 Vue Teleport 同理），避免父级 `overflow` / `transform` / stacking context 裁切。
3. **布局优先弹性方案**：Flex / Grid / min-max / gap；少固定高度与大量绝对定位。
4. **设计值抽成 Token**：间距、字号、颜色、圆角、层级。
5. **公共组件只保留一套**：如 Dialog 只保留一套 Base，业务弹窗派生；勿每页自写一套。

### 测试分层

- Jest：逻辑、行为、状态、API（继续）
- 少量真实浏览器：弹窗、抽屉、Toast、Dropdown、图表、响应式
- 视觉回归（可选后续）：截图对比抓 CSS/层级

### 针对 Money Manage 的建议（原文）

- [x] 统一 z-index 常量（`lib/ui/zIndex.ts`）
- [x] 所有弹窗/抽屉使用 portal（已有；常量已对齐）
- [ ] 页面布局尽量 Flex/Grid（存量渐进）
- [x] 保留 Jest 测逻辑
- [x] 发布前跑固定 UI 检查清单（见 `docs/ui-checklist.md`）
- [ ] 页面变多后再补少量真实浏览器回归

### Tailwind Design System（新增）

**核心原则**：统一的是设计规则，不是统一堆砌 class。

分层：

1. Design Token（颜色、字号、间距、圆角、阴影、z-index、动画）
2. UI Primitive（Button、Input、Card、Dialog、Table）
3. Business Component（BudgetCard、BillItem…）
4. Page：只组合，不直接堆大量 Tailwind

最佳实践：

- `tailwind.config` 定义 Token
- 禁止大量 Magic Value（如 `w-[371px]`、`mt-[13px]`）
- 优先 BaseButton / BaseDialog，而非每页重组样式
- 统一响应式断点与布局规则

**30% 约束 + 70% 自由**：

| 必须统一 | 允许自由 |
| --- | --- |
| Design Token、基础组件、交互方式（保存/删除/反馈）、响应式规则 | Dashboard 布局、图表、卡片排版、信息架构、业务流程 |

一句话：Jest 管「代码对不对」；设计规范 + 真实浏览器管「页面看起来对不对」。

---

## 现状对照（整改前快照）

| 项 | 现状 | 缺口 |
| --- | --- | --- |
| 鉴权路由 | `/login` `/register` + `AuthPageShell`；`/auth` redirect；顶栏 portal | **保留，勿回滚** |
| Overlay portal | `FloatPanel` / 顶栏菜单 / InfoTip 已 `createPortal` | z-index 仍散落魔法数（59/60/70/80/100） |
| z-index | `page.tsx` / `globals.css` / `InstallToDesktop` 硬编码 | 无统一常量 / 无单测锁定阶梯 |
| Tailwind Token | 仅 `ink/paper/mint/coral` + `shadow.panel` | 无 zIndex / spacing 语义层；仍有任意值 class |
| 公共 Dialog | `ConfirmDialog` + `FloatPanel` 在 `app/components/` | 已抽出；鉴权页空账号绑定复用 |
| 测试 | 领域 Jest 较全；`tests/mobile-smoke` 人工+轻量脚本 | 已补 `docs/ui-checklist.md` 与冒烟交叉引用；zIndex 单测仍属流 A |
| 领域层 | `domain/*` 已分税/社保/分期等 | 本轮 Notion 不要求大拆，保持即可 |

---

## 并行工作流与文件所有权

| 流 | 主题 | 可写 | **禁止写** | TDD 先写 |
| --- | --- | --- | --- | --- |
| A | z-index Token | `lib/ui/zIndex.ts`、`lib/ui/zIndex.test.ts`；`app/page.tsx` 仅改 zIndex 引用；`app/InstallToDesktop.tsx`；`app/globals.css` 中 sticky/z 相关 | `app/login/**` `app/register/**` `app/auth/**` `AuthPageShell` `authHref*` | 常量阶梯断言失败 → 再改实现 |
| B | Tailwind Token | `tailwind.config.ts`；可选 `docs/design-tokens.md`；`globals.css` 仅 CSS 变量挂钩（避开与 A 同段冲突时先协商） | 鉴权路由；不重构整页 class | token 导出/映射单测（若有）或 checklist 勾选 |
| C | UI 清单 + 冒烟文档 | `docs/ui-checklist.md`；`tests/mobile-smoke.md` 增补 Notion 项 | 鉴权行为语义；不删 `/login` `/register` 步骤 | 清单条目可测则补最小断言 |
| D |（可选）Dialog primitive | 新建 `app/components/ConfirmDialog.tsx` 等并从 page 引用 | 鉴权页；不大拆 FloatPanel 除非测试绿 | 删除确认文案/回调单测已有则复用 |

**共享注意**：`app/page.tsx` 仅允许「导入 zIndex 常量替换字面量」与「import 抽出的 ConfirmDialog」；禁止改鉴权跳转、合并 login/register。

---

## 可勾选任务清单

### A. 层级

- [x] `Z_INDEX`：content < header < dropdown < drawer < modal < toast（数值递增且有测试）
- [x] FloatPanel 默认 / ConfirmDialog / 顶栏菜单 backdrop / InfoTip / InstallToDesktop 全部引用常量
- [x] `globals.css` sticky-chrome 等与 Header 档对齐（`--z-header`）

### B. Overlay / 布局

- [x] FloatPanel 已 portal 到 body（保持）
- [x] 顶栏更多菜单已 portal（保持）
- [ ] 审计无「父级内 fixed 且被 overflow 裁切」的遗漏 overlay
- [ ] 新 UI 优先 Flex/Grid（不强制重写整页）

### C. Design Token

- [x] `tailwind.config` 扩展 `theme.extend.zIndex`（与 `lib/ui/zIndex` 同源镜像）
- [x] 文档说明禁止新增 magic `z-[…]` / 随意 `w-[NNpx]`（见 `docs/design-tokens.md`）
- [x] 不引入新依赖；不统一「所有 class」

### D. 测试与发布清单

- [x] Jest：zIndex 阶梯 + 现有领域测保持绿（stale skip 已清：资产/收益 clamp、场景对比、autosave 已接真实导出）
- [x] `docs/ui-checklist.md`：弹层盖顶、菜单不被裁切、375 无横撑、sheet 键盘近似、图表非 0
- [x] `mobile-smoke.md` 与清单交叉引用；保留登录/注册独立页步骤

### E. 鉴权（只读约束）

- [x] `/login` `/register` 独立页
- [x] `/auth?mode=` redirect
- [x] 顶栏 portal 菜单
- [x] **禁止**改回单页 sheet 鉴权（本轮未回滚）

---

## 执行顺序（协调者）

1. 本文档落盘  
2. 流 A / B / C **并行**（TDD：先失败测试再实现）— **已完成**  
3. 汇总跑 `npm test`；不 deploy；不 commit — **已完成（未 commit）**  
4. 回报：各流结果、测试、剩余风险  
