/**
 * LinkedNumberFields 契约；支出列表只读、无分类 UI；当前月付非吸顶
 * 需求：关联数字抽组件；列表走编辑按钮；item 仅名称+类型
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const compSrc = fs.readFileSync(path.join(dir, 'components/LinkedNumberFields.tsx'), 'utf8');
const pageSrc = fs.readFileSync(path.join(dir, 'page.tsx'), 'utf8');
const cssSrc = fs.readFileSync(path.join(dir, 'globals.css'), 'utf8');

function expenseSection(): string {
  const start = pageSrc.indexOf('id="sec-expenses"');
  const end = pageSrc.indexOf('<div className="mt-4"><ExpenseAddButton');
  assert.ok(start >= 0 && end > start, 'sec-expenses 边界');
  return pageSrc.slice(start, end);
}

function expenseSettingsFields(): string {
  const start = pageSrc.indexOf('function ExpenseSettingsFields');
  const end = pageSrc.indexOf('function ExpenseEditButton', start);
  assert.ok(start >= 0 && end > start, 'ExpenseSettingsFields 边界');
  return pageSrc.slice(start, end);
}

describe('LinkedNumberFields 组件契约', () => {
  it('默认窄屏竖排、sm+ 横排；alwaysRow 强制一行', () => {
    assert.match(compSrc, /flex flex-col gap-2 sm:flex-row/);
    assert.match(compSrc, /alwaysRow \? 'flex flex-row/);
    assert.match(compSrc, /aria-label="联动"/);
  });

  it('children 双槽位，不 import SoftNumberInput（调用方传入）', () => {
    assert.match(compSrc, /children: \[ReactNode, ReactNode\]/);
    // 注释可提 SoftNumberInput；禁止真实 import/JSX
    assert.doesNotMatch(compSrc, /from ['"][^'"]*softNumber|from ['"][^'"]*SoftNumber|<SoftNumberInput\b/i);
  });
});

describe('支出管理：无分类 + 只读列表 + 月付文档流 + LinkedNumberFields', () => {
  it('page 引入 LinkedNumberFields，分期/资产联动对走该组件', () => {
    assert.match(pageSrc, /from '\.\/components\/LinkedNumberFields'/);
    assert.match(pageSrc, /<LinkedNumberFields[\s\S]*?首付金额/);
    assert.match(pageSrc, /<LinkedNumberFields[\s\S]*?年数/);
    assert.match(pageSrc, /<LinkedNumberFields[\s\S]*?alwaysRow[\s\S]*?理财资产/);
    assert.doesNotMatch(pageSrc, /function LinkedFieldGroup\b/);
  });

  it('支出列表无分类列/文案、无 TextEditable，保留编辑按钮', () => {
    const sec = expenseSection();
    assert.doesNotMatch(sec, /TextEditable/);
    assert.doesNotMatch(sec, /<th>分类<\/th>/);
    assert.doesNotMatch(sec, /expense\.category/);
    assert.doesNotMatch(sec, /未分类|分类/);
    assert.match(sec, /formatTextFieldDisplay\(expense\.name/);
    assert.match(sec, /ExpenseEditButton/);
    assert.match(sec, /名称、类型、金额等一律点「编辑」/);
  });

  it('编辑表单无分类输入；新增 category 默认可为空串', () => {
    const form = expenseSettingsFields();
    assert.doesNotMatch(form, /分类/);
    assert.doesNotMatch(form, /value\.category/);
    assert.match(pageSrc, /category: '',\s*mode: 'fixed'/);
    assert.match(pageSrc, /名称、类型、金额、分期等在此修改/);
  });

  it('当前月付 settings-summary 取消 sticky/fixed', () => {
    assert.match(cssSrc, /当前月付：普通文档流/);
    assert.doesNotMatch(
      cssSrc,
      /\.expense-settings-form\s+\.settings-summary\s*\{[^}]*position:\s*(sticky|fixed)/,
    );
  });
});
