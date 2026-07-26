/**
 * 统一 z-index 层级常量
 * 需求：docs/notion-refactor-spec.md 流 A — Content < Header < Dropdown < Drawer < Modal < Toast
 * 契约：二级面板 > 一级；InfoTip 与顶栏菜单不撞同一档
 *
 * 语义映射（page.tsx 约定，勿散落魔法数）：
 * - InfoTip tip = dropdown；移动 backdrop = dropdownBackdrop
 * - 顶栏更多菜单 = drawer（其 backdrop = dropdown）
 * - FloatPanel 一级默认 = modal；嵌套二级 / ConfirmDialog = toast
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Z_INDEX } from './zIndex';

describe('Z_INDEX 主阶梯', () => {
  it('Content < Header < Dropdown < Drawer < Modal < Toast 严格递增', () => {
    assert.ok(Z_INDEX.content < Z_INDEX.header);
    assert.ok(Z_INDEX.header < Z_INDEX.dropdown);
    assert.ok(Z_INDEX.dropdown < Z_INDEX.drawer);
    assert.ok(Z_INDEX.drawer < Z_INDEX.modal);
    assert.ok(Z_INDEX.modal < Z_INDEX.toast);
  });

  it('Toast 为最高档', () => {
    const tiers = [
      Z_INDEX.content,
      Z_INDEX.header,
      Z_INDEX.dropdown,
      Z_INDEX.drawer,
      Z_INDEX.modal,
      Z_INDEX.toast,
    ];
    assert.equal(Math.max(...tiers), Z_INDEX.toast);
  });
});

/** 相对关系：产品交互契约（比绝对值更不易漂） */
describe('Z_INDEX 相对契约', () => {
  it('二级面板(toast) > 一级面板(modal)', () => {
    assert.ok(Z_INDEX.toast > Z_INDEX.modal);
  });

  it('InfoTip(dropdown) < 顶栏菜单(drawer)，互不抢同一档', () => {
    assert.ok(Z_INDEX.dropdown < Z_INDEX.drawer);
    assert.notEqual(Z_INDEX.dropdown, Z_INDEX.drawer);
  });

  it('InfoTip tip 高于其 backdrop，且低于一级面板', () => {
    assert.ok(Z_INDEX.dropdownBackdrop < Z_INDEX.dropdown);
    assert.ok(Z_INDEX.dropdown < Z_INDEX.modal);
  });

  it('顶栏菜单低于一级面板，打开 FloatPanel 时菜单不压盖面板', () => {
    assert.ok(Z_INDEX.drawer < Z_INDEX.modal);
  });
});

describe('Z_INDEX 现网档位兼容', () => {
  it('sticky 顶栏与 header 档对齐为 40', () => {
    assert.equal(Z_INDEX.header, 40);
  });

  it('Dropdown 遮罩与菜单 backdrop 为 60', () => {
    assert.equal(Z_INDEX.dropdown, 60);
  });

  it('顶栏菜单与 InstallToDesktop 浮层为 drawer 档 70', () => {
    assert.equal(Z_INDEX.drawer, 70);
  });

  it('FloatPanel 默认为 modal 档 80', () => {
    assert.equal(Z_INDEX.modal, 80);
  });

  it('ConfirmDialog 为 toast 档 100', () => {
    assert.equal(Z_INDEX.toast, 100);
  });

  it('InfoTip 移动 backdrop 比 dropdown 低 1（59）', () => {
    assert.equal(Z_INDEX.dropdownBackdrop, 59);
    assert.ok(Z_INDEX.header < Z_INDEX.dropdownBackdrop);
    assert.ok(Z_INDEX.dropdownBackdrop < Z_INDEX.dropdown);
  });
});
