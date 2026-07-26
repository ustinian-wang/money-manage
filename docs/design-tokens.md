# Design Tokens（Tailwind）

> Notion 规范流 B：统一 **规则与 Token**，不统一堆砌所有 class。  
> 原则：**30% 约束 + 70% 自由**。

## 必须统一

| 类别 | 来源 | 用法 |
| --- | --- | --- |
| 品牌色 | `tailwind.config` → `colors.ink/paper/mint/coral` | `text-ink`、`bg-paper` 等 |
| 面板阴影 | `boxShadow.panel` | `shadow-panel` |
| 浮层层级 | `lib/ui/zIndex.ts` + `theme.extend.zIndex` | 见下节 |

**禁止新增**（存量可渐进替换）：

- 随意 `z-[NN]`、`z-index: 999999`
- 大量 magic 尺寸 `w-[371px]`、`mt-[13px]`

## 允许自由

- Dashboard / 图表 / 卡片排版、信息架构
- 页面级 Flex/Grid 组合（不必抽成 Primitive）
- 已有任意值 class 暂可保留，触达时再改

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
