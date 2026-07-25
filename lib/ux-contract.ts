/**
 * PC / 移动交互分轨说明
 *
 * PC（popover）
 * - 编辑：锚点旁浮层，点外部关闭，Esc 关闭
 * - 说明：悬停 / focus 气泡，不抢焦点
 * - 大面板（分析）：可居中 + 可拖拽标题栏
 * - 支出：表格
 *
 * 移动（sheet，max-width: 639px）
 * - 编辑 / 说明 / 分析：底部抽屉 + 遮罩 + 手柄 + 标题关闭（headerTitle 带字段名）
 * - 打开时锁 body 滚动
 * - 字段：Settings 式左右 tile（.field-row-mobile）
 * - 支出：卡片（标题+金额 + meta chip），底栏操作
 * - 顶栏+分区 chips 一并吸顶；IntersectionObserver 高亮当前区
 * - 图表：ChartHost 固定高度，可见时 resize
 */
export {};
