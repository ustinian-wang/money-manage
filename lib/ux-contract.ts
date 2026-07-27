/**
 * PC / 移动交互分轨说明（密度分档，不按平台一刀切）
 *
 * 1. 按密度分档 tip / field / panel；仅 panel 默认走移动全套 sheet。
 * 2. ≤2 个控件、无表无图 → 不用全屏感 sheet：居中矮 dialog 或内容贴合底卡；禁止仅为说明文打开 modal sheet。
 * 3. InfoTip：PC 悬停；移动贴锚点气泡（点遮罩/再点 ? 关闭），不锁页面滚动。
 * 4. 移动禁止浮层叠浮层：二级编辑在父 sheet 内 push 子页（返回/Esc 先 pop），不新开 FloatPanel。
 * 5. Sheet 用于需沉浸或纵向滚动的任务：分析图表、多字段分期、明细表、认证；PC 大面板可继续居中+拖拽。
 * 6. 等价联动字段（资产四元组、首付金额↔比例、年数↔期数）用 LinkedFieldGroup 成组 + 中间链标；恒等式不提供解锁。
 *
 * PC（popover）
 * - 编辑：锚点旁浮层；点 mask/外部不关，Esc + 标题关闭等明确入口
 * - 说明：悬停 / focus 气泡，不抢焦点
 * - 大面板（分析）：可居中 + 可拖拽标题栏
 * - 支出：表格
 *
 * 移动（max-width: 639px）
 * - tip：贴锚点气泡，不锁 body（InfoTip 仍可点遮罩关闭，契约 §3）
 * - field：矮底卡 / 内容 hug（无 78vh 抬升），轻量编辑；点 mask 不关
 * - panel：底部抽屉 + 遮罩 + 手柄 + 标题关闭；点 mask 不关；打开时锁 body 滚动
 * - 字段：Settings 式左右 tile（.field-row-mobile）
 * - 支出：卡片（标题+金额 + meta chip），底栏操作
 * - 顶栏吸顶且始终展开；移动分区 chips（参数|支出|走势）+ scroll spy；无滚动收起 chrome
 * - 图表：ChartHost 固定高度，可见时 resize
 */
export {};
