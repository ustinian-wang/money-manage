# Design Tokens（Tailwind）

> Notion 规范流 B：统一 **规则与 Token**，不统一堆砌所有 class。  
> 原则：**30% 约束 + 70% 自由**。

## 必须统一

| 类别 | 来源 | 用法 |
| --- | --- | --- |
| 品牌色 | `globals.css` `:root --color-*` → Tailwind `ink/paper/mint/coral*`；JS 用 `lib/ui/brandColors.ts` | `text-ink`、`bg-paper`、`text-coral-deep`、`bg-coral/10`；ECharts / `themeColor` 用 `BRAND.*` |
| 面板阴影 | `boxShadow.panel`（引用 `--color-ink`） | `shadow-panel` |
| 浮层层级 | `lib/ui/zIndex.ts` + `theme.extend.zIndex` | 见下节 |

**禁止新增**（存量可渐进替换）：

- 随意 `z-[NN]`、`z-index: 999999`
- 大量 magic 尺寸 `w-[371px]`、`mt-[13px]`
- 新写品牌色裸 hex（`#17212b` / `#f07f62` / `#d9654a` / `#f6f8f5`）；改 token 或 `BRAND`

## 品牌色

| Token / 变量 | Hex | 典型场景 |
| --- | --- | --- |
| `ink` / `--color-ink` | `#17212b` | 正文、主按钮、图表强调线 |
| `ink-hover` | `#2a3644` | 深色按钮 hover |
| `paper` / `--color-paper` | `#f6f8f5` | 页底、输入底 |
| `coral` / `--color-coral` | `#f07f62` | 主强调、CTA、图表主系列 |
| `coral-deep` | `#d9654a` | 链接文案、次强调字色 |
| `coral-hover` | `#df6e51` | 珊瑚按钮 hover |
| `coral-ink` | `#c4533a` | 可编辑字段强调字 |
| `mint` | `#d8f3e4` | 轻点缀 |

CSS 变量存 **RGB 通道**（空格分隔），Tailwind 为 `rgb(var(--color-*) / <alpha-value>)`，支持 `/10` 等透明度。  
`lib/ui/brandColors.ts` 的 `BRAND` / `BRAND_RGB` 须与 `:root` **同源**（改一处同步两处）。

## 允许自由

- Dashboard / 图表 / 卡片排版、信息架构
- 页面级 Flex/Grid 组合（不必抽成 Primitive）
- 已有任意值 class 暂可保留，触达时再改（非品牌色的 slate 轴色等）

## zIndex 语义档

数值定义在 `lib/ui/zIndex.ts`，Tailwind 通过 `theme.extend.zIndex` **镜像同名键**（改一处需同步两处或只改 `zIndex.ts` 后跑测）。

| Token class | 常量 | 典型场景 |
| --- | --- | --- |
| `z-content` | 1 | 正文叠层、图表内局部 |
| `z-header` | 40 | sticky 顶栏 / chips |
| `z-dropdown` | 60 | 下拉、InfoTip、菜单 backdrop |
| `z-drawer` | 70 | 顶栏菜单、InstallToDesktop |
| `z-modal` | 80 | FloatPanel / sheet 默认 |
| `z-toast` | 100 | ConfirmDialog、全局 Toast |

**JS 内联 style**：`import { Z_INDEX } from '@/lib/ui/zIndex'`（或相对路径），勿写裸数字。

**Backdrop 比面板低 1**：`Z_INDEX.dropdownBackdrop`（59）或 FloatPanel 的 `zIndex - 1`。

## 验证

```bash
npm test -- lib/ui/designTokens.test.ts
```
