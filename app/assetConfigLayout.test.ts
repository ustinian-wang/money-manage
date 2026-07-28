/**
 * 资产配置：FloatPanel density=panel 全屏内页；备用金「固定值 | 公式计算」同行；
 * 公式字段铺在内页下方，不再套二级弹窗 / sheet 子页。
 * 需求：资产配置改内页 + 备用金双模式
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

describe('AssetLinkedEditor 内页 + 备用金双模式', () => {
  it('入口 FloatPanel 用 density=panel（移动全屏内页），不用 field 矮卡', () => {
    assert.match(assetSource, /headerTitle=["']资产配置["']/);
    assert.match(assetSource, /density=["']panel["']/);
    assert.doesNotMatch(assetSource, /density=["']field["']/);
  });

  it('备用金走 SelectNumberField：固定值 | 公式计算，无二级应急弹层', () => {
    assert.match(assetSource, /<SelectNumberField/);
    assert.match(assetSource, /option value=["']amount["'][^>]*>固定值/);
    assert.match(assetSource, /option value=["']months["'][^>]*>公式计算/);
    // 不再套 nested FloatPanel / sheet 子页推应急设置
    assert.doesNotMatch(assetSource, /emergencyOpen|setEmergencyOpen|popEmergency/);
    assert.doesNotMatch(assetSource, /data-sheet-subview=["']emergency["']/);
    assert.doesNotMatch(assetSource, /Z_INDEX\.nestedPanel/);
    assert.doesNotMatch(assetSource, /onBack=/);
  });

  it('公式计算时内页下方铺往年支出 / 应急月数（非弹窗）', () => {
    assert.match(assetSource, /往年支出额度/);
    assert.match(assetSource, /应急月数/);
    assert.match(assetSource, /推算现金（备用金）/);
    // 公式块应在 monthsPlan 条件内，与一级主字段同页
    assert.match(assetSource, /monthsPlan[\s\S]*往年支出额度[\s\S]*应急月数/);
  });
});
