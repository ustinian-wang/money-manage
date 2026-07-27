/**
 * 首访三步规划 checklist：改收入 → 改支出 → 看走势
 * 需求：first-visit-audit P2-6 / 多视角评估 P1
 */

export type ChecklistStepId = 'income' | 'expenses' | 'charts';

export type ChecklistSectionId = 'sec-params' | 'sec-expenses' | 'sec-charts';

export type ChecklistStep = {
  id: ChecklistStepId;
  label: string;
  sectionId: ChecklistSectionId;
};

export const FIRST_VISIT_CHECKLIST_STEPS: readonly ChecklistStep[] = [
  { id: 'income', label: '改收入', sectionId: 'sec-params' },
  { id: 'expenses', label: '改支出', sectionId: 'sec-expenses' },
  { id: 'charts', label: '看走势', sectionId: 'sec-charts' },
];

export const CHECKLIST_DONE_KEY = 'money-manage-checklist-done';
export const CHECKLIST_DISMISS_KEY = 'money-manage-checklist-dismissed';

export type ChecklistStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const STEP_IDS = new Set<string>(FIRST_VISIT_CHECKLIST_STEPS.map((s) => s.id));

function isStepId(value: unknown): value is ChecklistStepId {
  return typeof value === 'string' && STEP_IDS.has(value);
}

/** 解析完成步骤；非法输入 → [] */
export function parseCompletedSteps(raw: unknown): ChecklistStepId[] {
  if (!Array.isArray(raw)) return [];
  const out: ChecklistStepId[] = [];
  for (const item of raw) {
    if (isStepId(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

export function loadCompletedSteps(storage: ChecklistStorage): ChecklistStepId[] {
  try {
    const raw = storage.getItem(CHECKLIST_DONE_KEY);
    if (!raw) return [];
    return parseCompletedSteps(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveCompletedSteps(ids: readonly ChecklistStepId[], storage: ChecklistStorage): void {
  storage.setItem(CHECKLIST_DONE_KEY, JSON.stringify(parseCompletedSteps([...ids])));
}

/** 幂等追加合法步骤 id */
export function markStepComplete(
  completed: readonly ChecklistStepId[],
  id: ChecklistStepId,
): ChecklistStepId[] {
  if (!isStepId(id)) return parseCompletedSteps([...completed]);
  if (completed.includes(id)) return parseCompletedSteps([...completed]);
  return parseCompletedSteps([...completed, id]);
}

export function isAllStepsComplete(completed: readonly ChecklistStepId[]): boolean {
  return FIRST_VISIT_CHECKLIST_STEPS.every((step) => completed.includes(step.id));
}

export function loadChecklistDismissed(storage: ChecklistStorage): boolean {
  return storage.getItem(CHECKLIST_DISMISS_KEY) === '1';
}

export function saveChecklistDismissed(storage: ChecklistStorage): void {
  storage.setItem(CHECKLIST_DISMISS_KEY, '1');
}

/** 未收起则展示；访客与登录均可（产品优先访客首访） */
export function shouldShowChecklist(opts: { dismissed: boolean; isGuest?: boolean }): boolean {
  void opts.isGuest;
  return !opts.dismissed;
}

export function canDismissChecklist(completed: readonly ChecklistStepId[]): boolean {
  return isAllStepsComplete(completed);
}
