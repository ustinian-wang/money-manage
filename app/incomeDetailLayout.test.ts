/**
 * detail 收入主区契约：税前 / 五险一金和个税 / 到手收入；明细进合并面板
 * 退休与社保：一级入口行 → 移动同 sheet 子页 / PC 二级 FloatPanel，不回流主财务参数卡
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import {
  INCOME_DETAIL_DEDUCTION_PANEL_TITLE,
  INCOME_DETAIL_MAIN_LABELS,
  INCOME_DETAIL_PANEL_ITEMS,
  INCOME_DETAIL_SOCIAL_SETTINGS_ENTRY,
  INCOME_DETAIL_SOCIAL_SETTINGS_PANEL_TITLE,
  INCOME_DETAIL_TAX_DETAIL_ENTRY,
  INCOME_DETAIL_TAX_DETAIL_PANEL_TITLE,
  isIncomeDetailMainOnlyLabel,
} from './incomeDetailLayout';
import { acquireSheetBodyLock, blockOverlayEvent } from '../lib/ui/overlayEvents';

const pageSource = fs.readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const floatPanelModuleSource = fs.readFileSync(new URL('./components/FloatPanel.tsx', import.meta.url), 'utf8');

function sourceBetween(source: string, startMarker: string, endMarker?: string): string {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `source marker missing: ${startMarker}`);
  if (!endMarker) return source.slice(start);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `source marker missing: ${endMarker}`);
  return source.slice(start, end);
}

describe('incomeDetailLayout detail 主区契约', () => {
  it('主区恰好三类且顺序固定', () => {
    assert.deepEqual([...INCOME_DETAIL_MAIN_LABELS], ['税前工资', '五险一金和个税', '到手收入']);
  });

  it('基数 / 专项等在面板清单，主区标签不回流', () => {
    const panel: readonly string[] = [
      ...INCOME_DETAIL_PANEL_ITEMS.social,
      ...INCOME_DETAIL_PANEL_ITEMS.tax,
      ...INCOME_DETAIL_PANEL_ITEMS.taxDetail,
    ];
    assert.ok(panel.includes('五险基数'));
    assert.ok(panel.includes('公积金基数'));
    assert.ok(INCOME_DETAIL_PANEL_ITEMS.taxDetail.includes('专项附加扣除勾选'));
    assert.equal(INCOME_DETAIL_PANEL_ITEMS.tax.includes('专项附加扣除勾选' as never), false);
    assert.ok(panel.includes('退休与社保'));
    assert.equal(panel.includes('可支配收入'), false);
    for (const label of INCOME_DETAIL_MAIN_LABELS) {
      assert.equal(panel.includes(label), false);
      assert.equal(isIncomeDetailMainOnlyLabel(label), true);
    }
    assert.equal(isIncomeDetailMainOnlyLabel('五险基数'), false);
  });

  it('合并面板标题清晰可辨', () => {
    assert.equal(INCOME_DETAIL_DEDUCTION_PANEL_TITLE, '五险一金和个税');
  });

  // 一级入口行 → 二级弹层（非折叠展开）
  it('退休与社保走二级弹层，含完整设置项', () => {
    assert.equal(INCOME_DETAIL_SOCIAL_SETTINGS_ENTRY, '退休与社保');
    assert.equal(INCOME_DETAIL_SOCIAL_SETTINGS_PANEL_TITLE, '退休与社保');
    assert.deepEqual([...INCOME_DETAIL_PANEL_ITEMS.socialSettings], [
      '关联计算',
      '出生日期',
      '身份',
      '参保开始日期',
      '计划缴费年限',
      '规划社保基数',
      '城市快捷',
      '预计退休',
    ]);
    assert.ok(INCOME_DETAIL_PANEL_ITEMS.social.includes(INCOME_DETAIL_SOCIAL_SETTINGS_ENTRY));
  });

  // 二级：预估个税旁「查看明细」→ 抵扣勾选 → 分档税额 → 税率表；一级不含专项勾选
  it('个税明细入口进二级，含抵扣与分档税额与税率表', () => {
    assert.equal(INCOME_DETAIL_TAX_DETAIL_ENTRY, '查看明细');
    assert.equal(INCOME_DETAIL_TAX_DETAIL_PANEL_TITLE, '个税明细');
    assert.deepEqual([...INCOME_DETAIL_PANEL_ITEMS.tax], ['预估个税查看明细']);
    assert.deepEqual([...INCOME_DETAIL_PANEL_ITEMS.taxDetail], [
      '专项附加扣除勾选',
      '各区间实际税额',
      '税率区间表',
    ]);
  });
});

describe('FloatPanel sheet mask 交互契约', () => {
  it('mask 点击吞掉默认行为与冒泡，且不触发关闭', () => {
    const calls: string[] = [];
    blockOverlayEvent({
      preventDefault: () => calls.push('preventDefault'),
      stopPropagation: () => calls.push('stopPropagation'),
    });
    assert.deepEqual(calls, ['preventDefault', 'stopPropagation']);

    const floatPanelSource = floatPanelModuleSource;
    const backdropTag = floatPanelSource.match(/<div\b[^>]*data-sheet-backdrop[^>]*>/)?.[0];
    assert.ok(backdropTag, 'sheet backdrop missing');
    assert.match(backdropTag, /onPointerDown=\{blockOverlayEvent\}/);
    assert.match(backdropTag, /onPointerUp=\{blockOverlayEvent\}/);
    assert.match(backdropTag, /onClick=\{blockOverlayEvent\}/);
    assert.doesNotMatch(backdropTag, /onClose|setOpen/);
    assert.match(floatPanelSource, /tabIndex=\{-1\}/);
    assert.match(floatPanelSource, /onKeyDown=\{onPanelKeyDown\}/);
    assert.match(floatPanelSource, /aria-modal=\{asSheet \? 'true' : undefined\}/);
    assert.doesNotMatch(floatPanelSource, /document\.addEventListener\('keydown'/);
  });

  it('多个 sheet 共用 body 锁，最后一个关闭后才释放', () => {
    const calls: string[] = [];
    const target = {
      classList: {
        add: (name: string) => calls.push(`add:${name}`),
        remove: (name: string) => calls.push(`remove:${name}`),
      },
    };
    const releaseFirst = acquireSheetBodyLock(target);
    const releaseSecond = acquireSheetBodyLock(target);
    releaseFirst();
    releaseFirst();
    assert.deepEqual(calls, ['add:sheet-open']);
    releaseSecond();
    assert.deepEqual(calls, ['add:sheet-open', 'remove:sheet-open']);
  });
});

describe('退休与社保二级弹层归属契约', () => {
  const paramsSectionSource = sourceBetween(
    pageSource,
    '<section id="sec-params"',
    '<section id="sec-expenses"',
  );
  const socialTaxSource = sourceBetween(pageSource, 'function SocialTaxBreakdown({');
  const retirementEditorSource = sourceBetween(
    pageSource,
    'function RetirementSocialEditor({',
    'function DateEditable(',
  );

  it('主财务参数卡不再直接渲染退休设置', () => {
    assert.doesNotMatch(paramsSectionSource, /aria-expanded=\{retirementOpen\}/);
    assert.doesNotMatch(paramsSectionSource, /<DateEditable label="出生日期"/);
    assert.doesNotMatch(paramsSectionSource, /<SelectEditable label="身份"/);
    assert.doesNotMatch(paramsSectionSource, /<DateEditable label="参保开始日期"/);
    assert.doesNotMatch(paramsSectionSource, /<Editable label="计划缴费年限"/);
  });

  it('只看到手时保留已关联退休规划的状态与管理入口', () => {
    assert.match(paramsSectionSource, /incomeViewMode === 'takehome'[\s\S]*retirement\.enabled/);
    assert.match(paramsSectionSource, /退休规划已关联/);
    assert.match(paramsSectionSource, /预计退休 \{retirementDate \|\| '待完善'\}/);
    assert.match(paramsSectionSource, /onClick=\{\(\) => setIncomeViewModeSafe\('detail'\)\}/);
  });

  it('RetirementSocialEditor 完整承载退休字段与变更回调', () => {
    assert.match(retirementEditorSource, /retirement:\s*RetirementSetting/);
    assert.match(retirementEditorSource, /retirementDate:\s*string/);
    assert.match(retirementEditorSource, /onChange:\s*\(patch:\s*Partial<RetirementSetting>\)\s*=>\s*void/);
    assert.match(retirementEditorSource, /关联退休计算/);
    assert.match(retirementEditorSource, /出生日期[\s\S]*retirement\.birthDate/);
    assert.match(retirementEditorSource, /身份[\s\S]*retirement\.identity/);
    assert.match(retirementEditorSource, /参保开始日期[\s\S]*retirement\.insuranceStartDate/);
    assert.match(retirementEditorSource, /计划缴费年限[\s\S]*retirement\.contributionYears/);
    assert.match(retirementEditorSource, /<SocialBaseEditor value=\{retirement\.base\}/);
    assert.match(retirementEditorSource, /预计退休[\s\S]*retirementDate/);
    assert.match(retirementEditorSource, /money-manage-save/);
    // 编辑体本身不套 FloatPanel；由 SocialTaxBreakdown 二级承载
    assert.doesNotMatch(retirementEditorSource, /<FloatPanel|Z_INDEX\.nestedPanel/);
  });

  it('SocialTaxBreakdown 入口行：移动同 sheet 子页，PC nestedPanel 承载 RetirementSocialEditor', () => {
    assert.match(socialTaxSource, /\bretirement\b/);
    assert.match(socialTaxSource, /\bretirementDate\b/);
    assert.match(socialTaxSource, /\bonRetirementChange\b/);
    assert.match(socialTaxSource, /retirement:\s*RetirementSetting/);
    assert.match(socialTaxSource, /retirementDate:\s*string/);
    assert.match(socialTaxSource, /onRetirementChange:\s*\(patch:\s*Partial<RetirementSetting>\)\s*=>\s*void/);

    // 入口行文案 + 分轨
    assert.match(socialTaxSource, /INCOME_DETAIL_SOCIAL_SETTINGS_ENTRY/);
    assert.match(socialTaxSource, /useIsMobile/);
    assert.match(socialTaxSource, /mobileSubView/);
    assert.match(socialTaxSource, /data-sheet-subview=\"retirement\"/);
    // PC 二级弹层：!isMobile && nestedPanel / 单标题 / 编辑体
    assert.match(
      socialTaxSource,
      /\{!isMobile && \(\s*<FloatPanel[\s\S]*?open=\{retirementSettingsOpen\}[\s\S]*?zIndex=\{Z_INDEX\.nestedPanel\}[\s\S]*?headerTitle=\{INCOME_DETAIL_SOCIAL_SETTINGS_PANEL_TITLE\}[\s\S]*?<RetirementSocialEditor\s+retirement=\{retirement\}\s+retirementDate=\{retirementDate\}\s+onChange=\{onRetirementChange\}\s*\/>/,
    );
    // 一级关闭 / Esc：子页先 pop
    assert.match(socialTaxSource, /if \(mobileSubView\) \{[\s\S]*popSub\(\)/);
    assert.match(socialTaxSource, /if \(!open\) \{[\s\S]*setRetirementSettingsOpen\(false\)/);
    // 禁止一级内折叠展开（不再用 ∧∨ / aria-expanded 内联展开）
    assert.doesNotMatch(socialTaxSource, /aria-expanded=\{retirementSettingsOpen\}/);
    assert.doesNotMatch(socialTaxSource, /retirementSettingsOpen \? '∧' : '∨'/);
  });
});

describe('个税明细二级弹层归属契约', () => {
  const socialTaxSource = sourceBetween(pageSource, 'function SocialTaxBreakdown({');

  // 一级个税区无专项勾选；勾选仅出现在 taxDetail 二级（移动子页 / PC FloatPanel）内
  it('专项附加扣除勾选仅在个税「查看明细」二级，一级只留摘要与入口', () => {
    assert.match(socialTaxSource, /INCOME_DETAIL_TAX_DETAIL_ENTRY/);
    assert.match(socialTaxSource, /INCOME_DETAIL_TAX_DETAIL_PANEL_TITLE/);
    assert.match(socialTaxSource, /open=\{taxDetailOpen\}/);
    assert.match(socialTaxSource, /zIndex=\{Z_INDEX\.nestedPanel\}/);
    assert.match(socialTaxSource, /一级个税区：仅预估摘要/);
    assert.match(socialTaxSource, /二级：抵扣 → 各区间税额 → 税率表/);
    assert.match(socialTaxSource, /data-sheet-subview=\"tax\"/);
    assert.match(socialTaxSource, /\{!isMobile && \(\s*<FloatPanel[\s\S]*?open=\{taxDetailOpen\}/);

    // 住房租金 / 赡养老人勾选必须在 taxDetailBody（子页与 PC 二级共用）
    const taxDetailBody = socialTaxSource.match(
      /const taxDetailBody = \([\s\S]*?\n  \);/,
    )?.[0];
    assert.ok(taxDetailBody, 'taxDetailBody missing');
    assert.match(taxDetailBody, /住房租金/);
    assert.match(taxDetailBody, /赡养老人/);
    assert.match(taxDetailBody, /onRentChange/);
    assert.match(taxDetailBody, /onElderlyChange/);
    assert.match(taxDetailBody, /专项附加扣除/);
    assert.match(taxDetailBody, /本区间税额/);
    assert.match(taxDetailBody, /纳税区间表/);

    // 一级个税 section：在打开 taxDetail 之前不得出现专项勾选 label
    const primaryTax = socialTaxSource.match(
      /一级个税区[\s\S]*?\{!isMobile && \(\s*<FloatPanel[\s\S]*?open=\{taxDetailOpen\}/,
    )?.[0];
    assert.ok(primaryTax, 'primary tax section marker missing');
    assert.doesNotMatch(primaryTax, /onRentChange/);
    assert.doesNotMatch(primaryTax, /onElderlyChange/);
    assert.match(primaryTax, /本月预估个税/);
  });
});

describe('移动禁浮层叠浮层契约', () => {
  const pageSourceFresh = fs.readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  const floatPanelSource = fs.readFileSync(new URL('./components/FloatPanel.tsx', import.meta.url), 'utf8');
  const panelHeaderSource = fs.readFileSync(new URL('./components/PanelHeader.tsx', import.meta.url), 'utf8');
  const socialTaxSource = sourceBetween(pageSourceFresh, 'function SocialTaxBreakdown({');
  const assetSource = sourceBetween(pageSourceFresh, 'function AssetLinkedEditor({', 'function InstallmentSettingsPanel');

  it('FloatPanel / PanelHeader 支持 onBack 同 sheet 子页返回', () => {
    assert.match(floatPanelSource, /onBack\?: \(\) => void/);
    assert.match(floatPanelSource, /onBack=\{onBack\}/);
    assert.match(panelHeaderSource, /onBack\?: \(\) => void/);
    assert.match(panelHeaderSource, /\{onBack && \(/);
    assert.match(panelHeaderSource, /返回/);
  });

  it('移动 density=panel 走全屏内页（sheet-page），非半高抽屉', () => {
    // 契约：panel → data-ux=sheet-page + placeFullscreenInViewport 宽高贴满 VV；field 仍矮卡
    assert.match(floatPanelSource, /data-ux=\{isPanelSheet \? 'sheet-page'/);
    assert.match(floatPanelSource, /placeFullscreenInViewport/);
    assert.match(floatPanelSource, /paddingTop: isPanelSheet \? 'env\(safe-area-inset-top/);
    assert.match(floatPanelSource, /shadow-none/);
    // 全屏 maxHeight 跟显式像素高，不靠半高 dvh 裁切
    assert.match(floatPanelSource, /pos\.height \? `\$\{pos\.height\}px`/);
    assert.doesNotMatch(floatPanelSource, /sheet-handle/);
    assert.doesNotMatch(floatPanelSource, /rounded-t-3xl/);
  });

  it('SocialTaxBreakdown 移动不 portal nestedPanel（资产配置见 assetConfigLayout.test）', () => {
    // nestedPanel 仅包在 !isMobile；应急已扁平进资产内页，不再断言 emergency 子页
    assert.match(socialTaxSource, /\{!isMobile && \([\s\S]*zIndex=\{Z_INDEX\.nestedPanel\}/);
    assert.match(socialTaxSource, /data-sheet-subview=/);
    assert.match(socialTaxSource, /onBack=\{mobileSubView \? popSub : undefined\}/);
    assert.doesNotMatch(assetSource, /data-sheet-subview=\"emergency\"/);
    assert.doesNotMatch(assetSource, /emergencyOpen|popEmergency/);
  });
});
