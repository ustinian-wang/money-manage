/**
 * 超支警告 markLine 稀疏：首月重度超支时省略挤在一起的中间档
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  pickCashFlowGuideFlags,
  pickExpenseShareWarnYAxes,
  pickRemainShareWarnYAxes,
} from './shareWarnMarkLines';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('pickExpenseShareWarnYAxes', () => {
  it('未超支或刚过线：只留可支配 100%', () => {
    assert.deepEqual(pickExpenseShareWarnYAxes(80), [100]);
    assert.deepEqual(pickExpenseShareWarnYAxes(100), [100]);
    assert.deepEqual(pickExpenseShareWarnYAxes(105), [100]);
  });

  it('轻度超支逐步加档', () => {
    assert.deepEqual(pickExpenseShareWarnYAxes(112), [100, 110]);
    assert.deepEqual(pickExpenseShareWarnYAxes(130), [100, 110, 120]);
    assert.deepEqual(pickExpenseShareWarnYAxes(160), [100, 110, 120, 150]);
    assert.deepEqual(pickExpenseShareWarnYAxes(200), [100, 110, 120, 150]);
  });

  it('严重超支省略 110/120，极端首月只留 100%', () => {
    assert.deepEqual(pickExpenseShareWarnYAxes(250), [100, 150]);
    assert.deepEqual(pickExpenseShareWarnYAxes(400), [100, 150]);
    assert.deepEqual(pickExpenseShareWarnYAxes(800), [100]);
  });
});

describe('pickRemainShareWarnYAxes', () => {
  it('未打满：满额 + 打满', () => {
    assert.deepEqual(pickRemainShareWarnYAxes(20), [100, 0]);
    assert.deepEqual(pickRemainShareWarnYAxes(0), [100, 0]);
  });

  it('轻度负区保留细档；深度负区省略中间警告', () => {
    assert.deepEqual(pickRemainShareWarnYAxes(-10), [100, 0, -10]);
    assert.deepEqual(pickRemainShareWarnYAxes(-30), [100, 0, -10, -20]);
    assert.deepEqual(pickRemainShareWarnYAxes(-50), [100, 0, -10, -20, -50]);
    assert.deepEqual(pickRemainShareWarnYAxes(-120), [100, 0, -50]);
    assert.deepEqual(pickRemainShareWarnYAxes(-500), [100, 0]);
  });
});

describe('pickCashFlowGuideFlags', () => {
  it('正常区间保留 DTI + 储蓄建议线', () => {
    assert.deepEqual(pickCashFlowGuideFlags({ peakPct: 80, troughPct: 10 }), {
      showDti: true,
      showSavings: true,
    });
  });

  it('偏高/偏负时先省储蓄线；极端超支两条都省', () => {
    assert.deepEqual(pickCashFlowGuideFlags({ peakPct: 160, troughPct: 0 }), {
      showDti: true,
      showSavings: false,
    });
    assert.deepEqual(pickCashFlowGuideFlags({ peakPct: 100, troughPct: -60 }), {
      showDti: true,
      showSavings: false,
    });
    assert.deepEqual(pickCashFlowGuideFlags({ peakPct: 250, troughPct: -20 }), {
      showDti: false,
      showSavings: false,
    });
    assert.deepEqual(pickCashFlowGuideFlags({ peakPct: 120, troughPct: -150 }), {
      showDti: false,
      showSavings: false,
    });
  });
});

describe('page 接入', () => {
  it('首页已去掉三步上手，三张相关图均接入稀疏', () => {
    const src = readFileSync(join(root, 'app/page.tsx'), 'utf8');
    assert.doesNotMatch(src, /firstVisitChecklist|三步上手|FIRST_VISIT_CHECKLIST/);
    assert.match(src, /pickExpenseShareWarnYAxes/);
    assert.match(src, /pickRemainShareWarnYAxes/);
    assert.match(src, /pickCashFlowGuideFlags/);
  });
});
