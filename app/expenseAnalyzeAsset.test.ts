/**
 * 消费影响分析：含资产走势对比图；叠加计划变更
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const page = readFileSync(fileURLToPath(new URL('./page.tsx', import.meta.url)), 'utf8');

function analyzeBlock(): string {
  const analyzeStart = page.indexOf('function ExpenseAnalyzeButton');
  const analyzeEnd = page.indexOf('function ChartHost', analyzeStart);
  assert.ok(analyzeStart >= 0 && analyzeEnd > analyzeStart);
  return page.slice(analyzeStart, analyzeEnd);
}

describe('消费影响分析 · 资产走势对比', () => {
  it('分析面板含资产对比图与 tip', () => {
    assert.match(page, /ANALYZE_ASSET_TIP/);
    assert.match(page, /资产走势对比/);
    assert.match(page, /assetCompareOption/);
    assert.match(page, /消费前 · 最终资产/);
    assert.match(page, /测算后 · 最终资产/);
    const block = analyzeBlock();
    assert.match(block, /ChartHost[^]*assetCompareOption/);
    assert.match(block, /expenseShareOption/);
  });

  it('分析块接收 planChanges，资产/占比用 financeAtPlanMonth 与 markLine', () => {
    const block = analyzeBlock();
    assert.match(block, /planChanges/);
    assert.match(block, /financeAtPlanMonth/);
    assert.match(block, /planChangeMarkLinesForYearMonthAxis/);
    assert.match(block, /planChangeMarkLinesForYearLabelAxis/);
    // 新签名：investRatio 后接 expenses / retirement / planChanges / baseInput
    assert.match(
      block,
      /forecastYearlyTotals\(\s*financeInput\.cash,\s*financeInput\.invest,\s*financeInput\.returnRate,\s*reinvest,\s*ratio,\s*\[\],\s*retirementDate,\s*planChanges/,
    );
    assert.match(
      block,
      /forecastYearlyTotals\(\s*financeInput\.cash,\s*financeInput\.invest,\s*financeInput\.returnRate,\s*reinvest,\s*ratio,\s*selectedExpenses,\s*retirementDate,\s*planChanges/,
    );
    assert.match(page, /planChanges=\{planChanges\}/);
    assert.match(page, /ANALYZE_ASSET_TIP[\s\S]*计划变更/);
    assert.match(page, /ANALYZE_CHART_TIP[\s\S]*计划变更/);
  });
});
