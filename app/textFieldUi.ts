/**
 * 单字段文本 UX：点击原地 input，blur/Enter 保存；不弹 FloatPanel。
 * 空值：allowEmpty 时落 ''；否则恢复编辑前原值。
 * 多字段表单 / select / 日期 / 分析面板仍走弹层（不在本模块）。
 */

/** 单字段纯文本一律 inline，不弹层 */
export function usesInlineTextEdit(): boolean {
  return true;
}

/** 空串展示占位（未命名 / 未分类等） */
export function formatTextFieldDisplay(value: string, emptyLabel: string): string {
  return value || emptyLabel;
}

/**
 * blur/Enter 提交：trim；空且不允许空 → 原值；否则落 trim 结果（可为空串）。
 * 文本无额外「非法」校验；空即唯一需恢复的情况。
 */
export function commitTextField(
  draft: string,
  original: string,
  opts: { allowEmpty?: boolean } = {},
): string {
  const allowEmpty = opts.allowEmpty ?? true;
  const next = draft.trim();
  if (next === '' && !allowEmpty) return original;
  return next;
}
