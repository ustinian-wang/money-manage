/**
 * 调试快照自动诊断
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { analyzeDebugSnapshot, formatAnalyzeReport } from './analyzeDebugSnapshot';

describe('analyzeDebugSnapshot', () => {
  test('无 floatPanels → warn', () => {
    const lines = analyzeDebugSnapshot({
      at: '2026-07-29T12:00:00.000Z',
      vv: { height: 714 },
      inner: { height: 714 },
      bodyClass: '',
      floatPanels: [],
      overlays: [],
    });
    assert.ok(lines.some((l) => l.level === 'warn' && /floatPanels 为空/.test(l.text)));
  });

  test('sheet-page 底缝 → warn', () => {
    const lines = analyzeDebugSnapshot({
      at: '2026-07-29T12:00:00.000Z',
      vv: { height: 714 },
      inner: { height: 714 },
      bodyClass: 'sheet-open',
      page: { sheetOpen: true },
      floatPanels: [{
        attrs: { 'data-ux': 'sheet-page', 'data-density': 'panel' },
        rect: { height: 680, bottom: 680 },
        computed: { top: '0px', bottom: '0px', height: 'auto', zIndex: '80' },
        gapsVsVv: { bottomGap: 34, coversView: false },
      }],
    });
    assert.ok(lines.some((l) => l.level === 'warn' && /底缝/.test(l.text)));
    assert.match(formatAnalyzeReport(lines), /\[WARN\]/);
  });

  test('贴齐 → ok', () => {
    const lines = analyzeDebugSnapshot({
      at: '2026-07-29T12:00:00.000Z',
      vv: { height: 714 },
      inner: { height: 714 },
      bodyClass: 'sheet-open',
      floatPanels: [{
        attrs: { 'data-ux': 'sheet-page', 'data-density': 'panel' },
        rect: { height: 714, bottom: 714 },
        computed: { top: '0px', bottom: '0px', height: 'auto', zIndex: '80' },
        gapsVsVv: { bottomGap: 0, coversView: true },
        children: { scroll: { height: 600 }, subviews: [{ name: 'tax' }] },
      }],
      innerPages: [{ kind: 'sheet-subview', attrs: { 'data-sheet-subview': 'tax' } }],
    });
    assert.ok(lines.some((l) => l.level === 'ok' && /coversView/.test(l.text)));
    assert.ok(lines.some((l) => /subviews=\[tax\]/.test(l.text)));
  });
});
