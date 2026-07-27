# 移动端冒烟（390×844）

> **发布前 UI 清单**：完整人工项见 [`docs/ui-checklist.md`](../docs/ui-checklist.md)（portal 层级、375 横撑、图表 canvas、鉴权独立页、移动禁叠浮层等）。本文件负责可重复步骤与轻量脚本；清单负责「看起来对不对」。
>
> **能力边界**：Chromium / Cursor 设备模式 **不能 100% 等价 iOS Safari 键盘**（visualViewport、橡皮筋、`position: fixed` 与键盘顶起均可能不同）。真机仍需 Safari Web Inspector 复核键盘场景。

另有最小 Playwright 访客冒烟：`npm run test:e2e`（见根目录 README「E2E 冒烟」）。本文件仍覆盖更细的移动端人工清单与轻量脚本，分两层：

1. **可重复步骤**（人工 / Cursor Browser，设备模式 390×844）
2. **可选脚本** `npm run test:mobile-smoke`：对已启动的本地服务做 HTTP + 可选 headless Chromium（系统自带，无则跳过交互断言）

## 前置

```bash
cd projects/money-manage
npm run dev   # 默认 http://localhost:3000
```

## 人工 / Cursor Browser 步骤

1. 打开 DevTools → Toggle device toolbar → **iPhone 12/13/14** 或自定义 **390 × 844**
2. 访问 `http://localhost:3000`
3. **访客主界面**：未登录应直接进主应用，见顶栏「访客 ∨」与示例数据条幅；主财务面板可用
4. 顶栏「用户名/访客 + ∨」整块可点（原「更多」）：含安装（若有）、**重启网站**、登录（窄屏）；点「重启网站」应弹出确认（取消则不刷新）
5. **顶栏菜单不被裁切**：打开「访客 ∨」下拉后，菜单四边完整可见（不被顶栏切掉）；上下滚动时顶栏始终展开，菜单仍完整可见；375 与桌面各验一次
6. **鉴权独立页**：点「注册保存」→ `/register`；菜单/顶栏「登录」→ `/login`（非整页 sheet）；页内可「去登录/去注册」互跳；访客可点「继续访客体验」回 `/`
7. 聚焦可编辑字段：页面不应白屏/崩溃
8. （可选）注册 → 刷新仍登录且数据在 → 登出回访客（可留在主页）

## Notion 对齐勾选项（对照 ui-checklist）

与 [`docs/ui-checklist.md`](../docs/ui-checklist.md) 交叉引用；下列 **脚本不测或测不全**，需人工 / Browser：

| 清单节 | 本文件对应步骤 | 脚本覆盖 |
| --- | --- | --- |
| A portal/层级 | 步骤 5（顶栏菜单不被裁切）；抽查 FloatPanel / 删除确认 | 否 |
| B 375 无横撑 | 步骤 1–2 设备 390×844，Console 查 `scrollWidth` | 否 |
| B 图表 canvas | 展开「资产走势」等，目测三图非空白 | 否 |
| C 鉴权独立页 | **步骤 3、6**（保留 `/login` `/register`） | 部分（HTTP 探针 `/login` `/register`） |
| D 禁浮层叠浮层 | 移动打开分析 sheet，二级编辑应在同层展开 | 否 |
| D FloatPanel 点 mask 不关 | 打开任意 sheet/field（工资、分析、删除确认）：点遮罩应仍开着；仅「关闭」/确认取消/Esc | 否 |
| E 发布前 | `npm test` + 本节脚本 | `npm test` 另跑 |

## 脚本怎么跑

```bash
# 终端 A
npm run dev

# 终端 B（BASE_URL 可改）
npm run test:mobile-smoke
```

脚本行为：请求首页 HTTP 200；校验主界面 shell；首页 HTML 或 `app/page` 脚本 chunk 含 `/login`、`/register`；`/login` `/register` 两页 HTTP 可访问；可选 headless dump-dom 含主界面痕迹。**不再**要求全屏门禁文案。层级/ canvas / 横撑见 ui-checklist 人工项。

## 键盘 / visualViewport 焦点（浮层）

Browser 设备模式 **不能 100% 模拟 iOS 键盘**。可用下列方式近似验收：

1. **DevTools 缩小 VV（推荐）**：Console 执行，模拟键盘顶起后再点浮层输入框：
   ```js
   // 模拟可视区变矮（约留上半屏）
   document.documentElement.style.setProperty('--vv-height', '420px');
   document.documentElement.style.setProperty('--vv-offset-top', '0px');
   document.documentElement.classList.add('kb-open');
   // 若页面监听 visualViewport，可在 CDP 里改 metrics；否则依赖 FloatPanel place + scroll 校正
   ```
2. **真机**：iOS Safari → 打开工资/资产 field 浮层或 `/login`/`/register` 表单 → 聚焦输入框；输入框应完整落在键盘上方（约 14px 边距）；浮层内部仍可手指滚动（未设 `touch-action: none`）。
3. **代码路径**：`scrollFocusedFieldIntoView`（延迟 ~280ms）→ `ensureFocusedInVisualViewportNow`（计入 `[data-float-footer]`）；VV `resize`/`scroll` 再校正；`FloatPanel.place` 用 `calcPanelUsedHeight` 写显式 height，内层 `[data-float-scroll]` 可滚到底。

## FloatPanel 高度 / 滚到底（计划变更 · 新增支出）

1. 390×844：打开「计划变更」→「新增」；面板高度应 ≤ 可视区；手指可把内容区滚到「变成多少」等底部字段，不被底栏挡住。
2. 聚焦底部 number 输入：字段应滚入 footer 上方（非整页乱跳）。
3. 「+ 新增支出」同验：长表单可滚到底，保存/取消底栏始终可见。
4. 点遮罩仍不关（仅关闭 / Esc / 底栏按钮）。

## 鉴权页键盘（`/login` · `/register`）

根因曾为 `.auth-gate-root` 叠 `min-h-screen`（100vh 盖住 `--vv-height`）→ `canScroll=false`。验收：

1. 打开 `/register`（或 `/login`），设备模式 390×844
2. Console 执行同上 VV 模拟（`--vv-height: 420px` + `kb-open`）
3. 确认 `.auth-gate-root` 计算高度约为 420（**不是**满屏 100vh）；`scrollHeight > clientHeight` 时方可滚
4. 依次聚焦 **密码 / 确认密码**（注册再滚到认领摘要）；字段应落在矮 VV 内，壳内可手指滚
5. 仍依赖 `AuthBar` 内 `useVisualViewport` + `form onFocusCapture → scrollFocusedFieldIntoView`

## 刻意不测

- 完整注册→认领→图表交互（需账号，属手工回归）
- 「重启网站」真清 Cache 后的网络层行为（确认框存在即可）
- iOS 真实键盘高度 / 安全区
