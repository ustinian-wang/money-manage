/**
 * 调试快照自动诊断：底缝 / 虚高 / 无浮层 / 内页
 * 供 watch-mm-debug 与单元测试
 */

export type AnalyzeLine = {
  level: 'ok' | 'warn' | 'info';
  text: string;
};

function num(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** 从任意上报 JSON 抽出可读诊断行 */
export function analyzeDebugSnapshot(raw: unknown): AnalyzeLine[] {
  const snap = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  if (!snap) return [{ level: 'warn', text: '上报体不是对象，无法分析' }];

  const lines: AnalyzeLine[] = [];
  const at = typeof snap.at === 'string' ? snap.at : '(no at)';
  const vv = snap.vv && typeof snap.vv === 'object' ? snap.vv as Record<string, unknown> : null;
  const vvH = num(vv?.height);
  const inner = snap.inner && typeof snap.inner === 'object' ? snap.inner as Record<string, unknown> : null;
  const innerH = num(inner?.height);
  const page = snap.page && typeof snap.page === 'object' ? snap.page as Record<string, unknown> : null;
  const sheetOpen = Boolean(page?.sheetOpen) || /\bsheet-open\b/.test(String(snap.bodyClass || ''));

  lines.push({ level: 'info', text: `时间 ${at} · vvH=${vvH ?? '?'} innerH=${innerH ?? '?'} sheetOpen=${sheetOpen}` });

  const floatPanels = Array.isArray(snap.floatPanels) ? snap.floatPanels : [];
  const innerPages = Array.isArray(snap.innerPages) ? snap.innerPages : [];
  const overlays = Array.isArray(snap.overlays) ? snap.overlays : [];

  if (floatPanels.length === 0) {
    lines.push({
      level: 'warn',
      text: 'floatPanels 为空：请先打开全屏/矮卡浮层再「刷新最新」上报（当前可能只有页面或 dbg 面板）',
    });
  }

  for (const [i, panel] of floatPanels.entries()) {
    if (!panel || typeof panel !== 'object') continue;
    const p = panel as Record<string, unknown>;
    const attrs = p.attrs && typeof p.attrs === 'object' ? p.attrs as Record<string, string> : {};
    const ux = attrs['data-ux'] || '';
    const density = attrs['data-density'] || '';
    const rect = p.rect && typeof p.rect === 'object' ? p.rect as Record<string, unknown> : {};
    const computed = p.computed && typeof p.computed === 'object' ? p.computed as Record<string, unknown> : {};
    const gaps = p.gapsVsVv && typeof p.gapsVsVv === 'object' ? p.gapsVsVv as Record<string, unknown> : null;
    const h = num(rect.height);
    const bottomGap = gaps ? num(gaps.bottomGap) : null;
    const covers = gaps ? Boolean(gaps.coversView) : null;
    const top = String(computed.top || '');
    const bottom = String(computed.bottom || '');
    const heightCss = String(computed.height || '');
    const z = String(computed.zIndex || '');

    lines.push({
      level: 'info',
      text: `panel#${i} ux=${ux || '?'} density=${density || '?'} rectH=${h ?? '?'} css(top=${top},bottom=${bottom},height=${heightCss}) z=${z}`,
    });

    if (ux === 'sheet-page' || density === 'panel') {
      if (bottomGap != null && bottomGap > 2) {
        lines.push({
          level: 'warn',
          text: `panel#${i} 底缝 bottomGap=${bottomGap}px（可视区未铺满，易透出背后）`,
        });
      } else if (bottomGap != null && bottomGap < -2) {
        lines.push({
          level: 'warn',
          text: `panel#${i} 虚高 bottomGap=${bottomGap}px（比 VV 高出 ${Math.abs(bottomGap)}px，常见于 100vh）`,
        });
      } else if (covers) {
        lines.push({ level: 'ok', text: `panel#${i} 相对 VV coversView=true，底边对齐正常` });
      } else if (bottomGap != null) {
        lines.push({ level: 'ok', text: `panel#${i} bottomGap=${bottomGap}px（接近贴齐）` });
      }

      if (vvH != null && h != null && Math.abs(h - vvH) <= 2) {
        lines.push({ level: 'ok', text: `panel#${i} rect.height≈vv.height（${h}≈${vvH}）` });
      } else if (vvH != null && h != null) {
        lines.push({
          level: 'info',
          text: `panel#${i} rect.height=${h} vs vv.height=${vvH}（差 ${round1(h - vvH)}）`,
        });
      }
    }

    const children = p.children && typeof p.children === 'object' ? p.children as Record<string, unknown> : null;
    if (children?.scroll && typeof children.scroll === 'object') {
      const s = children.scroll as Record<string, unknown>;
      lines.push({
        level: 'info',
        text: `panel#${i} 内页 scroll rectH=${num(s.height) ?? '?'}`,
      });
    }
    if (Array.isArray(children?.subviews) && children.subviews.length) {
      const names = children.subviews.map((sv) => {
        if (!sv || typeof sv !== 'object') return '?';
        return String((sv as Record<string, unknown>).name || '?');
      });
      lines.push({ level: 'info', text: `panel#${i} 内页 subviews=[${names.join(',')}]` });
    }
  }

  if (innerPages.length) {
    const kinds = innerPages.map((o) => {
      if (!o || typeof o !== 'object') return '?';
      const row = o as Record<string, unknown>;
      const attrs = row.attrs && typeof row.attrs === 'object' ? row.attrs as Record<string, string> : {};
      const kind = String(row.kind || '?');
      const sub = attrs['data-sheet-subview'];
      return sub ? `${kind}:${sub}` : kind;
    });
    lines.push({ level: 'info', text: `innerPages(${innerPages.length}): ${kinds.join(', ')}` });
  }

  const counts = page?.counts && typeof page.counts === 'object' ? page.counts as Record<string, unknown> : null;
  if (counts) {
    lines.push({
      level: 'info',
      text: `counts overlays=${counts.overlays ?? overlays.length} panels=${counts.floatPanels ?? floatPanels.length} subviews=${counts.sheetSubviews ?? '?'} scrolls=${counts.floatScrolls ?? '?'}`,
    });
  }

  if (!lines.some((l) => l.level === 'warn') && floatPanels.length > 0) {
    lines.push({ level: 'ok', text: '未发现明显底缝/虚高告警' });
  }

  return lines;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function formatAnalyzeReport(lines: AnalyzeLine[]): string {
  return lines.map((l) => {
    const tag = l.level === 'ok' ? 'OK' : l.level === 'warn' ? 'WARN' : 'INFO';
    return `[${tag}] ${l.text}`;
  }).join('\n');
}
