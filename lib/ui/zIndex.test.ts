/**
 * 统一 z-index 层级常量
 * 需求：docs/notion-refactor-spec.md 流 A — Content < Header < Dropdown < Drawer < Modal < Toast
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
