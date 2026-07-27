/**
 * 计划变更：多指标、多时点解析
 * 规则：每指标取 enabled && startYearMonth<=月，升序，同月同指标后者覆盖；指标互不覆盖
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activeFieldOverride,
  activeGrossSalaryOverride,
  createPlanChangeEvent,
  isPlanChangeField,
  parsePlanChanges,
  planChangesToProfile,
  resolveFieldAt,
  resolveGrossSalaryAt,
  yearMonthForAssetMonth,
  yearMonthOffset,
} from './index';

describe('planChange resolveGrossSalaryAt', () => {
  const base = 16667;
  const hike = createPlanChangeEvent({
    id: 'hike',
    field: 'grossSalary',
    startYearMonth: '2026-08',
    value: 20000,
  });

  it('生效前用主卡税前，生效月及之后用事件值；主画像 base 入参不变', () => {
    const events = [hike];
    assert.equal(resolveGrossSalaryAt(base, events, '2026-07'), 16667);
    assert.equal(resolveGrossSalaryAt(base, events, '2026-08'), 20000);
    assert.equal(resolveGrossSalaryAt(base, events, '2027-12'), 20000);
    assert.equal(base, 16667);
    assert.equal(events[0].value, 20000);
  });

  it('disabled 事件不生效', () => {
    const events = [{ ...hike, enabled: false }];
    assert.equal(resolveGrossSalaryAt(base, events, '2026-08'), base);
    assert.equal(activeGrossSalaryOverride(events, '2026-08'), null);
  });

  it('多事件按时间排序；同月数组后者覆盖', () => {
    const events = [
      createPlanChangeEvent({ id: 'a', field: 'grossSalary', startYearMonth: '2026-06', value: 18000 }),
      createPlanChangeEvent({ id: 'b', field: 'grossSalary', startYearMonth: '2026-06', value: 19000 }),
      createPlanChangeEvent({ id: 'c', field: 'grossSalary', startYearMonth: '2026-10', value: 22000 }),
    ];
    assert.equal(resolveGrossSalaryAt(base, events, '2026-05'), base);
    assert.equal(resolveGrossSalaryAt(base, events, '2026-06'), 19000);
    assert.equal(resolveGrossSalaryAt(base, events, '2026-09'), 19000);
    assert.equal(resolveGrossSalaryAt(base, events, '2026-10'), 22000);
  });
});

describe('planChange 同指标两时点 / 两指标并存', () => {
  it('同指标不同 startYearMonth：各自时点后覆盖，更早时点不污染更晚之后', () => {
    const events = [
      createPlanChangeEvent({
        id: 's1',
        field: 'grossSalary',
        startYearMonth: '2026-06',
        value: 18000,
      }),
      createPlanChangeEvent({
        id: 's2',
        field: 'grossSalary',
        startYearMonth: '2027-01',
        value: 25000,
      }),
    ];
    assert.equal(resolveFieldAt(16000, events, 'grossSalary', '2026-05'), 16000);
    assert.equal(resolveFieldAt(16000, events, 'grossSalary', '2026-06'), 18000);
    assert.equal(resolveFieldAt(16000, events, 'grossSalary', '2026-12'), 18000);
    assert.equal(resolveFieldAt(16000, events, 'grossSalary', '2027-01'), 25000);
    assert.equal(resolveFieldAt(16000, events, 'grossSalary', '2028-01'), 25000);
  });

  it('两指标并存：各自覆盖自己的字段，互不影响', () => {
    const events = [
      createPlanChangeEvent({
        id: 'g',
        field: 'grossSalary',
        startYearMonth: '2026-08',
        value: 20000,
      }),
      createPlanChangeEvent({
        id: 't',
        field: 'takeHomeIncome',
        startYearMonth: '2026-08',
        value: 15000,
      }),
      createPlanChangeEvent({
        id: 'r',
        field: 'annualReturn',
        startYearMonth: '2026-10',
        value: 5.5,
      }),
    ];
    assert.equal(activeFieldOverride(events, 'grossSalary', '2026-08'), 20000);
    assert.equal(activeFieldOverride(events, 'takeHomeIncome', '2026-08'), 15000);
    assert.equal(activeFieldOverride(events, 'annualReturn', '2026-08'), null);
    assert.equal(activeFieldOverride(events, 'annualReturn', '2026-10'), 5.5);
    // 税前事件不改到手/年化解析
    assert.equal(resolveFieldAt(9000, events, 'takeHomeIncome', '2026-07'), 9000);
    assert.equal(resolveFieldAt(3.2, events, 'annualReturn', '2026-09'), 3.2);
  });

  it('同月同指标：数组后者覆盖；其它指标不受影响', () => {
    const events = [
      createPlanChangeEvent({ id: 'a1', field: 'takeHomeIncome', startYearMonth: '2026-06', value: 10000 }),
      createPlanChangeEvent({ id: 'a2', field: 'takeHomeIncome', startYearMonth: '2026-06', value: 12000 }),
      createPlanChangeEvent({ id: 'b1', field: 'annualReturn', startYearMonth: '2026-06', value: 4 }),
    ];
    assert.equal(activeFieldOverride(events, 'takeHomeIncome', '2026-06'), 12000);
    assert.equal(activeFieldOverride(events, 'annualReturn', '2026-06'), 4);
  });
});

describe('planChange hydrate/persist', () => {
  it('parsePlanChanges 接受白名单字段；丢弃非法项；planChangesToProfile 可回写', () => {
    const parsed = parsePlanChanges({
      planChanges: [
        { id: 'ok', enabled: true, field: 'grossSalary', startYearMonth: '2026-08', value: 20000 },
        { id: 'th', enabled: true, field: 'takeHomeIncome', startYearMonth: '2026-09', value: 14000 },
        { id: 'ar', enabled: true, field: 'annualReturn', startYearMonth: '2027-01', value: 4.2 },
        { id: 'bad-field', field: 'cash', startYearMonth: '2026-08', value: 1 },
        { id: 'bad-ym', field: 'grossSalary', startYearMonth: '2026-13', value: 1 },
        null,
      ],
    });
    assert.equal(parsed.length, 3);
    assert.equal(parsed[0].field, 'grossSalary');
    assert.equal(parsed[1].field, 'takeHomeIncome');
    assert.equal(parsed[2].field, 'annualReturn');
    assert.equal(parsed[2].value, 4.2);
    const profile = planChangesToProfile(parsed);
    assert.deepEqual(profile.planChanges.map((e) => e.field), [
      'grossSalary',
      'takeHomeIncome',
      'annualReturn',
    ]);
  });

  it('isPlanChangeField 仅白名单', () => {
    assert.equal(isPlanChangeField('grossSalary'), true);
    assert.equal(isPlanChangeField('takeHomeIncome'), true);
    assert.equal(isPlanChangeField('annualReturn'), true);
    assert.equal(isPlanChangeField('cash'), false);
  });
});

describe('planChange yearMonth helpers', () => {
  it('yearMonthOffset / asset month 映射稳定', () => {
    const base = new Date(2026, 6, 15); // 2026-07
    assert.equal(yearMonthOffset(0, base), '2026-07');
    assert.equal(yearMonthOffset(1, base), '2026-08');
    assert.equal(yearMonthForAssetMonth(0, base), '2026-07');
    assert.equal(yearMonthForAssetMonth(1, base), '2026-07');
    assert.equal(yearMonthForAssetMonth(2, base), '2026-08');
  });
});
