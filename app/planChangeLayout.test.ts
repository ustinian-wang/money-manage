/**
 * 计划变更入口契约 + 指标搜索 + 图标记映射
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import {
  PLAN_CHANGE_ENTRY,
  PLAN_CHANGE_FIELD_OPTIONS,
  PLAN_CHANGE_PANEL_TITLE,
  PLAN_CHANGE_TIP,
  filterPlanChangeFieldOptions,
  formatPlanChangeListLine,
  planChangeMarkLinesForAssetAxis,
  planChangeMarkLinesForYearMonthAxis,
} from './planChangeLayout';

const pageSource = fs.readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

function sourceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `source marker missing: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `source marker missing: ${endMarker}`);
  return source.slice(start, end);
}

describe('planChangeLayout 入口契约', () => {
  it('文案常量固定', () => {
    assert.equal(PLAN_CHANGE_ENTRY, '计划变更');
    assert.equal(PLAN_CHANGE_PANEL_TITLE, '计划变更');
    assert.match(PLAN_CHANGE_TIP, /从某月起改参数/);
    assert.match(PLAN_CHANGE_TIP, /不改你现在填的数/);
  });

  it('财务参数区块标题旁有计划变更入口与 tip', () => {
    const section = sourceBetween(
      pageSource,
      'id="sec-params"',
      'id="sec-expenses"',
    );
    assert.match(section, /SectionTitle title="财务参数"/);
    assert.match(section, /\{PLAN_CHANGE_ENTRY\}/);
    assert.match(section, /\{PLAN_CHANGE_TIP\}/);
    // 税前旁不做主入口：税前 Editable 行内无计划变更按钮
    assert.doesNotMatch(
      section,
      /Editable label="税前工资"[\s\S]{0,200}PLAN_CHANGE_ENTRY/,
    );
  });

  it('编辑区用可搜索指标选择（combobox），非只读税前', () => {
    assert.match(pageSource, /filterPlanChangeFieldOptions/);
    assert.match(pageSource, /aria-label="搜索指标"/);
    assert.match(pageSource, /planChangeMarkLinesForAssetAxis/);
    assert.match(pageSource, /planChangeMarkLinesForYearMonthAxis/);
  });

  it('计划变更 FloatPanel：scrollResetKey + 显式用高路径', () => {
    assert.match(pageSource, /scrollResetKey=\{view\}/);
    assert.match(pageSource, /calcPanelUsedHeight/);
    assert.match(pageSource, /data-float-footer/);
    assert.match(pageSource, /data-float-scroll/);
  });
});

describe('planChangeLayout 指标搜索与列表文案', () => {
  it('空查询返回全部；中文/英文 key 可过滤', () => {
    assert.equal(filterPlanChangeFieldOptions('').length, PLAN_CHANGE_FIELD_OPTIONS.length);
    assert.deepEqual(
      filterPlanChangeFieldOptions('到手').map((o) => o.value),
      ['takeHomeIncome'],
    );
    assert.deepEqual(
      filterPlanChangeFieldOptions('annual').map((o) => o.value),
      ['annualReturn'],
    );
    assert.equal(filterPlanChangeFieldOptions('不存在的指标').length, 0);
  });

  it('列表行格式：指标 · 时间 · 值', () => {
    assert.equal(
      formatPlanChangeListLine('grossSalary', '2027-07', 20000),
      '税前工资 · 2027-07 · 20,000',
    );
    assert.equal(
      formatPlanChangeListLine('annualReturn', '2028-01', 5.5),
      '理财年化 · 2028-01 · 5.5%',
    );
  });
});

describe('planChangeLayout 图标记', () => {
  it('YearMonth 轴：仅 enabled；多指标可区分', () => {
    const marks = planChangeMarkLinesForYearMonthAxis([
      { enabled: true, field: 'grossSalary', startYearMonth: '2027-07' },
      { enabled: false, field: 'takeHomeIncome', startYearMonth: '2027-08' },
      { enabled: true, field: 'annualReturn', startYearMonth: '2028-01' },
    ]);
    assert.equal(marks.length, 2);
    assert.equal(marks[0].xAxis, '2027-07');
    assert.equal(marks[0].name, '税前');
    assert.equal(marks[1].xAxis, '2028-01');
    assert.equal(marks[1].name, '年化');
    assert.notEqual(marks[0].lineStyle.color, marks[1].lineStyle.color);
  });

  it('资产轴：映到 asset 标签；disabled 不画', () => {
    const base = new Date(2026, 6, 15); // 2026-07
    // month0/1 → 2026-07；month2 → 2026-08；month3 → 2026-09
    const labels = ['现在', '0年1个月', '0年2个月', '0年3个月'];
    const marks = planChangeMarkLinesForAssetAxis(
      [
        { enabled: true, field: 'takeHomeIncome', startYearMonth: '2026-08' },
        { enabled: false, field: 'grossSalary', startYearMonth: '2026-09' },
        { enabled: true, field: 'annualReturn', startYearMonth: '2099-01' },
      ],
      labels,
      base,
    );
    assert.equal(marks.length, 1);
    assert.equal(marks[0].xAxis, '0年2个月');
    assert.equal(marks[0].name, '到手');
  });
});
