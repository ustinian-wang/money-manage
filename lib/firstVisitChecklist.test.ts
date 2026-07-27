/**
 * 首访三步 checklist：步骤定义、完成态读写、是否展示
 * 需求：first-visit-audit P2-6 / 多视角评估 P1
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  FIRST_VISIT_CHECKLIST_STEPS,
  canDismissChecklist,
  isAllStepsComplete,
  loadChecklistDismissed,
  loadCompletedSteps,
  markStepComplete,
  saveChecklistDismissed,
  saveCompletedSteps,
  shouldShowChecklist,
  type ChecklistStorage,
} from './firstVisitChecklist';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function memoryStorage(seed: Record<string, string> = {}): ChecklistStorage & { store: Record<string, string> } {
  const store = { ...seed };
  return {
    store,
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
  };
}

describe('FIRST_VISIT_CHECKLIST_STEPS', () => {
  it('三步：改收入 → 改支出 → 看走势，并映射分区 id', () => {
    assert.equal(FIRST_VISIT_CHECKLIST_STEPS.length, 3);
    assert.deepEqual(
      FIRST_VISIT_CHECKLIST_STEPS.map((s) => [s.id, s.label, s.sectionId]),
      [
        ['income', '改收入', 'sec-params'],
        ['expenses', '改支出', 'sec-expenses'],
        ['charts', '看走势', 'sec-charts'],
      ],
    );
  });
});

describe('完成态读写', () => {
  it('无键时完成列表为空', () => {
    assert.deepEqual(loadCompletedSteps(memoryStorage()), []);
  });

  it('写读往返；非法 JSON / 非数组兜底为空', () => {
    const storage = memoryStorage();
    saveCompletedSteps(['income', 'expenses'], storage);
    assert.deepEqual(loadCompletedSteps(storage), ['income', 'expenses']);

    storage.setItem('money-manage-checklist-done', '{bad');
    assert.deepEqual(loadCompletedSteps(storage), []);

    storage.setItem('money-manage-checklist-done', '"nope"');
    assert.deepEqual(loadCompletedSteps(storage), []);
  });

  it('markStepComplete 幂等追加合法步骤，忽略未知 id', () => {
    assert.deepEqual(markStepComplete([], 'income'), ['income']);
    assert.deepEqual(markStepComplete(['income'], 'income'), ['income']);
    assert.deepEqual(markStepComplete(['income'], 'charts'), ['income', 'charts']);
    assert.deepEqual(markStepComplete(['income'], 'nope' as 'income'), ['income']);
  });

  it('isAllStepsComplete 仅当三步都完成', () => {
    assert.equal(isAllStepsComplete(['income', 'expenses']), false);
    assert.equal(isAllStepsComplete(['income', 'expenses', 'charts']), true);
    assert.equal(isAllStepsComplete(['charts', 'income', 'expenses']), true);
  });
});

describe('收起 flag', () => {
  it('默认未收起；save 后为 true', () => {
    const storage = memoryStorage();
    assert.equal(loadChecklistDismissed(storage), false);
    saveChecklistDismissed(storage);
    assert.equal(loadChecklistDismissed(storage), true);
  });
});

describe('shouldShowChecklist / canDismissChecklist', () => {
  it('未收起则展示（访客与登录均可）', () => {
    assert.equal(shouldShowChecklist({ dismissed: false, isGuest: true }), true);
    assert.equal(shouldShowChecklist({ dismissed: false, isGuest: false }), true);
  });

  it('已收起不展示', () => {
    assert.equal(shouldShowChecklist({ dismissed: true, isGuest: true }), false);
    assert.equal(shouldShowChecklist({ dismissed: true, isGuest: false }), false);
  });

  it('全部完成后才可收起', () => {
    assert.equal(canDismissChecklist(['income', 'expenses']), false);
    assert.equal(canDismissChecklist(['income', 'expenses', 'charts']), true);
  });
});

describe('page 接入', () => {
  it('首页挂载 checklist 并复用 scrollToSection', () => {
    const src = readFileSync(join(root, 'app/page.tsx'), 'utf8');
    assert.match(src, /from ['"]\.\.\/lib\/firstVisitChecklist['"]/);
    assert.match(src, /FIRST_VISIT_CHECKLIST_STEPS/);
    assert.match(src, /shouldShowChecklist/);
    assert.match(src, /markStepComplete/);
    assert.match(src, /saveChecklistDismissed/);
    assert.match(src, /scrollToSection\(step\.sectionId\)/);
  });
});
