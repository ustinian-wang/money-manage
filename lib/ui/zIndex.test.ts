/**
 * 统一 z-index 层级常量
 * 需求：docs/notion-refactor-spec.md 流 A
 * Notion 主阶梯：Content < Header < Dropdown < Drawer < Modal < Toast
 * 扩展：nestedPanel（二级面板）/ tip（InfoTip）— 禁止业务散落魔法数
 *
 * 语义映射（page.tsx 约定）：
 * - mask = dropdownBackdrop；panel = modal；topbarMenu = drawer
 * - InfoTip = tip（不低于锚点层 → tip >= nestedPanel）
 * - FloatPanel 一级 = panel；嵌套二级 = nestedPanel；Confirm = toast
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Z_INDEX, Z_INDEX_LAYERS } from './zIndex';

describe('Z_INDEX 主阶梯', () => {
  it('Content < Header < Dropdown < Drawer < Modal < nestedPanel < tip < Toast 严格递增', () => {
    assert.ok(Z_INDEX.content < Z_INDEX.header);
    assert.ok(Z_INDEX.header < Z_INDEX.dropdown);
    assert.ok(Z_INDEX.dropdown < Z_INDEX.drawer);
    assert.ok(Z_INDEX.drawer < Z_INDEX.modal);
    assert.ok(Z_INDEX.modal < Z_INDEX.nestedPanel);
    assert.ok(Z_INDEX.nestedPanel < Z_INDEX.tip);
    assert.ok(Z_INDEX.tip < Z_INDEX.toast);
  });

  it('Z_INDEX_LAYERS 与主阶梯键序一致且 Toast 最高', () => {
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
    const values = Z_INDEX_LAYERS.map((k) => Z_INDEX[k]);
    assert.equal(Math.max(...values), Z_INDEX.toast);
  });
});

/** 相对关系：产品交互契约（比绝对值更不易漂） */
describe('Z_INDEX 相对契约', () => {
  it('nestedPanel > panel（二级 FloatPanel 高于一级）', () => {
    assert.ok(Z_INDEX.nestedPanel > Z_INDEX.panel);
    assert.equal(Z_INDEX.panel, Z_INDEX.modal);
  });

  it('tip >= nestedPanel（InfoTip 不低于锚点所在层）', () => {
    assert.ok(Z_INDEX.tip >= Z_INDEX.nestedPanel);
    assert.ok(Z_INDEX.tip > Z_INDEX.panel);
  });

  it('tip > tipBackdrop（mask），且 tipBackdrop >= nestedPanel', () => {
    assert.ok(Z_INDEX.tipBackdrop < Z_INDEX.tip);
    assert.ok(Z_INDEX.tipBackdrop >= Z_INDEX.nestedPanel);
  });

  it('topbarMenu > dropdown 且 < panel（菜单高于内容、不压盖一级面板）', () => {
    assert.ok(Z_INDEX.topbarMenu > Z_INDEX.dropdown);
    assert.ok(Z_INDEX.topbarMenu < Z_INDEX.panel);
    assert.equal(Z_INDEX.topbarMenu, Z_INDEX.drawer);
  });

  it('toast > tip（Confirm / 全局反馈盖过说明气泡）', () => {
    assert.ok(Z_INDEX.toast > Z_INDEX.tip);
  });

  it('mask < dropdown（dropdown 档遮罩）', () => {
    assert.equal(Z_INDEX.mask, Z_INDEX.dropdownBackdrop);
    assert.ok(Z_INDEX.mask < Z_INDEX.dropdown);
    assert.ok(Z_INDEX.header < Z_INDEX.mask);
  });
});

describe('Z_INDEX 现网档位兼容', () => {
  it('sticky 顶栏与 header 档对齐为 40', () => {
    assert.equal(Z_INDEX.header, 40);
  });

  it('Dropdown 为 60', () => {
    assert.equal(Z_INDEX.dropdown, 60);
  });

  it('顶栏菜单 drawer / topbarMenu 为 70', () => {
    assert.equal(Z_INDEX.drawer, 70);
    assert.equal(Z_INDEX.topbarMenu, 70);
  });

  it('FloatPanel 一级 panel / modal 为 80', () => {
    assert.equal(Z_INDEX.modal, 80);
    assert.equal(Z_INDEX.panel, 80);
  });

  it('二级 nestedPanel 为 90', () => {
    assert.equal(Z_INDEX.nestedPanel, 90);
  });

  it('InfoTip tip 为 95，tipBackdrop 为 94', () => {
    assert.equal(Z_INDEX.tip, 95);
    assert.equal(Z_INDEX.tipBackdrop, 94);
  });

  it('ConfirmDialog toast 为 100', () => {
    assert.equal(Z_INDEX.toast, 100);
  });

  it('dropdown 档 mask / dropdownBackdrop 为 59', () => {
    assert.equal(Z_INDEX.dropdownBackdrop, 59);
    assert.equal(Z_INDEX.mask, 59);
  });
});
