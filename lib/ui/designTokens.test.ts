/**
 * Tailwind design token：zIndex + 品牌色与 lib/ui 同源
 * 需求：Notion 流 B — theme 镜像；品牌色走 CSS 变量
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import config from '../../tailwind.config.ts';
import { BRAND, BRAND_RGB } from './brandColors';
import { Z_INDEX, Z_INDEX_LAYERS } from './zIndex';

describe('designTokens zIndex', () => {
  test('Z_INDEX 八档主阶梯存在且递增', () => {
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

  test('语义别名与主档同值：mask/panel/topbarMenu', () => {
    assert.equal(Z_INDEX.mask, Z_INDEX.dropdownBackdrop);
    assert.equal(Z_INDEX.panel, Z_INDEX.modal);
    assert.equal(Z_INDEX.topbarMenu, Z_INDEX.drawer);
  });
});

describe('designTokens brand colors', () => {
  test('BRAND 核心 hex 稳定', () => {
    assert.equal(BRAND.ink, '#17212b');
    assert.equal(BRAND.paper, '#f6f8f5');
    assert.equal(BRAND.coral, '#f07f62');
    assert.equal(BRAND.coralDeep, '#d9654a');
    assert.equal(BRAND.mint, '#d8f3e4');
  });

  test('globals.css :root 含同名 --color-* 且 RGB 与 BRAND_RGB 一致', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
    for (const [key, rgb] of Object.entries(BRAND_RGB)) {
      const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      const re = new RegExp(`--color-${cssKey}:\\s*${rgb.replace(/ /g, '\\s+')}`);
      assert.match(css, re, `missing or mismatched --color-${cssKey}`);
    }
  });

  test('tailwind colors 引用 CSS 变量', () => {
    const colors = config.theme?.extend?.colors as Record<string, unknown> | undefined;
    assert.ok(colors, 'theme.extend.colors missing');
    const ink = colors.ink as Record<string, string>;
    const coral = colors.coral as Record<string, string>;
    assert.match(String(ink.DEFAULT), /var\(--color-ink\)/);
    assert.match(String(colors.paper), /var\(--color-paper\)/);
    assert.match(String(coral.DEFAULT), /var\(--color-coral\)/);
    assert.match(String(coral.deep), /var\(--color-coral-deep\)/);
    assert.match(String(colors.mint), /var\(--color-mint\)/);
  });
});
