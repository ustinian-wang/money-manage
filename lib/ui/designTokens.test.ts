/**
 * Tailwind design token：zIndex theme 与 lib/ui/zIndex 同源
 * 需求：Notion 流 B — theme.extend.zIndex 六档存在且递增
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import config from '../../tailwind.config.ts';
import { Z_INDEX, Z_INDEX_LAYERS } from './zIndex';

describe('designTokens zIndex', () => {
  test('Z_INDEX 主阶梯含 nestedPanel/tip 且递增', () => {
    assert.deepEqual([...Z_INDEX_LAYERS], [
      'content',
      'header',
      'dropdown',
      'drawer',
      'modal',
      'nestedPanel',
      'tip',
      'toast',
    ]);
    for (let i = 1; i < Z_INDEX_LAYERS.length; i++) {
      const cur = Z_INDEX_LAYERS[i];
      const prev = Z_INDEX_LAYERS[i - 1];
      assert.ok(
        Z_INDEX[cur] > Z_INDEX[prev],
        `${cur}(${Z_INDEX[cur]}) should be > ${prev}(${Z_INDEX[prev]})`,
      );
    }
  });

  test('tailwind theme.extend.zIndex 镜像同名档位', () => {
    const themeZ = config.theme?.extend?.zIndex as Record<string, string | number> | undefined;
    assert.ok(themeZ, 'theme.extend.zIndex missing');
    for (const key of Z_INDEX_LAYERS) {
      assert.equal(Number(themeZ[key]), Z_INDEX[key], `tailwind zIndex.${key} mismatch`);
    }
  });
});
