/**
 * detail 收入主区契约：税前 / 五险一金和个税 / 到手收入；明细进合并面板
 * 退休与社保：一级入口行 → 独立二级 FloatPanel，不回流主财务参数卡
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

    const floatPanelSource = sourceBetween(pageSource, 'function FloatPanel({', '/** 闲钱投资');
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

  it('SocialTaxBreakdown 入口行打开二级 FloatPanel（nestedPanel）承载 RetirementSocialEditor', () => {
    assert.match(socialTaxSource, /\bretirement\b/);
    assert.match(socialTaxSource, /\bretirementDate\b/);
    assert.match(socialTaxSource, /\bonRetirementChange\b/);
    assert.match(socialTaxSource, /retirement:\s*RetirementSetting/);
    assert.match(socialTaxSource, /retirementDate:\s*string/);
    assert.match(socialTaxSource, /onRetirementChange:\s*\(patch:\s*Partial<RetirementSetting>\)\s*=>\s*void/);

    // 入口行文案
    assert.match(socialTaxSource, /INCOME_DETAIL_SOCIAL_SETTINGS_ENTRY/);
    // 二级弹层：open / nestedPanel / 单标题 / 编辑体
    assert.match(
      socialTaxSource,
      /<FloatPanel[\s\S]*?open=\{retirementSettingsOpen\}[\s\S]*?zIndex=\{Z_INDEX\.nestedPanel\}[\s\S]*?headerTitle=\{INCOME_DETAIL_SOCIAL_SETTINGS_PANEL_TITLE\}[\s\S]*?<RetirementSocialEditor\s+retirement=\{retirement\}\s+retirementDate=\{retirementDate\}\s+onChange=\{onRetirementChange\}\s*\/>/,
    );
    // 一级关闭时收起二级
    assert.match(socialTaxSource, /if \(!open\) \{[\s\S]*setRetirementSettingsOpen\(false\)/);
    // 禁止一级内折叠展开（不再用 ∧∨ / aria-expanded 内联展开）
    assert.doesNotMatch(socialTaxSource, /aria-expanded=\{retirementSettingsOpen\}/);
    assert.doesNotMatch(socialTaxSource, /retirementSettingsOpen \? '∧' : '∨'/);
    assert.doesNotMatch(socialTaxSource, /\{retirementSettingsOpen && \([\s\S]*<RetirementSocialEditor/);
  });
});

describe('个税明细二级弹层归属契约', () => {
  const socialTaxSource = sourceBetween(pageSource, 'function SocialTaxBreakdown({');

  // 一级个税区无专项勾选；勾选仅出现在 taxDetail 二级 FloatPanel 内
  it('专项附加扣除勾选仅在个税「查看明细」二级，一级只留摘要与入口', () => {
    assert.match(socialTaxSource, /INCOME_DETAIL_TAX_DETAIL_ENTRY/);
    assert.match(socialTaxSource, /INCOME_DETAIL_TAX_DETAIL_PANEL_TITLE/);
    assert.match(socialTaxSource, /open=\{taxDetailOpen\}/);
    assert.match(socialTaxSource, /zIndex=\{Z_INDEX\.nestedPanel\}/);
    assert.match(socialTaxSource, /一级个税区：仅预估摘要/);
    assert.match(socialTaxSource, /二级：抵扣 → 各区间税额 → 税率表/);

    // 住房租金 / 赡养老人勾选必须在 taxDetail FloatPanel 内部
    const taxDetailPanel = socialTaxSource.match(
      /<FloatPanel[\s\S]*?open=\{taxDetailOpen\}[\s\S]*?headerTitle=\{INCOME_DETAIL_TAX_DETAIL_PANEL_TITLE\}[\s\S]*?<\/FloatPanel>/,
    )?.[0];
    assert.ok(taxDetailPanel, 'tax detail FloatPanel missing');
    assert.match(taxDetailPanel, /住房租金/);
    assert.match(taxDetailPanel, /赡养老人/);
    assert.match(taxDetailPanel, /onRentChange/);
    assert.match(taxDetailPanel, /onElderlyChange/);
    assert.match(taxDetailPanel, /专项附加扣除/);
    assert.match(taxDetailPanel, /本区间税额/);
    assert.match(taxDetailPanel, /纳税区间表/);

    // 一级个税 section：在打开 taxDetail 之前不得出现专项勾选 label
    const primaryTax = socialTaxSource.match(
      /一级个税区[\s\S]*?<FloatPanel[\s\S]*?open=\{taxDetailOpen\}/,
    )?.[0];
    assert.ok(primaryTax, 'primary tax section marker missing');
    assert.doesNotMatch(primaryTax, /onRentChange/);
    assert.doesNotMatch(primaryTax, /onElderlyChange/);
    assert.match(primaryTax, /本月预估个税/);
  });
});
