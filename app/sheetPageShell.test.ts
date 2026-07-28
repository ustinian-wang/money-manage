/**
 * SheetPageShell：全屏内页/浮层共用外壳（顶栏+滚动+底栏）
 * FloatPanel density=panel/field 必须走此壳，勿在业务里另写标题栏布局
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const shellSrc = fs.readFileSync(path.join(dir, 'components/SheetPageShell.tsx'), 'utf8');
const floatSrc = fs.readFileSync(path.join(dir, 'components/FloatPanel.tsx'), 'utf8');

describe('SheetPageShell 内页外壳契约', () => {
  it('暴露标题/关闭/返回、滚动区、可选底栏；density 分 field/panel', () => {
    assert.match(shellSrc, /export type SheetPageShellProps/);
    assert.match(shellSrc, /onClose: \(\) => void/);
    assert.match(shellSrc, /onBack\?:/);
    assert.match(shellSrc, /footer\?: ReactNode/);
    assert.match(shellSrc, /density\?: 'field' \| 'panel'/);
    assert.match(shellSrc, /data-float-scroll/);
    assert.match(shellSrc, /data-float-footer/);
    assert.match(shellSrc, /from '\.\/PanelHeader'/);
  });

  it('FloatPanel 用 SheetPageShell 渲染内容壳，不内联 PanelHeader+滚动区', () => {
    assert.match(floatSrc, /from '\.\/SheetPageShell'/);
    assert.match(floatSrc, /<SheetPageShell/);
    assert.doesNotMatch(floatSrc, /from '\.\/PanelHeader'/);
    // JSX 标记由壳提供；FloatPanel 可 querySelector 找滚动区
    assert.doesNotMatch(floatSrc, /<div data-float-scroll/);
    assert.doesNotMatch(floatSrc, /<div[^>]*data-float-footer/);
  });
});
