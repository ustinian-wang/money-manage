/**
 * 列表删除确认文案：说清删什么（名称 + 金额/关键摘要）
 * 需求：删除前确认，避免误操作
 */

export function expenseDeleteMessage(name: string, modeLabel: string, paymentLabel: string) {
  const title = name.trim() || '未命名';
  return `即将删除支出「${title}」\n${modeLabel} · ${paymentLabel}\n取消不删除，确认后移除。`;
}
