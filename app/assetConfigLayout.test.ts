/**
 * 资产配置内页终态：density=panel；总资产 | 备用金两区块；
 * 往年支出独立；应急月数↔备用金额 LinkedNumberFields；表单常显、无二级弹层。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = fs.readFileSync(path.join(dir, 'page.tsx'), 'utf8');

function sourceBetween(src: string, startMarker: string, endMarker?: string): string {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `应找到 ${startMarker}`);
  const rest = src.slice(start);
  if (!endMarker) {
    const nextFn = rest.search(/\nfunction [A-Z]/);
    assert.ok(nextFn > 0, '应能界定函数结束');
    return rest.slice(0, nextFn);
  }
  const end = rest.indexOf(endMarker);
  assert.ok(end > 0, `应找到结束标记 ${endMarker}`);
  return rest.slice(0, end);
}

const assetSource = sourceBetween(pageSource, 'function AssetLinkedEditor({', 'function InstallmentSettingsPanel');

describe('AssetLinkedEditor 内页终态', () => {
  it('入口 FloatPanel density=panel，不用 field 矮卡 / 二级应急弹层', () => {
    assert.match(assetSource, /headerTitle=["']资产配置["']/);
    assert.match(assetSource, /density=["']panel["']/);
    assert.doesNotMatch(assetSource, /density=["']field["']/);
    assert.doesNotMatch(assetSource, /emergencyOpen|setEmergencyOpen|popEmergency/);
    assert.doesNotMatch(assetSource, /data-sheet-subview=["']emergency["']/);
    assert.doesNotMatch(assetSource, /Z_INDEX\.nestedPanel/);
    assert.doesNotMatch(assetSource, /onBack=/);
  });

  it('两区块：总资产 / 备用金；入口摘要含总资产与备用金', () => {
    assert.match(assetSource, /data-asset-section=["']total["']/);
    assert.match(assetSource, /data-asset-section=["']emergency["']/);
    assert.match(assetSource, /<h4[^>]*>[\s\S]*?总资产[\s\S]*?<\/h4>/);
    assert.match(assetSource, /<h4[^>]*>[\s\S]*?备用金[\s\S]*?<\/h4>/);
    assert.match(assetSource, /总资产 \{money\(totalAssets\)\} · 备用金/);
  });

  it('往年支出独立；应急月数↔备用金额走 LinkedNumberFields；模式 select 常显', () => {
    assert.match(assetSource, /option value=["']amount["'][^>]*>填金额/);
    assert.match(assetSource, /option value=["']months["'][^>]*>按月数计算/);
    assert.match(assetSource, /每年大概花费/);
    // 往年支出不进 LinkedNumberFields
    assert.match(
      assetSource,
      /每年大概花费[\s\S]*?<LinkedNumberFields[\s\S]*?alwaysRow[\s\S]*?hint="应急月数 ↔ 备用金额/,
    );
    assert.match(assetSource, /<LinkedNumberFields[\s\S]*?alwaysRow[\s\S]*?hint="应急月数 ↔ 备用金额[\s\S]*?备用月数[\s\S]*?备用金额/);
    // 表单常显：无 monthsPlan && 隐藏整块
    assert.doesNotMatch(assetSource, /\{monthsPlan && \(/);
    assert.doesNotMatch(assetSource, /\{formulaMode && \(/);
    // 不再用 SelectNumberField 切换输入槽
    assert.doesNotMatch(assetSource, /<SelectNumberField/);
  });
});
