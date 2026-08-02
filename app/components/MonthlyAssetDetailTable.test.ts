/**
 * 月度资产明细：打开时分帧挂载，勿一次 map 全量 360 行进 FloatPanel
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, 'MonthlyAssetDetailTable.tsx'), 'utf8');
const pageSrc = fs.readFileSync(path.join(dir, '../page.tsx'), 'utf8');

describe('MonthlyAssetDetailTable 打开性能契约', () => {
  it('首屏分帧：startTransition + rAF，INITIAL 远小于 360', () => {
    assert.match(src, /export const ASSET_DETAIL_INITIAL_ROWS = (\d+)/);
    const initial = Number(src.match(/ASSET_DETAIL_INITIAL_ROWS = (\d+)/)?.[1]);
    assert.ok(initial > 0 && initial < 120, `INITIAL=${initial}`);
    assert.match(src, /startTransition/);
    assert.match(src, /requestAnimationFrame/);
  });

  it('page 用 AssetDetailsEntry；打开态不下沉到 page 根 state', () => {
    assert.match(pageSrc, /AssetDetailsEntry/);
    assert.doesNotMatch(pageSrc, /showAssetDetails/);
    assert.doesNotMatch(
      pageSrc,
      /headerTitle="月度资产明细"[\s\S]{0,800}?monthlyAssetForecast\.map/,
    );
  });

  it('AssetDetailsEntry 自持 open，避免牵动整页重渲', () => {
    assert.match(src, /export function AssetDetailsEntry/);
    assert.match(src, /useState\(false\)/);
    assert.match(src, /headerTitle="月度资产明细"/);
  });
});
