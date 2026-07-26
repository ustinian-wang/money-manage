# 表单控件统一方案（Notion 对齐）

> 依据：`docs/notion-refactor-spec.md`（公共组件一套、Token、portal / z-index）  
> 约束：**先评估与小范围设计，默认不大重构**；鉴权页 VV / `min-h` 并行修复中，**勿争改 `AuthBar.tsx` 大段**。  
> 不 commit（本轮）。

---

## 1. 要不要统一？统一到什么粒度？

### 结论

**要统一，但只统一「壳 + Token + 交互契约」，不统一成一个万能 Input/Select。**

对齐 Notion「30% 约束 + 70% 自由」与「公共组件只保留一套」：统一的是**设计规则与少数 Primitive**，不是把所有 `<input>` / `<select>` 堆进一个巨组件。

### 现状（四类并存，职责不同）

| 形态 | 位置 | 职责 | 是否该合并 |
| --- | --- | --- | --- |
| `Editable` / `DateEditable` / `SelectEditable` / `ClickField` | `app/page.tsx` | 行内展示 + 点开 `FloatPanel`（portal）编辑 | **保持模式**；可抽共享壳，勿改业务语义 |
| `SoftNumberInput` | `page.tsx` + `app/softNumber.ts` | 受控数字：空串可删、live/commit、clamp | **已是逻辑 Primitive**；UI 只复用 `field-input` |
| native `<select>` + `field-input` | 城市快捷、收入方式、支出 mode、还款方式等 | 紧凑内联、系统控件、无自定义浮层 | **保留**；勿强行换成 portal 下拉 |
| Auth 表单 | `AuthBar` `variant=page` | 文本/密码 + 认领 radio；键盘与 VV 敏感 | **样式跟 Token**；本轮**不迁组件、不碰布局** |

### 粒度建议（三层，禁止跳级）

```
Token / CSS（已有）
  └─ Field 壳 FormField（label + hint + 间距；本轮可只定 API）
       ├─ SoftNumberInput（数字契约，已有）
       ├─ NativeSelect（薄包装：class + aria，仍是 <select>）
       └─ SheetField*（Editable / SelectEditable / DateEditable / ClickField）
            └─ 一律经 FloatPanel → portal + Z_INDEX.modal
```

| 粒度 | 做不做 | 说明 |
| --- | --- | --- |
| **FormField 壳** | ✅ 建议统一目标 | `label` 文案区 + `children` + 可选 `hint`；默认 `block text-xs text-slate-500` + 子控件 `field-input mt-1` |
| **SoftNumberInput** | ✅ 已统一逻辑 | 百分比 / 金额 / 基数共用；禁止再抄一套 draft 状态机 |
| **NativeSelect** | ⚪ 薄包装即可 | 不引入 headless UI；城市 / 收入方式保持 native |
| **自定义 Dropdown** | ❌ 本阶段不做 | 已有 `SelectEditable` + FloatPanel；再造一套会撞 z-index / 键盘 |
| **万能 Input** | ❌ 不做 | Auth（password/autocomplete）与财务数字契约冲突，硬揉必回归 |

一句话：**统一 Field 壳与 class Token；Select 分「内联 native」与「行内 sheet」两轨；数字只走 SoftNumber。**

---

## 2. 与 Token、z-index、portal 的关系

### Design Token（样式）

- 控件外观以 `globals.css` 的 `.field-input` / `.field` / `.field-click` 为**唯一皮肤源**（见 `docs/design-tokens.md`）。
- 禁止业务里再写第二套「灰底圆角输入」任意值；触达时改回 `field-input`。
- 颜色继续用 ink / paper / coral；焦点环已在 `.field-input:focus`。

### z-index（层级）

| 场景 | 层级 | 说明 |
| --- | --- | --- |
| 页面内联 input / native select | `content`（无需抬层） | 不参与 overlay 阶梯 |
| `Editable` / `SelectEditable` / `ClickField` 浮层 | `Z_INDEX.modal`（FloatPanel 已对齐） | 禁止业务写 `z-[999]` |
| 顶栏菜单 / InfoTip | `dropdown` / `drawer` | 表单浮层勿压过 toast；确认框走 modal/toast 既有约定 |
| Auth 表单卡片 | 布局内 `relative z-10` 即可 | **不是**全局 overlay；勿改成 portal 表单 |

常量：`lib/ui/zIndex.ts`。表单统一**不新增** z 档。

### portal

- **必须 portal**：一切「点开展开」的编辑层 → 现有 `FloatPanel`（`createPortal`），避免父级 `overflow` / sticky 裁切（Notion 原文）。
- **禁止 portal**：鉴权页整表、城市快捷 select、表格内紧凑 select——系统控件在文档流内更稳（iOS 滚轮、键盘）。
- **嵌套禁忌**：父 `FloatPanel` 内再开一层 field 浮层易叠层错乱；支出分析已用「同层折叠」规避——新控件沿用。

### 测试分层（Notion）

| 层 | 测什么 |
| --- | --- |
| Jest | `softNumber*`、城市 resolve、FormField 渲染（若 POC）、Select 选项 onChange |
| 真机 / `docs/ui-checklist.md` | sheet 不被裁切、375 无横撑、键盘顶起（Auth）、native select 可点 |

---

## 3. 建议组件清单与迁移顺序

### 组件清单（目标态，可渐进）

| 名称 | 路径（建议） | 职责 | 本轮 |
| --- | --- | --- | --- |
| **FormField** | `app/components/FormField.tsx` | label / hint / 间距壳 | 仅文档定 API；POC 可选且避开 Auth |
| **SoftNumberInput** | 仍可留在 `page.tsx`，逻辑在 `softNumber.ts` | 数字输入契约 | 保持；抽文件可后置 |
| **NativeSelect** | 可选 `app/components/NativeSelect.tsx` | `field-input` + options + `aria-label` | 低优先级薄包 |
| **SheetNumberField** | 即现 `Editable` | 行内数字 + FloatPanel | 不改行为 |
| **SheetSelectField** | 即现 `SelectEditable` | 行内选项 + FloatPanel 内 native select | 不改行为 |
| **SheetDateField** | 即现 `DateEditable` | 行内日期 | 不改行为 |
| **ClickField** | 已有 | 通用 sheet 容器 | 保持为 sheet 基元 |
| Auth 字段 | 仍在 `AuthBar` | password / autocomplete / claim | **并行 VV 完成前只读** |

### 迁移顺序（由稳到险）

1. **文档与约定落地**（本文件）— 勾选「新代码优先 FormField API / field-input / SoftNumber」。
2. **城市快捷 / 收入方式 select** — 仅统一 class 与 `aria-label`；逻辑仍调 `resolveCitySocialBase`；可选套 `NativeSelect` 薄包，**不**改成 portal。
3. **百分比 / 金额 SoftNumber** — 支出比例、首付比例、闲钱投资、公积金比例等：确认都走 `SoftNumberInput` + min/max；禁止裸 `<input type="number">` 新代码。
4. **Sheet 系（Editable / SelectEditable）** — 仅在触达重构 `page.tsx` 时抽出文件；行为单测锁「打开 → 改 → save 事件」。
5. **鉴权页** — **最后**；等 VV / `min-h` 修复合并后再考虑 `FormField` 换皮，且**禁止**改 portal / 路由 / claim 语义。

### 明确不做（YAGNI）

- 引入组件库或 headless Select。
- 把城市快捷做成 `SelectEditable`（多一次点击，移动端更差）。
- 合并 login/register 或动 `AuthPageShell` 路由。
- 为「统一」重写 `page.tsx` 表单区。

---

## 4. POC 决策与执行清单

### POC 评估

| 选项 | TDD 成本 | 现网风险 | 与并行 VV | 结论 |
| --- | --- | --- | --- | --- |
| 抽 `FormField` 并改 Auth 表单 | 低 | 中（VV/键盘） | **冲突** | ❌ 不做 |
| 抽 `FormField` 并大面积替换 page | 中高 | 高 | 抢 `page.tsx` | ❌ 不做 |
| 仅新建 `FormField` + 单测、无调用方 | 低 | 无 | 无 | ⚪ 价值低（死代码） |
| **只落本文档 + checklist 交叉引用** | 极低 | 无 | 无 | ✅ **默认采纳** |

**本轮：不出代码 POC。** 待 Auth VV 合并后，若要用 FormField，优先在**一个**无 VV 依赖的内联 label（如支出编辑里「名称」）试换，再扩。

### FormField 目标 API（供下轮照抄，非本轮实现）

```tsx
// 目标形态（未落地）；children 自行带 SoftNumberInput / NativeSelect / input
type FormFieldProps = {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
};
// <FormField label="账号">{children}</FormField>
// 子控件默认 className="field-input mt-1"
```

### 执行清单

1. [x] 对照 Notion：确认统一粒度 = Field 壳 + Token，非万能 Select  
2. [x] 盘点 Editable / SoftNumber / 城市 select / Auth / SelectEditable  
3. [x] 写明 portal / z-index 边界（sheet 必须 portal；native / Auth 禁止乱抬层）  
4. [x] 排迁移顺序：文档 → 城市/收入 native → SoftNumber 审计 → Sheet 抽离 → Auth 最后  
5. [x] POC：本轮跳过（避 AuthBar VV；避免无调用方死代码）  
6. [ ] （下轮）Auth VV 合入后，可选：`FormField` + 1 个 Jest + 1 处非 Auth 试换  
7. [ ] （下轮）审计 `page.tsx` 内裸 `type="number"`，能并则并到 `SoftNumberInput`  
8. [ ] 发布前：`ui-checklist` 勾选 sheet / 375 / Auth 键盘项  

### 与并行流协调

| 流 | 文件 | 本方案 |
| --- | --- | --- |
| Auth VV / min-h | `AuthBar.tsx`、相关 CSS | **只读**；表单迁移排其后 |
| z-index / Token | `lib/ui/zIndex.ts`、`design-tokens.md` | 复用，不新增档 |
| 本方案 | **仅** `docs/form-controls.md` | 可写 |

---

## 5. 下一步（可直接开下一轮）

说「进入执行：FormField POC」时建议最小集：

1. 新建 `app/components/FormField.tsx` + `FormField.test.tsx`（断言 label / hint / children）。  
2. 在 `page.tsx` **一处**非 Auth、非 VV 的 `label.block.text-xs` 试换（如支出编辑「名称」）。  
3. 跑 `npm test`；人工点一次该字段 + 城市 select + 任意 SoftNumber。  
4. **仍不改** `AuthBar`，直至 VV 修复稳定。
