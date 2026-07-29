/**
 * 月结余再投入：与「年化收益率」同 field-row 左右节奏；SelectNumberField 同行；不为切模式/改数值单独开 FloatPanel
 * 需求：移动端去掉仅为该字段的弹窗；复用 switchReinvestMode；全端强制同行
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = fs.readFileSync(path.join(dir, 'page.tsx'), 'utf8');
const selectNumberSrc = fs.readFileSync(path.join(dir, 'components/SelectNumberField.tsx'), 'utf8');

/** 截取 ReinvestEditor 函数体（到下一个顶层 function） */
function reinvestEditorSource(): string {
  const start = pageSource.indexOf('function ReinvestEditor(');
  assert.ok(start >= 0, 'ReinvestEditor 应存在');
  const rest = pageSource.slice(start);
  const nextFn = rest.search(/\nfunction [A-Z]/);
  assert.ok(nextFn > 0, '应能界定 ReinvestEditor 结束');
  return rest.slice(0, nextFn);
}

describe('SelectNumberField 组件契约', () => {
  it('强制 flex-nowrap 同行；select / input 双槽，不 import SoftNumberInput', () => {
    assert.match(selectNumberSrc, /flex-nowrap/);
    assert.match(selectNumberSrc, /select: ReactNode/);
    assert.match(selectNumberSrc, /input: ReactNode/);
    // 注释可提 SoftNumberInput；禁止真实 import/JSX
    assert.doesNotMatch(
      selectNumberSrc,
      /from ['"][^'"]*softNumber|from ['"][^'"]*SoftNumber|<SoftNumberInput\b/i,
    );
  });

  // 数字槽优先可读：flex-1 + min-w；select 可 shrink；双槽 items-center 垂直对齐
  it('input 槽 flex-1 + min-w；select 可 shrink', () => {
    assert.match(selectNumberSrc, /min-w-\[6\.75rem\] flex-1 items-center/);
    assert.match(selectNumberSrc, /flex min-w-0 shrink items-center/);
    assert.doesNotMatch(selectNumberSrc, /shrink-0/);
  });
});

describe('ReinvestEditor 行内编辑', () => {
  it('不为再投入单独挂 FloatPanel', () => {
    const src = reinvestEditorSource();
    assert.doesNotMatch(src, /<FloatPanel/);
    assert.doesNotMatch(src, /\bsetOpen\b|\banchorRef\b/);
  });

  it('与年化收益率同 field-row 左右节奏，不竖排标签+控件', () => {
    const src = reinvestEditorSource();
    // Editable 同款：field-row-mobile + justify-between；左标签右 SelectNumberField
    assert.match(src, /field-row-mobile flex items-center justify-between/);
    assert.match(src, /每月理财投入[\s\S]*?<SelectNumberField/);
    assert.match(src, /w-\[7\.5rem\] shrink-0[\s\S]*?whitespace-nowrap/);
    assert.doesNotMatch(src, /flex-col gap-1\.5/);
  });

  it('走 SelectNumberField：select 切模式 + SoftNumberInput，并走 switchReinvestMode', () => {
    const src = reinvestEditorSource();
    assert.match(pageSource, /from '\.\/components\/SelectNumberField'/);
    assert.match(src, /<SelectNumberField/);
    assert.match(src, /select\s*=\s*\{/);
    assert.match(src, /<select[\s\S]*?value=\{setting\.mode\}/);
    assert.match(src, /option value="percent"/);
    assert.match(src, /option value="amount"/);
    assert.match(src, /switchReinvestMode\(/);
    assert.match(src, /<SoftNumberInput[\s\S]*?suffix="%"/);
    assert.match(src, /<SoftNumberInput[\s\S]*?suffix="\/月"/);
  });

  // 百分比 / 固定金额共用 w-24（以百分比为准）；select 收窄并与 input 微距
  it('再投入 SoftNumberInput 两种模式同宽，select 略限宽', () => {
    const src = reinvestEditorSource();
    const widthMatches = src.match(/field-input !mt-0 w-24/g) ?? [];
    assert.equal(widthMatches.length, 2, '百分比与固定金额应同用 w-24');
    assert.doesNotMatch(src, /min-w-\[7\.5rem\] w-36/);
    assert.match(src, /!w-\[5\.5rem\] max-w-\[5\.5rem\]/);
    assert.match(src, /!gap-1/);
  });
});
