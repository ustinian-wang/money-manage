/**
 * 浮层边界夹紧：翻转 / 左右夹紧 / sheet 贴底不溢出
 * 需求：money-manage 浮层出屏避让（visualViewport + margin）
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  calcPanelUsedHeight,
  measurePanelNaturalHeight,
  placeCenteredInViewport,
  placeNearAnchor,
  placeSheetAtBottom,
  viewportBounds,
  ZERO_SAFE,
} from './floatPlace';

describe('floatPlace 视口夹紧', () => {
  const vp = viewportBounds(
    { offsetLeft: 0, offsetTop: 0, width: 390, height: 700 },
    390,
    700,
    10,
    ZERO_SAFE,
  );

  test('底部出界时翻到锚点上方', () => {
    const anchor = { top: 640, left: 200, right: 216, bottom: 656, width: 16, height: 16 };
    const placed = placeNearAnchor(anchor, 256, 120, vp, 8, 'center');
    assert.equal(placed.flipped, true);
    assert.ok(placed.top < anchor.top);
    assert.ok(placed.top >= vp.top);
    assert.ok(placed.left >= vp.left);
    assert.ok(placed.left + 256 <= vp.right);
  });

  test('右侧锚点水平夹紧不溢出', () => {
    const anchor = { top: 100, left: 360, right: 376, bottom: 116, width: 16, height: 16 };
    const placed = placeNearAnchor(anchor, 256, 80, vp, 8, 'center');
    assert.equal(placed.left, vp.right - 256);
    assert.equal(placed.flipped, false);
  });

  test('panel sheet 全宽贴底且 top 不低于视口', () => {
    const sheet = placeSheetAtBottom(400, vp, 0, 390, true);
    assert.equal(sheet.left, 0);
    assert.equal(sheet.width, 390);
    assert.equal(sheet.top, vp.bottom - 400);
  });

  test('键盘抬高 offsetTop 时 viewportBounds 跟随', () => {
    const kb = viewportBounds(
      { offsetLeft: 0, offsetTop: 120, width: 390, height: 400 },
      390,
      700,
      10,
      ZERO_SAFE,
    );
    assert.equal(kb.top, 130);
    assert.equal(kb.bottom, 510);
  });

  test('field 居中后底边出界则上移', () => {
    const kb = viewportBounds(
      { offsetLeft: 0, offsetTop: 200, width: 390, height: 300 },
      390,
      700,
      10,
      ZERO_SAFE,
    );
    const placed = placeCenteredInViewport(280, 200, kb);
    assert.ok(placed.left >= kb.left);
    assert.ok(placed.top + 200 <= kb.bottom);
    assert.ok(placed.top >= kb.top);
  });
});

describe('floatPlace 面板用高', () => {
  test('短内容不拉满视口', () => {
    assert.equal(calcPanelUsedHeight(320, 600), 320);
  });

  test('超长内容卡在上限，供内层滚动', () => {
    assert.equal(calcPanelUsedHeight(1200, 560), 560);
  });

  test('自然高 = chrome + scrollScrollHeight', () => {
    // offset 500、可视滚动区 400 → chrome 100；内容 900 → 自然 1000
    assert.equal(measurePanelNaturalHeight(500, 400, 900), 1000);
  });
});
