'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import ReactECharts from 'echarts-for-react';
import InstallToDesktop from './InstallToDesktop';
import ConfirmDialog from './components/ConfirmDialog';
import FloatPanel from './components/FloatPanel';
import LinkedNumberFields, {
  LinkLockIcon,
} from './components/LinkedNumberFields';
import SelectNumberField from './components/SelectNumberField';
import { useRouter } from 'next/navigation';
import { logoutSession, type AuthUser } from './AuthBar';
import { authHref } from '../lib/auth/authHref';
import { REGISTER_DEFAULT_DATA_MESSAGE } from '../lib/auth/bindEmptyAccount';
import { restartSite } from '../lib/restartSite';
import { useIsMobile } from '../lib/useIsMobile';
import { useOverlayPresence } from '../lib/useOverlayPresence';
import { useScrollHideHeader } from '../lib/useScrollHideHeader';
import {
  formatAssetChartAxisLabel,
  formatYearMonthChartAxisLabel,
  monthAxisInterval,
  monthAxisRotate,
  PERCENT_SHARE_Y_FOCUS_MAX,
  PERCENT_SHARE_Y_FOCUS_MIN,
  percentShareOverflowMarks,
  percentShareYAxis,
} from '../lib/chartAxis';
import {
  FLOAT_MARGIN,
  placeNearAnchor,
  readSafeAreaInsets,
  viewportBounds,
} from '../lib/floatPlace';
import { BRAND } from '../lib/ui/brandColors';
import { Z_INDEX } from '../lib/ui/zIndex';
import { LIGHT_DEMO_ASSETS, LIGHT_DEMO_EXPENSES } from '../lib/demoDefaults';
import { buildDecisionSummary } from '../lib/decisionSummary';
import {
  pickCashFlowGuideFlags,
  pickExpenseShareWarnYAxes,
  pickRemainShareWarnYAxes,
} from '../lib/shareWarnMarkLines';
import { registerDebugLiveProfile } from '../lib/debugProfileTransfer';
import {
  loadGuestDraft,
  resolveGuestProfile,
  saveGuestDraft,
} from '../lib/persistence/guestDraft';
import { enqueueProfilePut } from '../lib/persistence/putProfile';
import {
  explainInstallmentPayment,
  installmentMonthlyPayment,
  installmentPaymentAsOf,
  migrateInstallmentTerms,
  type PageRepaymentMode as RepaymentMode,
} from './installmentPayment';
import {
  cashFlowRatios,
  remainDisposableSharePct,
  roundPct,
} from './cashFlowRatios';
import { aggregateMonthlyExpenses } from './monthlyExpenseAggregate';
import {
  expenseOutflowInMonth,
  installmentOutflowInMonth,
} from './monthlyExpenseOutflow';
import {
  buildPrefixExpenses,
  buildTemporalWindows,
  colorForItemId,
  impactTemporalStackedSeries,
  INVEST_SHARE_COLOR,
  INVEST_SHARE_NAME,
  remainInvestSpendableSeries,
  savingsFillTo100Series,
  SAVINGS_COLOR,
  SPENDABLE_REMAIN_NAME,
  toStackedLayersColored,
} from './sequentialImpact';
import {
  DEFAULT_REINVEST,
  effectiveInvestRate,
  parseReinvestSetting,
  reinvestToProfile,
  switchReinvestMode,
  type ReinvestMode,
  type ReinvestSetting,
} from '../domain/reinvest';
import {
  DEFAULT_EMERGENCY,
  activeCash,
  applyAnnualSpendPlan,
  applyMonthsPlan,
  enableMonthsPlan,
  emergencyReserve,
  emergencyToProfile,
  monthlyFromAnnual,
  parseEmergencySetting,
  resolvePlanMonthly,
  switchEmergencyMode,
  syncSettingFromCash,
  type EmergencyMode,
  type EmergencySetting,
} from '../domain/emergency';
import {
  assetAxisBounds,
  buildMonthlyAssetForecast,
  yearlyTotalsFromMonthly,
} from './assetForecast';
import {
  clampInstallmentTerm,
  defaultOneTimeDate,
  isActiveInMonth,
  monthKey,
  monthToDate,
  resolveExpenseSpan,
  todayDateKey,
  todayMonthKey,
} from './expenseSpan';
import { expenseDeleteMessage } from './deleteConfirm';
import {
  calcSocialBurdenSharePct,
  resolveContributionBase,
} from '../domain/social-security/index';
import {
  CITY_SOCIAL_BASE_PRESETS,
  defaultSocialBase,
  resolveCitySocialBase,
} from '../domain/social-security/city-bases';
import {
  DEFAULT_INCOME_VIEW_MODE,
  parseIncomeViewMode,
  resolveDisposableIncome,
  seedTakeHomeIncome,
  type IncomeViewMode,
} from '../domain/income/index';
import { softNumberCommit, softNumberIsInvalid } from './softNumber';
import {
  clampNumberField,
  formatEditableNumber,
  type NumberFieldKind,
} from './numberFieldUi';
import { commitTextField, formatTextFieldDisplay } from './textFieldUi';
import {
  buildTaxBracketSliceRows,
  findTaxMonthlyBracket,
  TAX_MONTHLY_BRACKETS,
} from '../domain/tax/index';
import {
  INCOME_DETAIL_DEDUCTION_PANEL_TITLE,
  INCOME_DETAIL_SOCIAL_SETTINGS_ENTRY,
  INCOME_DETAIL_SOCIAL_SETTINGS_PANEL_TITLE,
  INCOME_DETAIL_TAX_DETAIL_ENTRY,
  INCOME_DETAIL_TAX_DETAIL_PANEL_TITLE,
} from './incomeDetailLayout';
import {
  PLAN_CHANGE_ENTRY,
  PLAN_CHANGE_FIELD_LABEL,
  PLAN_CHANGE_PANEL_TITLE,
  PLAN_CHANGE_TIP,
  filterPlanChangeFieldOptions,
  formatPlanChangeListLine,
  planChangeMarkLinesForAssetAxis,
  planChangeMarkLinesForYearLabelAxis,
  planChangeMarkLinesForYearMonthAxis,
} from './planChangeLayout';
import {
  activeFieldOverride,
  createPlanChangeEvent,
  parsePlanChanges,
  planChangesToProfile,
  yearMonthForAssetMonth,
  yearMonthOffset,
  type PlanChangeEvent,
  type PlanChangeField,
} from '../domain/planChange';

type Expense = {
  id: string;
  name: string;
  category: string;
  mode: 'fixed' | 'percentage' | 'installment' | 'one_time';
  amount: number;
  rate?: number;
  total?: number;
  downPayment?: number;
  term?: number;
  interest?: number;
  repaymentMode?: RepaymentMode;
  startDate?: string;
  endDate?: string;
  followRetirement?: boolean;
};
/** max 可选：有则 blur clamp；一律原地 inline（不为 slider 弹窗） */
type EditableProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step: number;
  suffix?: string;
  kind?: NumberFieldKind;
  tip?: ReactNode;
  onChange: (value: number) => void;
};
type SocialRate = { personal: number; company: number };
type RetirementSetting = {
  enabled: boolean;
  birthDate: string;
  identity: string;
  insuranceStartDate: string;
  contributionYears: number;
  base: number;
};
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const money = (value: number) =>
  `¥${Math.round(value).toLocaleString('zh-CN')}`;
/** 资产走势 Y 轴：元 → 万元（数据仍为元；120000 → 12） */
const moneyWan = (value: number) => {
  const wan = value / 10000;
  return Number.isInteger(wan)
    ? String(wan)
    : wan.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
};
/** 相对年偏移 → 日历年标签（0=现在，5→2031年） */
const forecastYearLabel = (
  offsetYears: number,
  baseYear = new Date().getFullYear(),
) => (offsetYears === 0 ? '现在' : `${baseYear + offsetYears}年`);
// 差异色：增加=主题橙红，减少=主题绿
const DELTA_UP = BRAND.coral;
const DELTA_DOWN = '#3d8f6e';
const deltaTone = (delta: number) =>
  delta > 0 ? DELTA_UP : delta < 0 ? DELTA_DOWN : '#94a3b8';
const uid = () =>
  `expense-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
/** 支出草稿深拷贝；补齐缺省 startDate，避免浅拷贝/陈旧 state */
const cloneExpenseDraft = (source: Expense): Expense => {
  const next = structuredClone(source);
  if (!next.startDate) {
    next.startDate =
      next.mode === 'one_time' ? defaultOneTimeDate() : todayDateKey();
  }
  if (next.mode === 'one_time') next.endDate = next.startDate;
  return next;
};
// P1-2：轻演示（房租+餐饮）；日期运行时补
const initialExpenses: Expense[] = LIGHT_DEMO_EXPENSES.map((row) => ({
  ...row,
  startDate: todayDateKey(),
}));
const retirementDefaults: RetirementSetting = {
  enabled: false,
  birthDate: '1996-01-01',
  identity: 'male',
  insuranceStartDate: '2016-01-01',
  contributionYears: 20,
  base: defaultSocialBase(),
};
const addMonths = (date: string, months: number) => {
  const next = new Date(
    `${date || new Date().toISOString().slice(0, 10)}T00:00:00`,
  );
  next.setMonth(next.getMonth() + months);
  return next.toISOString().slice(0, 10);
};
const retirementDateFor = (birthDate: string, identity: string) => {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return '';
  const age =
    identity === 'female-worker' ? 55 : identity === 'female-cadre' ? 58 : 63;
  birth.setFullYear(birth.getFullYear() + age);
  return birth.toISOString().slice(0, 10);
};
const defaultSocialRates: Record<string, SocialRate> = {
  养老保险: { personal: 8, company: 16 },
  医疗保险: { personal: 2, company: 6 },
  失业保险: { personal: 0.5, company: 0.5 },
  工伤保险: { personal: 0, company: 0.4 },
  生育保险: { personal: 0, company: 0.8 },
  住房公积金: { personal: 5, company: 5 },
};
const ADJUSTED_AVAILABLE_ASSETS_TIP =
  '真正可动用的钱：总资产扣除备用金和未支付的分期首付。走势里会按实际月份扣首付和月供。';
const EMERGENCY_CASH_MODE_TIP =
  '「直接填写金额」：手动指定要留的钱。「按生活费月数计算」：用每月生活费 × 备用月数自动计算。';
const EMERGENCY_ANNUAL_SPEND_TIP =
  '填大概一年花多少，系统会除以 12 算出每月生活费。';
const EMERGENCY_MONTHS_FIELD_TIP =
  '想预留几个月生活费。备用金额 = 每月生活费 × 备用月数；改一边，另一边会自动同步。';
/** 消费分析：勾选说明（点开会怎样） */
const ANALYZE_PICK_TIP =
  '选择一笔或多笔支出，下面的图会展示它们合在一起的影响。\n默认选中当前这笔支出，也可以随时更换。已启用的未来调整会一并算入。';
/** 消费分析：投资拆层 */
const ANALYZE_INVEST_TIP =
  '打开后，把每月剩余的钱拆成两部分：拿去理财的钱，和可以自由使用的钱。\n当月没有剩余时，两部分都会是 0。';
/** 消费分析：占比图 */
const ANALYZE_CHART_TIP =
  '看每笔支出占到手收入多少；100% 表示收入刚好用完，超过 100% 表示当月不够用。打开投资拆分后，还能看到剩余的钱中有多少拿去理财。\n与主图一致：会算入已启用的未来调整（收入或年化变化）。';
/** 消费分析：资产走势对比 */
const ANALYZE_ASSET_TIP =
  '对比两种情况：不算所选支出，和算上所选支出。两条线的差距，就是这几笔支出对长期资产的影响。\n每月按实际支出扣款，分期首月扣首付、之后扣每月还款；也会算入已启用的未来调整。';
/** PC：悬停气泡；移动：贴锚点矮卡 + 视口夹紧翻转，不锁 body（ux tip 档） */
const InfoTip = ({ children }: { children: ReactNode }) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [tipPos, setTipPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = anchorRef.current;
      const tip = tipRef.current;
      if (!anchor || !tip) return;
      const vv = window.visualViewport;
      const vp = viewportBounds(
        vv,
        window.innerWidth,
        window.innerHeight,
        FLOAT_MARGIN,
        readSafeAreaInsets(),
      );
      const rect = anchor.getBoundingClientRect();
      const next = placeNearAnchor(
        rect,
        tip.offsetWidth || 256,
        tip.offsetHeight || 80,
        vp,
        8,
        'center',
      );
      setTipPos({ top: next.top, left: next.left });
    };
    place();
    const raf = window.requestAnimationFrame(place);
    const vv = window.visualViewport;
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    vv?.addEventListener('resize', place);
    vv?.addEventListener('scroll', place);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      vv?.removeEventListener('resize', place);
      vv?.removeEventListener('scroll', place);
    };
  }, [open, children]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // 点页面其它处自动关；遮罩与气泡一并 portal 到 body（祖先 transform 会裁掉 fixed）
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (anchorRef.current?.contains(target)) return;
      if (tipRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () =>
      document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const tipNode =
    open &&
    createPortal(
    <>
        {isMobile && (
          <button
            type="button"
            aria-label="关闭说明"
            className="fixed inset-0 cursor-default bg-transparent"
            style={{ zIndex: Z_INDEX.tipBackdrop }}
            onClick={() => setOpen(false)}
          />
        )}
        <span
          ref={tipRef}
          role="tooltip"
          className={`fixed w-64 max-w-[calc(100vw-2rem)] rounded-xl bg-ink p-3 text-left text-xs font-normal leading-5 text-white shadow-xl whitespace-pre-line ${isMobile ? '' : 'pointer-events-none'}`}
          style={{ top: tipPos.top, left: tipPos.left, zIndex: Z_INDEX.tip }}
        >
          {children}
        </span>
      </>,
        document.body,
  );

  if (isMobile) {
    return (
      <span className="relative inline-flex shrink-0 align-middle">
        <button
          ref={anchorRef}
          type="button"
          aria-label="查看说明"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="relative grid h-4 w-4 place-items-center rounded-full border border-slate-300 text-[10px] font-semibold leading-none text-slate-500 before:absolute before:-inset-3 before:content-[''] [-webkit-tap-highlight-color:transparent]"
        >
          ?
        </button>
        {tipNode}
      </span>
    );
  }

  return (
    <span
      className="relative inline-flex shrink-0 align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        ref={anchorRef}
        type="button"
        aria-label="查看说明"
        className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-xs font-semibold text-slate-500 hover:border-coral hover:text-coral-deep"
      >
        ?
      </button>
      {tipNode}
    </span>
  );
};
const SectionTitle = ({
  eyebrow,
  title,
  tip,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  tip?: ReactNode;
  compact?: boolean;
}) => (
  <div className="flex min-w-0 items-center gap-2">
    {eyebrow && <p className="eyebrow shrink-0">{eyebrow}</p>}
    <h2
      className={`${compact ? 'text-lg' : 'text-lg sm:text-2xl'} min-w-0 font-semibold leading-tight`}
    >
      {title}
    </h2>
    {tip && <InfoTip>{tip}</InfoTip>}
  </div>
);

type FinanceInput = {
  salary: number;
  /** 五险基数；null=按工资。旧 profile 的 contributionBase 即此字段 */
  contributionBase?: number | null;
  /** 公积金基数；null=按工资（与五险独立，改五险不影响缺省公积金） */
  housingFundBase?: number | null;
  /** 是否缴纳五险一金；false → 个人/企业均为 0，个税无社保扣减 */
  socialEnabled?: boolean;
  /** detail=关心五险一金；takehome=只看到手，直接用 takeHomeIncome 作净收入 */
  incomeViewMode?: IncomeViewMode;
  /** 简便模式直接录入的月到手；缺省时回退税前路径算出的 net */
  takeHomeIncome?: number | null;
  cash: number;
  invest: number;
  returnRate: number;
  /** @deprecated 保留兼容；实际用 emergency */
  emergencyMonths?: number;
  emergency?: EmergencySetting;
  totalAssets: number;
  expenses: Expense[];
  rentEnabled: boolean;
  elderlyEnabled: boolean;
  socialRates: Record<string, SocialRate>;
};
const HOUSING_FUND_NAME = '住房公积金';
type FinanceResult = ReturnType<typeof computeFinanceResult>;
const repaymentModeLabel = (mode?: RepaymentMode) =>
  mode === 'equal_principal' ? '等额本金' : '等额本息';
function computeFinanceResult({
  salary,
  contributionBase,
  housingFundBase,
  socialEnabled = true,
  incomeViewMode = DEFAULT_INCOME_VIEW_MODE,
  takeHomeIncome,
  cash,
  invest,
  returnRate,
  emergencyMonths,
  emergency,
  totalAssets,
  expenses,
  rentEnabled,
  elderlyEnabled,
  socialRates,
}: FinanceInput) {
  // 五险 / 公积金各自缺省跟工资；关闭缴纳时金额全 0（个税按无社保扣减）
  const insuranceBase = resolveContributionBase(salary, contributionBase);
  const fundBase = resolveContributionBase(salary, housingFundBase);
  const socialRows = Object.entries(socialRates).map(([name, rates]) => {
    const base = name === HOUSING_FUND_NAME ? fundBase : insuranceBase;
    return {
      name,
      personal: rates.personal,
      company: rates.company,
      personalAmount: socialEnabled ? (base * rates.personal) / 100 : 0,
      companyAmount: socialEnabled ? (base * rates.company) / 100 : 0,
      base,
    };
  });
  const social = socialRows.reduce((sum, row) => sum + row.personalAmount, 0);
  const deductions = [
    { name: '基本减除费用', enabled: true, standard: 5000, rate: 100 },
    {
      name: '住房租金',
      enabled: rentEnabled,
      standard: 1500,
      rate: rentEnabled ? 100 : 0,
    },
    {
      name: '赡养老人',
      enabled: elderlyEnabled,
      standard: 2000,
      rate: elderlyEnabled ? 100 : 0,
    },
  ].map((row) => ({ ...row, actual: (row.standard * row.rate) / 100 }));
  const taxable = Math.max(
    0,
    salary - social - deductions.reduce((sum, row) => sum + row.actual, 0),
  );
  const tax =
    taxable <= 3000
      ? taxable * 0.03
      : taxable <= 12000
        ? taxable * 0.1 - 210
        : taxable <= 25000
          ? taxable * 0.2 - 1410
          : taxable <= 35000
            ? taxable * 0.25 - 2660
            : taxable <= 55000
              ? taxable * 0.3 - 4410
              : taxable <= 80000
                ? taxable * 0.35 - 7160
                : taxable * 0.45 - 15160;
  // 详细路径净收入；简便模式优先用用户声明的到手（结余/预测收入侧）
  const computedNet = salary - social - Math.max(0, tax);
  const net = resolveDisposableIncome(
    incomeViewMode,
    takeHomeIncome,
    computedNet,
  );
  const investmentIncome = (invest * returnRate) / 100 / 12;
  // 本月支出与剩余% / 决策摘要同源聚合
  const spend = aggregateMonthlyExpenses(expenses, net, investmentIncome);
  const recurring = spend.recurring;
  const oneTime = spend.oneTime;
  const monthlyExpenses = spend.monthly;
  const debt = spend.debt;
  const committedDownPayments = expenses
    .filter((expense) => expense.mode === 'installment')
    .reduce((sum, expense) => sum + (expense.downPayment || 0), 0);
  const liquidAssets = cash + invest;
  // 兼容旧调用：未传 emergency 时，也组装成两套分存的完整结构。
  const legacyMonths = Number.isFinite(emergencyMonths)
    ? Math.max(0, emergencyMonths ?? 0)
    : 0;
  const emergencySetting: EmergencySetting = emergency ?? {
    ...DEFAULT_EMERGENCY,
    enabled: legacyMonths > 0,
    mode: legacyMonths > 0 ? 'months' : 'amount',
    cashDirect: Math.max(0, cash),
    monthsPlan: {
      ...DEFAULT_EMERGENCY.monthsPlan,
      months: legacyMonths,
      cash: Math.max(0, cash),
    },
  };
  // 备用金 = 当前 mode 生效现金（不再另扣一坨）
  const emergencyReserveAmount = emergencyReserve(
    emergencySetting,
    monthlyExpenses,
    cash,
  );
  const adjustedAvailableAssets = Math.max(
    0,
    liquidAssets - committedDownPayments - emergencyReserveAmount,
  );
  const totalLiabilities = expenses
    .filter((expense) => expense.mode === 'installment')
    .reduce(
      (sum, expense) =>
        sum + Math.max(0, (expense.total || 0) - (expense.downPayment || 0)),
      0,
    );
  const netWorth = totalAssets - totalLiabilities;
  const surplus = net + investmentIncome - monthlyExpenses;
  // 分母=可支配收入 net（与占比图一致）；剩余 = 100 − 支出占比，超支可为负
  const { expensePct } = cashFlowRatios({
    debt,
    otherExpenses: Math.max(0, monthlyExpenses - debt),
    income: net,
  });
  const remainDisposablePct = remainDisposableSharePct(expensePct);
  return {
    socialRows,
    social,
    deductions,
    tax: Math.max(0, tax),
    net,
    detailNet: computedNet,
    investmentIncome,
    monthlyExpenses,
    recurringMonthlyExpenses: recurring,
    oneTimeTotal: oneTime,
    surplus,
    emergency: emergencySetting.monthsPlan.months,
    emergencyReserve: emergencyReserveAmount,
    emergencySetting,
    debt,
    remainDisposablePct,
    committedDownPayments,
    liquidAssets,
    adjustedAvailableAssets,
    totalLiabilities,
    netWorth,
  };
}

/**
 * 计划变更月度口径：按指标独立覆盖；主画像不改写。
 * - grossSalary → salary + detail
 * - takeHomeIncome → takeHomeIncome + takehome（与税前同月并存时净收入以到手为准）
 * - annualReturn → returnRate（理财年化 / 投资收益）
 * 无任何覆盖时与主卡 computeFinanceResult 一致。
 */
function financeAtPlanMonth(
  input: FinanceInput,
  events: PlanChangeEvent[],
  yearMonth: string,
): FinanceResult {
  const salaryOverride = activeFieldOverride(events, 'grossSalary', yearMonth);
  const takeHomeOverride = activeFieldOverride(
    events,
    'takeHomeIncome',
    yearMonth,
  );
  const returnOverride = activeFieldOverride(events, 'annualReturn', yearMonth);
  if (
    salaryOverride == null &&
    takeHomeOverride == null &&
    returnOverride == null
  ) {
    return computeFinanceResult(input);
  }
  const next: FinanceInput = { ...input };
  if (salaryOverride != null) next.salary = salaryOverride;
  if (takeHomeOverride != null) next.takeHomeIncome = takeHomeOverride;
  if (returnOverride != null) next.returnRate = returnOverride;
  // 到手覆盖优先决定净收入口径；否则有税前覆盖则走详细链
  if (takeHomeOverride != null) next.incomeViewMode = 'takehome';
  else if (salaryOverride != null) next.incomeViewMode = 'detail';
  return computeFinanceResult(next);
}

// 年度对比复用月度资产内核：按月扣支出 + 理财比例再平衡；可选叠加计划变更
function forecastYearlyTotals(
  cash: number,
  invest: number,
  returnRate: number,
  reinvest: ReinvestSetting,
  investRatio: number,
  expenses: Expense[],
  retirementDate?: string,
  planEvents: PlanChangeEvent[] = [],
  baseInput?: FinanceInput,
) {
  const anchor = todayDateKey();
  const base: FinanceInput = baseInput ?? {
    salary: 0,
    cash,
    invest,
    returnRate,
    totalAssets: cash + invest,
    expenses,
    rentEnabled: false,
    elderlyEnabled: false,
    socialRates: {},
  };
  const hasReturnPlan = planEvents.some(
    (e) => e.enabled && e.field === 'annualReturn',
  );
  return yearlyTotalsFromMonthly({
    cash,
    investment: invest,
    annualReturnRate: returnRate,
    disposableIncomeMonthly: computeFinanceResult({ ...base, expenses }).net,
    recurringExpenseMonthly: 0,
    oneTimeExpense: 0,
    reinvest,
    investRatio,
    years: 30,
    incomeAtMonth: (month: number) => {
      const ym = yearMonthForAssetMonth(month);
      return financeAtPlanMonth({ ...base, expenses }, planEvents, ym).net;
    },
    expenseOutflowAtMonth: (month: number) => {
      const ym = yearMonthForAssetMonth(month);
      const monthFinance = financeAtPlanMonth(
        { ...base, expenses },
        planEvents,
        ym,
      );
      return expenseOutflowInMonth({
        expenses,
        yearMonth: ym,
        dateKey: monthToDate(ym),
        net: monthFinance.net,
        investmentIncome: monthFinance.investmentIncome,
        retirementDate,
        anchorDate: anchor,
      });
    },
    ...(hasReturnPlan
      ? {
          annualReturnRateAtMonth: (month: number) => {
            const ym = yearMonthForAssetMonth(month);
            return (
              activeFieldOverride(planEvents, 'annualReturn', ym) ?? returnRate
            );
          },
        }
      : {}),
  }).map((row) => ({ ...row, label: forecastYearLabel(row.year) }));
}

/** 逐月支出占可支配收入占比；disposable / investmentIncome 可为按月函数（计划变更） */
function forecastExpenseShareByMonth(
  expenses: Expense[],
  disposableIncome: number | ((index: number) => number),
  investmentIncome: number | ((index: number) => number),
  months = 360,
  retirementDate?: string,
) {
  const disposableAt =
    typeof disposableIncome === 'function'
    ? disposableIncome
    : (_index: number) => disposableIncome;
  const investIncomeAt =
    typeof investmentIncome === 'function'
    ? investmentIncome
    : (_index: number) => investmentIncome;
  const anchor = todayDateKey();
  return Array.from({ length: months }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() + index);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const income = disposableAt(index);
    const investInc = investIncomeAt(index);
    const outflow = expenseOutflowInMonth({
      expenses,
      yearMonth,
      dateKey: monthToDate(yearMonth),
      net: income,
      investmentIncome: investInc,
      retirementDate,
      anchorDate: anchor,
    });
    let debt = 0;
    for (const expense of expenses) {
      if (expense.mode !== 'installment') continue;
      const start = monthKey(expense.startDate || anchor);
      if (start === yearMonth) continue;
      debt += installmentOutflowInMonth(
        expense,
        monthToDate(yearMonth),
        yearMonth,
        anchor,
      );
    }
    const other = Math.max(0, outflow - debt);
    const { expensePct } = cashFlowRatios({
      debt,
      otherExpenses: other,
      income,
    });
    return {
      label: yearMonth,
      pct: roundPct(expensePct),
    };
  });
}


export default function HomePage() {
  // ponytail: 显式 number，避免 LIGHT_DEMO_ASSETS as const / 字面量把 setter 收窄成字面量类型导致 build 失败
  const [salary, setSalary] = useState<number>(16667);
  const [cash, setCash] = useState<number>(LIGHT_DEMO_ASSETS.cash);
  const [emergencyEnabled, setEmergencyEnabled] = useState(
    DEFAULT_EMERGENCY.enabled,
  );
  const [emergencyMode, setEmergencyMode] = useState<EmergencyMode>(
    DEFAULT_EMERGENCY.mode,
  );
  // 与演示现金同起点，避免未 hydrate 时切模式把默认现金写成 0
  const [emergencyCashDirect, setEmergencyCashDirect] = useState<number>(
    LIGHT_DEMO_ASSETS.cash,
  );
  const [emergencyMonths, setEmergencyMonths] = useState(
    DEFAULT_EMERGENCY.monthsPlan.months,
  );
  const [emergencyMonthsCash, setEmergencyMonthsCash] = useState(
    DEFAULT_EMERGENCY.monthsPlan.cash,
  );
  const [emergencyAnnualSpend, setEmergencyAnnualSpend] = useState(
    DEFAULT_EMERGENCY.monthsPlan.annualSpend,
  );
  const [totalAssets, setTotalAssets] = useState<number>(
    LIGHT_DEMO_ASSETS.totalAssets,
  );
  const [invest, setInvest] = useState<number>(LIGHT_DEMO_ASSETS.invest);
  const [investRatio, setInvestRatio] = useState<number>(
    LIGHT_DEMO_ASSETS.investRatio,
  );
  const [returnRate, setReturnRate] = useState<number>(3.2);
  const [reinvestMode, setReinvestMode] = useState<ReinvestMode>(
    DEFAULT_REINVEST.mode,
  );
  const [reinvestRate, setReinvestRate] = useState(DEFAULT_REINVEST.rate);
  const [reinvestAmount, setReinvestAmount] = useState(DEFAULT_REINVEST.amount);
  const [socialRates, setSocialRates] = useState(defaultSocialRates);
  // null = 按工资（上限 31000）；有值则自定义五险缴费基数
  const [contributionBase, setContributionBase] = useState<number | null>(null);
  // null = 按工资；与五险独立（只改五险时公积金仍跟工资）
  const [housingFundBase, setHousingFundBase] = useState<number | null>(null);
  // 默认缴纳；false → 五险一金全 0，个税无社保扣减
  const [socialEnabled, setSocialEnabled] = useState(true);
  // 默认只看到手（访客/演示同）；detail=关心五险一金
  const [incomeViewMode, setIncomeViewMode] = useState<IncomeViewMode>(
    DEFAULT_INCOME_VIEW_MODE,
  );
  // 简便套独立字段；缺省 null，hydrate/切模式后用 detailNet 播种一次（不改详细套）
  const [takeHomeIncome, setTakeHomeIncome] = useState<number | null>(null);
  const takeHomeSeededRef = useRef(false);
  const [showAssetDetails, setShowAssetDetails] = useState(false);
  const assetDetailBtnRef = useRef<HTMLButtonElement>(null);
  const [visibleAssetLines, setVisibleAssetLines] = useState({
    cash: true,
    investment: true,
    total: true,
  });
  const [visibleCashFlowLines, setVisibleCashFlowLines] = useState({
    dti: true,
    expense: true,
    savings: true,
  });
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [rentEnabled, setRentEnabled] = useState(true);
  const [elderlyEnabled, setElderlyEnabled] = useState(false);
  const elderlyShare = 100;
  const setElderlyShare = (_value: number) => undefined;
  const [savedAt, setSavedAt] = useState('');
  /** 云端 revision；blur PUT 用，避免冲突 */
  const cloudRevisionRef = useRef(0);
  const [hydrated, setHydrated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [retirement, setRetirement] = useState(retirementDefaults);
  const isNarrow = useIsMobile();
  const headerCollapsed = useScrollHideHeader(true);
  const router = useRouter();
  // 顶栏下拉：访客=登录/注册/重启；登录=安装/重启/登出
  const [headerMoreOpen, setHeaderMoreOpen] = useState(false);
  const { present: headerMorePresent, state: headerMoreState } =
    useOverlayPresence(headerMoreOpen);
  const [registerConfirmOpen, setRegisterConfirmOpen] = useState(false);
  // portal 到 body：避开 sticky 顶栏 stacking / overflow 裁切
  const headerMoreBtnRef = useRef<HTMLButtonElement>(null);
  const headerMoreMenuRef = useRef<HTMLDivElement>(null);
  const [headerMorePos, setHeaderMorePos] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    if (!headerMorePresent) return;
    const MENU_W = 208; // w-52
    const place = () => {
      const btn = headerMoreBtnRef.current;
      const menu = headerMoreMenuRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const vv = window.visualViewport;
      const vp = viewportBounds(
        vv,
        window.innerWidth,
        window.innerHeight,
        FLOAT_MARGIN,
        readSafeAreaInsets(),
      );
      const h = menu?.offsetHeight || 220;
      // 右对齐触发钮：伪锚点宽度 = 菜单宽
      const next = placeNearAnchor(
        {
          top: rect.top,
          left: rect.right - MENU_W,
          right: rect.right,
          bottom: rect.bottom,
          width: MENU_W,
          height: rect.height,
        },
        MENU_W,
        h,
        vp,
        6,
        'start',
      );
      setHeaderMorePos({ top: next.top, left: next.left });
    };
    place();
    const raf = window.requestAnimationFrame(place);
    const vv = window.visualViewport;
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    vv?.addEventListener('resize', place);
    vv?.addEventListener('scroll', place);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      vv?.removeEventListener('resize', place);
      vv?.removeEventListener('scroll', place);
    };
  }, [headerMorePresent]);
  // 列表删除二次确认（支出桌面/移动）；复用 FloatPanel field 矮卡
  const [pendingDelete, setPendingDelete] = useState<null | {
    kind: 'expense';
    id: string;
    title: string;
    message: string;
  }>(null);
  const deleteAnchorRef = useRef<HTMLElement | null>(null);
  const askDelete = (
    anchor: HTMLElement | null,
    payload: { kind: 'expense'; id: string; title: string; message: string },
  ) => {
    deleteAnchorRef.current = anchor;
    setPendingDelete(payload);
  };
  // 计划变更：只影响预测；主卡税前不变
  const [planChanges, setPlanChanges] = useState<PlanChangeEvent[]>([]);
  const [planChangeOpen, setPlanChangeOpen] = useState(false);
  const planChangeBtnRef = useRef<HTMLButtonElement>(null);

  const applyProfileData = (data: Record<string, unknown>) => {
    if (data.salary) setSalary(Number(data.salary));
    if (data.cash !== undefined) setCash(Number(data.cash));
      {
        const parsed = parseEmergencySetting(data);
        setEmergencyEnabled(parsed.enabled);
        setEmergencyMode(parsed.mode);
        setEmergencyCashDirect(parsed.cashDirect);
        setEmergencyMonths(parsed.monthsPlan.months);
        setEmergencyMonthsCash(parsed.monthsPlan.cash);
        setEmergencyAnnualSpend(parsed.monthsPlan.annualSpend);
      }
    if (data.totalAssets !== undefined)
      setTotalAssets(Number(data.totalAssets));
      if (data.invest !== undefined) setInvest(Number(data.invest));
      // 现金由总资产与理财推导，保证三者一致
      if (data.totalAssets !== undefined && data.invest !== undefined) {
        const total = Math.max(0, Number(data.totalAssets));
        const investAmount = clamp(Number(data.invest), 0, total);
        setCash(total - investAmount);
      setInvestRatio(total ? (investAmount / total) * 100 : 0);
    } else if (data.investRatio !== undefined)
      setInvestRatio(Number(data.investRatio));
    if (data.returnRate !== undefined) setReturnRate(Number(data.returnRate));
      // 旧画像仅 reinvestRate → percent；新字段 reinvestMode / reinvestAmount
      {
        const parsed = parseReinvestSetting(data);
        setReinvestMode(parsed.mode);
        setReinvestRate(parsed.rate);
        setReinvestAmount(parsed.amount);
      }
    if (data.socialRates)
      setSocialRates({
        ...defaultSocialRates,
        ...(data.socialRates as typeof defaultSocialRates),
      });
      // 旧 contributionBase → 五险基数；缺省字段 → 跟工资
    if (
      data.contributionBase !== undefined &&
      data.contributionBase !== null &&
      Number.isFinite(Number(data.contributionBase))
    ) {
        setContributionBase(Math.max(0, Number(data.contributionBase)));
      } else {
        setContributionBase(null);
      }
      // 公积金独立；旧画像无此字段 → 跟工资（非跟五险）
    if (
      data.housingFundBase !== undefined &&
      data.housingFundBase !== null &&
      Number.isFinite(Number(data.housingFundBase))
    ) {
        setHousingFundBase(Math.max(0, Number(data.housingFundBase)));
      } else {
        setHousingFundBase(null);
      }
      setSocialEnabled(data.socialEnabled !== false);
      setIncomeViewMode(parseIncomeViewMode(data.incomeViewMode));
    if (
      data.takeHomeIncome !== undefined &&
      data.takeHomeIncome !== null &&
      Number.isFinite(Number(data.takeHomeIncome))
    ) {
        setTakeHomeIncome(Math.max(0, Number(data.takeHomeIncome)));
        takeHomeSeededRef.current = true; // 已有简便套，勿再播种覆盖
      } else {
        setTakeHomeIncome(null);
        takeHomeSeededRef.current = false; // 缺字段 → hydrate 后按 detailNet 播种
      }
      if (data.expenses) {
        // 年误存为月（如房贷 term=30）→ 写回真正月数 360，autosave 会落盘
      setExpenses(
        migrateInstallmentTerms(
          (data.expenses as Expense[]).map((item: Expense) => {
          if (item.mode === 'one_time' && !item.startDate) {
            const start = defaultOneTimeDate();
            return { ...item, startDate: start, endDate: start };
          }
          return item;
          }),
        ),
      );
      }
    if (data.rentEnabled !== undefined)
      setRentEnabled(Boolean(data.rentEnabled));
    if (data.elderlyEnabled !== undefined)
      setElderlyEnabled(Boolean(data.elderlyEnabled));
      // ponytail: 旧 profile.snapshots 忽略，不再 hydrate
    if (data.retirement)
      setRetirement({
        ...retirementDefaults,
        ...(data.retirement as typeof retirementDefaults),
      });
      setPlanChanges(parsePlanChanges(data));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let me: AuthUser | null = null;
      try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const data = await meRes.json();
          me = data.user || null;
          if (!cancelled) setAuthUser(me);
        }
      } catch {
        /* 无会话 → 访客 */
      }
      if (!cancelled) setAuthReady(true);

      // 访客：本机 guest 键草稿或内存 LIGHT_DEMO；不打云端
      if (!me) {
        const saved = loadGuestDraft();
        if (!cancelled && saved) applyProfileData(saved);
        if (!cancelled) setHydrated(true);
        return;
      }

      try {
        const response = await fetch('/api/profile');
        if (response.ok) {
          const state = await response.json();
          if (!cancelled && typeof state?.revision === 'number') {
            cloudRevisionRef.current = state.revision;
          }
          if (
            !cancelled &&
            state?.profile &&
            Object.keys(state.profile).length > 0
          ) {
            applyProfileData(state.profile as Record<string, unknown>);
          } else {
            // 空账号：优先本账号本机缓存，再回落访客草稿
            const saved = loadGuestDraft({ userId: me.id }) ?? loadGuestDraft();
            if (!cancelled && saved) applyProfileData(saved);
          }
        }
      } catch {
        // 离线：优先本账号 local 缓存，勿串用其他账号键
        const saved = loadGuestDraft({ userId: me.id }) ?? loadGuestDraft();
        if (!cancelled && saved) applyProfileData(saved);
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // contributionBase / housingFundBase 缺省不落盘，保持「按工资」；socialEnabled 仅 false 时写入
  const reinvestSetting: ReinvestSetting = useMemo(
    () => ({ mode: reinvestMode, rate: reinvestRate, amount: reinvestAmount }),
    [reinvestMode, reinvestRate, reinvestAmount],
  );
  const emergencySetting: EmergencySetting = useMemo(
    () => ({
      enabled: emergencyEnabled,
      mode: emergencyMode,
      cashDirect: emergencyCashDirect,
      monthsPlan: {
        months: emergencyMonths,
        cash: emergencyMonthsCash,
        annualSpend: emergencyAnnualSpend,
      },
    }),
    [
      emergencyEnabled,
      emergencyMode,
      emergencyCashDirect,
      emergencyMonths,
      emergencyMonthsCash,
      emergencyAnnualSpend,
    ],
  );
  const profile = {
    schemaVersion: 4,
    salary,
    cash,
    ...emergencyToProfile(emergencySetting, cash),
    totalAssets,
    invest,
    investRatio,
    returnRate,
    ...reinvestToProfile(reinvestSetting),
    socialRates,
    expenses,
    rentEnabled,
    elderlyEnabled,
    retirement,
    ...(contributionBase != null ? { contributionBase } : {}),
    ...(housingFundBase != null ? { housingFundBase } : {}),
    ...(socialEnabled ? {} : { socialEnabled: false }),
    incomeViewMode,
    ...(takeHomeIncome != null ? { takeHomeIncome } : {}),
    ...planChangesToProfile(planChanges),
  };
  const save = () => {
    // 访客 → guest 键；登录 → 本账号键；仅 blur / 显式确认时调用
    const userId = authUser?.id ?? null;
    saveGuestDraft(profile, { userId });
    setSavedAt(new Date().toLocaleTimeString('zh-CN'));
    // 登录：串行 PUT；409 用服务端 revision 重试，避免多 blur 撞车
    if (userId) {
      void enqueueProfilePut(profile, {
        getRevision: () => cloudRevisionRef.current,
        setRevision: (n) => {
          cloudRevisionRef.current = n;
        },
      });
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  const profileRef = useRef(profile);
  profileRef.current = profile;

  // 登出 → 访客键；不把当前账号画像写入访客键（保留原访客草稿或回落轻演示）
  const handleLogout = () => {
    let guestRaw: Record<string, unknown> | null = null;
    try {
      guestRaw = loadGuestDraft();
    } catch {
      /* ignore */
    }
    setAuthUser(null);
    cloudRevisionRef.current = 0;
    setSavedAt('');
    setHeaderMoreOpen(false);
    setHydrated(true);
    if (guestRaw) {
      applyProfileData(guestRaw);
    } else {
      applyProfileData({
        salary: 16667,
        returnRate: 3.2,
        socialRates: defaultSocialRates,
        rentEnabled: true,
        elderlyEnabled: false,
        retirement: { ...retirementDefaults },
        ...(resolveGuestProfile(null).profile as Record<string, unknown>),
      });
    }
  };

  // blur / 显式确认通过 money-manage-save 落盘；change 只改 React state
  // 必须延后一拍：blur 里先 setState 再派发事件时，同步读到的仍是旧 profile
  useEffect(() => {
    if (!hydrated) return;
    let timer = 0;
    const onPersist = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => saveRef.current(), 0);
    };
    window.addEventListener('money-manage-save', onPersist);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('money-manage-save', onPersist);
    };
  }, [hydrated]);

  // dbg 导出用当前内存 profile（含未 blur 的编辑）
  useEffect(() => {
    registerDebugLiveProfile(() => profileRef.current as Record<string, unknown>);
    return () => registerDebugLiveProfile(null);
  }, []);
  const retirementDate = retirementDateFor(
    retirement.birthDate,
    retirement.identity,
  );
  const updateRetirement = (patch: Partial<typeof retirement>) =>
    setRetirement((current) => ({ ...current, ...patch }));
  // 现金 = 总资产 - 理财；改任一端同步另外两端
  const syncAssets = (nextTotal: number, nextInvest: number) => {
    const total = Math.max(0, nextTotal);
    const investAmount = clamp(nextInvest, 0, total);
    const nextCash = total - investAmount;
    setTotalAssets(total);
    setInvest(investAmount);
    setCash(nextCash);
    setInvestRatio(total ? (investAmount / total) * 100 : 0);
    return nextCash;
  };
  const applyEmergencySetting = (next: EmergencySetting) => {
    setEmergencyEnabled(next.enabled);
    setEmergencyMode(next.mode);
    setEmergencyCashDirect(next.cashDirect);
    setEmergencyMonths(next.monthsPlan.months);
    setEmergencyMonthsCash(next.monthsPlan.cash);
    setEmergencyAnnualSpend(next.monthsPlan.annualSpend);
  };
  const committedDownPayments = expenses
    .filter((expense) => expense.mode === 'installment')
    .reduce((sum, expense) => sum + (expense.downPayment || 0), 0);

  const effectiveInsuranceBase = resolveContributionBase(
    salary,
    contributionBase,
  );
  const effectiveHousingFundBase = resolveContributionBase(
    salary,
    housingFundBase,
  );
  const financeInput = useMemo(
    () => ({
      salary,
      contributionBase,
      housingFundBase,
      socialEnabled,
      incomeViewMode,
      takeHomeIncome,
      cash,
      invest,
      returnRate,
      emergency: emergencySetting,
      totalAssets,
      expenses,
      rentEnabled,
      elderlyEnabled,
      socialRates,
    }),
    [
      salary,
      contributionBase,
      housingFundBase,
      socialEnabled,
      incomeViewMode,
      takeHomeIncome,
      cash,
      invest,
      returnRate,
      emergencySetting,
      totalAssets,
      expenses,
      rentEnabled,
      elderlyEnabled,
      socialRates,
    ],
  );
  const result = useMemo(
    () => computeFinanceResult(financeInput),
    [financeInput],
  );

  // 规划月均：往年÷12，缺省回退账本本月支出
  const planMonthly = resolvePlanMonthly(
    emergencySetting.monthsPlan.annualSpend,
    result.monthlyExpenses,
  );
  const syncEmergencyWithCash = (nextCash: number) => {
    applyEmergencySetting(
      syncSettingFromCash(emergencySetting, nextCash, result.monthlyExpenses),
    );
  };
  const updateTotalAssets = (value: number) => {
    const nextCash = syncAssets(value, Math.min(invest, Math.max(0, value)));
    syncEmergencyWithCash(nextCash);
  };
  const updateCash = (value: number) => {
    const nextCash = clamp(value, 0, totalAssets);
    syncAssets(totalAssets, totalAssets - nextCash);
    // 直接填现金：强制 amount 模式，只写 cashDirect
    applyEmergencySetting(
      syncSettingFromCash(
      { ...emergencySetting, mode: 'amount' },
      nextCash,
      result.monthlyExpenses,
      ),
    );
  };
  const updateInvestByAmount = (value: number) => {
    const availableCap = Math.max(0, totalAssets - committedDownPayments);
    const nextCash = syncAssets(totalAssets, clamp(value, 0, availableCap));
    syncEmergencyWithCash(nextCash);
  };
  const updateInvestByRatio = (value: number) => {
    const ratio = clamp(value, 0, 100);
    const availableCap = Math.max(0, totalAssets - committedDownPayments);
    const nextCash = syncAssets(
      totalAssets,
      Math.min(availableCap, (totalAssets * ratio) / 100),
    );
    syncEmergencyWithCash(nextCash);
  };
  /** 应急月数 → 现金 = 月均×月数，联动理财；只写 monthsPlan */
  const updateCashByMonths = (months: number) => {
    const monthly = resolvePlanMonthly(
      emergencySetting.monthsPlan.annualSpend,
      result.monthlyExpenses,
    );
    const { cash: nextCash, setting } = applyMonthsPlan(
      emergencySetting,
      months,
      monthly,
      totalAssets,
    );
    applyEmergencySetting(setting);
    syncAssets(totalAssets, totalAssets - nextCash);
  };
  /** 往年支出 → ÷12 月均 × 当前月数 → 现金 */
  const updateAnnualSpend = (annual: number) => {
    const { cash: nextCash, setting } = applyAnnualSpendPlan(
      emergencySetting,
      annual,
      totalAssets,
    );
    applyEmergencySetting(setting);
    syncAssets(totalAssets, totalAssets - nextCash);
  };
  /** select「默认」/「应急月数」→ 只切 mode，恢复对应套现金，另一套保留 */
  const setMonthsPlanChecked = (checked: boolean) => {
    const next = checked
      ? enableMonthsPlan(emergencySetting, result.monthlyExpenses)
      : switchEmergencyMode(emergencySetting, 'amount', result.monthlyExpenses);
    const nextCash = clamp(activeCash(next), 0, totalAssets);
    applyEmergencySetting(
      syncSettingFromCash(next, nextCash, result.monthlyExpenses),
    );
    syncAssets(totalAssets, totalAssets - nextCash);
  };

  // 切到简便：若尚未声明到手，用详细套 detailNet 播种（不碰详细字段）
  const setIncomeViewModeSafe = (mode: IncomeViewMode) => {
    if (mode === 'takehome') {
      setTakeHomeIncome((current) =>
        seedTakeHomeIncome(current, result.detailNet),
      );
    }
    setIncomeViewMode(mode);
    window.dispatchEvent(new Event('money-manage-save'));
  };
  // 访客/缺 takeHome：hydrate 后播种一次，避免 takehome 出口为 0
  useEffect(() => {
    if (!hydrated || takeHomeSeededRef.current) return;
    takeHomeSeededRef.current = true;
    if (incomeViewMode === 'takehome' && takeHomeIncome == null) {
      setTakeHomeIncome(seedTakeHomeIncome(null, result.detailNet));
    }
  }, [hydrated, incomeViewMode, takeHomeIncome, result.detailNet]);

  // 面板确认后才入表；取消/关闭不落库
  const confirmAddExpense = (expense: Expense) => {
    const id = expense.id;
    setExpenses((items) => [...items, expense]);
    window.dispatchEvent(new Event('money-manage-save'));
    // 等 React commit；桌面 tr（md 隐藏）与移动 card 双锚点，取有布局盒的
    window.setTimeout(() => {
      const nodes = document.querySelectorAll<HTMLElement>(
        `[data-expense-anchor="${id}"]`,
      );
      const el =
        Array.from(nodes).find((n) => n.getClientRects().length > 0) ||
        nodes[0];
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };
  const updateExpense = (id: string, patch: Partial<Expense>) =>
    setExpenses((items) =>
      items.map((item) => {
    if (item.id !== id) return item;
    const next = { ...item, ...patch };
    if (next.mode === 'one_time') {
      if (!next.startDate) next.startDate = defaultOneTimeDate();
      next.endDate = next.startDate;
    } else if (!next.startDate) {
      next.startDate = todayDateKey();
    }
    if (next.mode === 'installment') {
      const start = next.startDate || todayDateKey();
          next.term = clampInstallmentTerm(
            start,
            next.term || 1,
            Boolean(next.followRetirement),
            retirement.enabled ? retirementDate : undefined,
          );
      if (next.followRetirement && retirement.enabled && retirementDate) {
        const span = resolveExpenseSpan(next, { retirementDate });
        next.endDate = span.end;
      }
    }
    return next;
      }),
    );
  const removeExpense = (id: string) =>
    setExpenses((items) => items.filter((item) => item.id !== id));
  const requestRemoveExpense = (
    expense: Expense,
    anchor: HTMLElement | null,
  ) => {
    askDelete(anchor, {
      kind: 'expense',
      id: expense.id,
      title: '删除支出',
      message: expenseDeleteMessage(
        expense.name,
        formatExpenseMode(expense.mode),
        formatExpensePayment(expense),
      ),
    });
  };
  // 计划变更：按月可支配收入（有覆盖走详细净收入）
  const disposableAtChartIndex = useMemo(() => {
    return (index: number) =>
      financeAtPlanMonth(financeInput, planChanges, yearMonthOffset(index)).net;
  }, [financeInput, planChanges]);
  // 剩余可支配占比曲线：与占比图同口径（分母=可支配收入）；逐月真实分期月供
  const remainForecast = useMemo(() => {
    const rows = forecastExpenseShareByMonth(
      expenses,
      disposableAtChartIndex,
      result.investmentIncome,
      360,
      retirement.enabled ? retirementDate : undefined,
    );
    return rows.map((row) => ({
      label: row.label,
      value: remainDisposableSharePct(row.pct),
    }));
  }, [
    expenses,
    disposableAtChartIndex,
    result.investmentIncome,
    retirement.enabled,
    retirementDate,
  ]);
  // 现金流比率：逐月 DTI% / 支出率% / 储蓄率%；分期按当月真实月供；收入随计划变更
  const cashFlowForecast = useMemo(() => {
    const anchor = todayDateKey();
    return Array.from({ length: 360 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() + index);
      const dateKey = date.toISOString().slice(0, 10);
      const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthFinance = financeAtPlanMonth(financeInput, planChanges, ym);
      const income = monthFinance.net + monthFinance.investmentIncome;
      const outflow = expenseOutflowInMonth({
        expenses,
        yearMonth: ym,
        dateKey: monthToDate(ym),
        net: monthFinance.net,
        investmentIncome: monthFinance.investmentIncome,
        retirementDate: retirement.enabled ? retirementDate : undefined,
        anchorDate: anchor,
      });
      // 分期次月起计 debt（第 1 期起）；首月首付与其它支出进 other
      let debt = 0;
      for (const expense of expenses) {
        if (expense.mode !== 'installment') continue;
        const startYm = monthKey(expense.startDate || anchor);
        if (startYm === ym) continue;
        debt += installmentOutflowInMonth(expense, monthToDate(ym), ym, anchor);
      }
      const other = Math.max(0, outflow - debt);
      const ratios = cashFlowRatios({ debt, otherExpenses: other, income });
      return {
        dateKey,
        label: ym,
        dtiPct: roundPct(ratios.dtiPct),
        expensePct: roundPct(ratios.expensePct),
        savingsPct: roundPct(ratios.savingsPct),
      };
    });
  }, [expenses, financeInput, planChanges, retirement.enabled, retirementDate]);

  const monthlyAssetForecast = useMemo(() => {
    const hasReturnPlan = planChanges.some(
      (e) => e.enabled && e.field === 'annualReturn',
    );
    const anchor = todayDateKey();
    const retire = retirement.enabled ? retirementDate : undefined;
    return buildMonthlyAssetForecast({
      cash,
      investment: invest,
      annualReturnRate: returnRate,
      disposableIncomeMonthly: result.net,
      recurringExpenseMonthly: 0,
      oneTimeExpense: 0,
      reinvest: reinvestSetting,
      months: 360,
      investRatio,
      emergencyReserve: result.emergencyReserve,
      incomeAtMonth: (month: number) => {
        const ym = yearMonthForAssetMonth(month);
        return financeAtPlanMonth(financeInput, planChanges, ym).net;
      },
      expenseOutflowAtMonth: (month: number) => {
        const ym = yearMonthForAssetMonth(month);
        const monthFinance = financeAtPlanMonth(financeInput, planChanges, ym);
        return expenseOutflowInMonth({
          expenses,
          yearMonth: ym,
          dateKey: monthToDate(ym),
          net: monthFinance.net,
          investmentIncome: monthFinance.investmentIncome,
          retirementDate: retire,
          anchorDate: anchor,
        });
      },
      ...(hasReturnPlan
        ? {
            annualReturnRateAtMonth: (month: number) => {
              const ym = yearMonthForAssetMonth(month);
              return (
                activeFieldOverride(planChanges, 'annualReturn', ym) ??
                returnRate
              );
            },
          }
        : {}),
    }).map((row) => ({
      ...row,
      label:
        row.month === 0
          ? '现在'
          : `${Math.floor(row.month / 12)}年${row.month % 12}个月`,
    }));
  }, [
    cash,
    invest,
    returnRate,
    investRatio,
    reinvestSetting,
    result.net,
    result.emergencyReserve,
    financeInput,
    planChanges,
    expenses,
    retirement.enabled,
    retirementDate,
  ]);
  const assetChartOption = useMemo(() => {
    const labels = monthlyAssetForecast.map((row) => row.label);
    const idle = monthlyAssetForecast.map((row) => row.cash);
    const investment = monthlyAssetForecast.map((row) => row.investment);
    const finalAssets = monthlyAssetForecast.map((row) => row.total);
    const visibleValues = [
      ...(visibleAssetLines.cash ? idle : []),
      ...(visibleAssetLines.investment ? investment : []),
      ...(visibleAssetLines.total ? finalAssets : []),
    ];
    const { min: yMin, max: yMax } = assetAxisBounds(visibleValues);
    const series: Array<{
      name: string;
      type: string;
      smooth: boolean;
      symbol: string;
      data: number[];
      lineStyle: { color: string; width: number };
      areaStyle?: { color: string };
      z?: number;
    }> = [];
    if (visibleAssetLines.cash) {
      series.push({
        name: '现金余额',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: idle,
        lineStyle: { color: '#94a3b8', width: 2.5 },
        areaStyle: { color: 'rgba(148,163,184,0.12)' },
        z: 1,
      });
    }
    if (visibleAssetLines.investment) {
      series.push({
        name: '理财资产',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: investment,
        lineStyle: { color: BRAND.coral, width: 3 },
        areaStyle: { color: 'rgba(240,127,98,0.10)' },
        z: 2,
      });
    }
    if (visibleAssetLines.total) {
      series.push({
        name: '预计总资产',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: finalAssets,
        lineStyle: { color: BRAND.ink, width: 3.5 },
        z: 3,
      });
    }
    // 计划变更生效月竖线（仅 enabled；多指标分色短标签）
    const planMarks = planChangeMarkLinesForAssetAxis(planChanges, labels);
    if (planMarks.length && series.length) {
      const last = series.length - 1;
      series[last] = {
        ...series[last],
        markLine: {
          silent: true,
          symbol: 'none',
          data: planMarks,
        },
      } as (typeof series)[number] & {
        markLine: { silent: boolean; symbol: string; data: typeof planMarks };
      };
    }
    return {
      animation: false,
      grid: {
        left: isNarrow ? 40 : 64,
        right: isNarrow ? 12 : 28,
        top: 40,
        bottom: isNarrow ? 72 : 96,
      },
      tooltip: {
        trigger: 'axis',
        textStyle: { fontSize: 14 },
        valueFormatter: (value: number) => money(Number(value)),
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLabel: {
          color: '#334155',
          fontSize: isNarrow ? 12 : 14,
          fontWeight: 600,
          interval: monthAxisInterval(isNarrow),
          rotate: monthAxisRotate(isNarrow),
          hideOverlap: true,
          margin: 14,
          formatter: (value: string) =>
            formatAssetChartAxisLabel(value, isNarrow),
        },
        axisTick: {
          show: true,
          length: 8,
          lineStyle: { color: '#64748b', width: 2 },
        },
        axisLine: { lineStyle: { color: '#64748b', width: 2 } },
        name: '未来月份',
        nameLocation: 'middle',
        nameGap: isNarrow ? 36 : 56,
        nameTextStyle: {
          color: '#334155',
          fontSize: isNarrow ? 11 : 16,
          fontWeight: 600,
        },
      },
      yAxis: {
        type: 'value',
        min: yMin,
        max: yMax,
        splitNumber: 5,
        name: '万元',
        nameTextStyle: {
          color: '#334155',
          fontSize: isNarrow ? 11 : 16,
          fontWeight: 600,
        },
        axisLabel: {
          color: '#334155',
          fontSize: 14,
          fontWeight: 600,
          formatter: (value: number) => moneyWan(value),
        },
        axisTick: {
          show: true,
          length: 8,
          lineStyle: { color: '#64748b', width: 2 },
        },
        axisLine: { show: true, lineStyle: { color: '#64748b', width: 2 } },
        splitLine: {
          lineStyle: { color: '#cbd5e1', type: 'dashed', width: 1.5 },
      },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', height: 18, bottom: 8, start: 0, end: 100 },
      ],
      series,
    };
  }, [monthlyAssetForecast, visibleAssetLines, isNarrow, planChanges]);
  const remainShareChartOption = useMemo(() => {
    const values = remainForecast.map((point) => point.value);
    const current = values[0] ?? 0;
    const dataMin = values.length ? Math.min(...values) : 0;
    const remainWarnAxes = pickRemainShareWarnYAxes(dataMin);
    const warnFloor = Math.min(0, ...remainWarnAxes);
    const yMin = Math.min(0, dataMin, warnFloor);
    const yMax = Math.max(100, ...values);
    // 轴夹 ±100；带外点 pin 贴边标真实值
    const yAxisRange = percentShareYAxis(yMin, yMax);
    const visibleRemainWarnAxes = remainWarnAxes.filter(
      (y) => y >= yAxisRange.min && y <= yAxisRange.max,
    );
    const firstLabel = remainForecast[0]?.label;
    const overflowMarks = percentShareOverflowMarks(
      remainForecast.map((point) => ({
        label: point.label,
        value: point.value,
      })),
    );
    const currentCoordY = Math.min(
      PERCENT_SHARE_Y_FOCUS_MAX,
      Math.max(PERCENT_SHARE_Y_FOCUS_MIN, current),
    );
    return {
    animation: false,
    // 右侧留白给 markLine；375 下 10%≈32px 仍裁字，窄屏用 68px
      grid: {
        left: isNarrow ? 40 : 72,
        right: isNarrow ? 68 : '10%',
        top: 40,
        bottom: isNarrow ? 72 : 96,
      },
      tooltip: {
        trigger: 'axis',
        textStyle: { fontSize: isNarrow ? 11 : 16 },
        valueFormatter: (value: number) => `${Number(value).toFixed(1)}%`,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: remainForecast.map((point) => point.label),
        axisLabel: {
          color: '#334155',
          fontSize: isNarrow ? 11 : 16,
          fontWeight: 600,
          interval: monthAxisInterval(isNarrow),
          rotate: monthAxisRotate(isNarrow),
          hideOverlap: true,
          margin: 14,
          formatter: (value: string) =>
            formatYearMonthChartAxisLabel(value, isNarrow),
        },
        axisTick: {
          show: true,
          length: 8,
          lineStyle: { color: '#64748b', width: 2 },
        },
        axisLine: { lineStyle: { color: '#64748b', width: 2 } },
        name: '未来月份',
        nameLocation: 'middle',
        nameGap: isNarrow ? 36 : 56,
        nameTextStyle: {
          color: '#334155',
          fontSize: isNarrow ? 12 : 18,
          fontWeight: 600,
        },
      },
      yAxis: {
        type: 'value',
        min: yAxisRange.min,
        max: yAxisRange.max,
        interval: yAxisRange.interval,
        name: '剩余可支配 %',
        nameTextStyle: {
          color: '#334155',
          fontSize: isNarrow ? 12 : 18,
          fontWeight: 600,
        },
        axisLabel: {
          color: '#334155',
          fontSize: isNarrow ? 12 : 18,
          fontWeight: 600,
          formatter: '{value}%',
        },
        axisTick: {
          show: true,
          length: 8,
          lineStyle: { color: '#64748b', width: 2 },
        },
        axisLine: { show: true, lineStyle: { color: '#64748b', width: 2 } },
        splitLine: {
          lineStyle: { color: '#cbd5e1', type: 'dashed', width: 1.5 },
        },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', height: 18, bottom: 8, start: 0, end: 100 },
      ],
      series: [
        {
      name: '剩余可支配占比',
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: values,
      lineStyle: { color: BRAND.coral, width: 3 },
      areaStyle: { color: 'rgba(240,127,98,0.12)' },
      markPoint: {
        symbol: 'pin',
        symbolSize: isNarrow ? 44 : 52,
        // 首点贴 Y 轴时 pin 会盖住刻度；略右移
        symbolOffset: [isNarrow ? 18 : 28, 0],
        data: [
              {
                name: '当前',
                coord: [firstLabel, currentCoordY],
                value: current,
              },
          ...overflowMarks.filter((mark) => mark.coord[0] !== firstLabel),
        ],
            label: {
              show: true,
              formatter: (p: { value?: number }) =>
                `${Number(p.value ?? 0).toFixed(1)}%`,
              color: '#fff',
              fontSize: isNarrow ? 11 : 12,
              fontWeight: 700,
            },
            itemStyle: {
              color: BRAND.coral,
              borderColor: '#fff',
              borderWidth: 1,
            },
          },
      // 对应占比图支出档位 → 剩余负区；严重超支时稀疏中间警告线；竖线=计划变更
      markLine: {
        silent: true,
        symbol: 'none',
        data: [
          ...(() => {
                const remainWarnMeta: Record<
                  number,
                  {
                    name: string;
                    lineStyle: {
                      color: string;
                      type: 'solid' | 'dashed';
                      width: number;
                    };
                    label: {
                      formatter: string;
                      color: string;
                      fontSize: number;
                      fontWeight?: number;
                    };
                  }
                > = {
                  100: {
                    name: '满额 100%',
                    lineStyle: { color: BRAND.ink, type: 'solid', width: 1.5 },
                    label: {
                      formatter: '满额 100%',
                      color: BRAND.ink,
                      fontSize: isNarrow ? 10 : 12,
                      fontWeight: 600,
                    },
                  },
                  0: {
                    name: '打满 0%',
                    lineStyle: { color: '#64748b', type: 'dashed', width: 2 },
                    label: {
                      formatter: '打满 0%',
                      color: '#334155',
                      fontSize: isNarrow ? 10 : 12,
                      fontWeight: 600,
                    },
                  },
                  [-10]: {
                    name: '警告 −10%',
                    lineStyle: { color: '#f59e0b', type: 'dashed', width: 1 },
                    label: {
                      formatter: '警告 −10%',
                      color: '#b45309',
                      fontSize: isNarrow ? 10 : 11,
                    },
                  },
                  [-20]: {
                    name: '警告 −20%',
                    lineStyle: { color: '#f97316', type: 'dashed', width: 1 },
                    label: {
                      formatter: '警告 −20%',
                      color: '#c2410c',
                      fontSize: isNarrow ? 10 : 11,
                    },
                  },
                  [-50]: {
                    name: '警告 −50%',
                    lineStyle: { color: '#dc2626', type: 'dashed', width: 1 },
                    label: {
                      formatter: '警告 −50%',
                      color: '#b91c1c',
                      fontSize: isNarrow ? 10 : 11,
                    },
                  },
                };
                return visibleRemainWarnAxes.map((yAxis) => ({
                  yAxis,
                  ...remainWarnMeta[yAxis],
                }));
          })(),
          ...planChangeMarkLinesForYearMonthAxis(planChanges),
        ],
      },
        },
      ],
  };
  }, [remainForecast, isNarrow, planChanges]);
  const cashFlowChartOption = useMemo(() => {
    const labels = cashFlowForecast.map((point) => point.label);
    const dti = cashFlowForecast.map((point) => point.dtiPct);
    const expense = cashFlowForecast.map((point) => point.expensePct);
    const savings = cashFlowForecast.map((point) => point.savingsPct);
    const visibleValues = [
      ...(visibleCashFlowLines.dti ? dti : []),
      ...(visibleCashFlowLines.expense ? expense : []),
      ...(visibleCashFlowLines.savings ? savings : []),
    ];
    const dataMin = visibleValues.length ? Math.min(...visibleValues) : 0;
    const dataMax = visibleValues.length ? Math.max(...visibleValues) : 100;
    const expensePeak = expense.length ? Math.max(...expense) : 0;
    const expenseWarnAxes = visibleCashFlowLines.expense
      ? pickExpenseShareWarnYAxes(expensePeak)
      : [];
    const expenseWarnCeil = expenseWarnAxes.length
      ? Math.max(...expenseWarnAxes)
      : 0;
    const yMin = Math.min(0, dataMin);
    const yMax = Math.max(100, dataMax, expenseWarnCeil);
    // 轴夹 ±100；建议线按夹后峰谷判定，避免极端峰把引导线整段藏掉
    const yAxisRange = percentShareYAxis(yMin, yMax);
    const visibleExpenseWarnAxes = expenseWarnAxes.filter(
      (y) => y >= yAxisRange.min && y <= yAxisRange.max,
    );
    const guideFlags = pickCashFlowGuideFlags({
      peakPct: Math.min(dataMax, PERCENT_SHARE_Y_FOCUS_MAX),
      troughPct: Math.max(dataMin, PERCENT_SHARE_Y_FOCUS_MIN),
    });
    const expenseWarnMeta: Record<
      number,
      {
        name: string;
        lineStyle: { color: string; type: 'solid' | 'dashed'; width: number };
        label: { formatter: string; color: string; fontSize: number };
      }
    > = {
      100: {
        name: '支出 100%',
        lineStyle: { color: BRAND.ink, type: 'solid', width: 1.5 },
        label: {
          formatter: '支出 100%',
          color: BRAND.ink,
          fontSize: isNarrow ? 10 : 12,
        },
      },
      110: {
        name: '警告 110%',
        lineStyle: { color: '#f59e0b', type: 'dashed', width: 1 },
        label: {
          formatter: '警告 110%',
          color: '#b45309',
          fontSize: isNarrow ? 10 : 11,
        },
      },
      120: {
        name: '警告 120%',
        lineStyle: { color: '#f97316', type: 'dashed', width: 1 },
        label: {
          formatter: '警告 120%',
          color: '#c2410c',
          fontSize: isNarrow ? 10 : 11,
        },
      },
      150: {
        name: '警告 150%',
        lineStyle: { color: '#dc2626', type: 'dashed', width: 1 },
        label: {
          formatter: '警告 150%',
          color: '#b91c1c',
          fontSize: isNarrow ? 10 : 11,
        },
      },
    };
    const overflowPin = (vals: number[], color: string) => {
      const marks = percentShareOverflowMarks(
        labels.map((label, index) => ({ label, value: vals[index] ?? 0 })),
      );
      if (!marks.length) return {};
      return {
        markPoint: {
          symbol: 'pin',
          symbolSize: isNarrow ? 36 : 44,
          data: marks,
          label: {
            show: true,
            formatter: (p: { value?: number }) =>
              `${Number(p.value ?? 0).toFixed(1)}%`,
            color: '#fff',
            fontSize: isNarrow ? 10 : 11,
            fontWeight: 700,
          },
          itemStyle: { color, borderColor: '#fff', borderWidth: 1 },
        },
      };
    };
    const series: Array<{
      name: string;
      type: string;
      smooth: boolean;
      symbol: string;
      data: number[];
      lineStyle: { color: string; width: number };
      markPoint?: {
        symbol: string;
        symbolSize: number;
        data: Array<{ name: string; coord: [string, number]; value: number }>;
        label: {
          show: boolean;
          formatter: (p: { value?: number }) => string;
          color: string;
          fontSize: number;
          fontWeight: number;
        };
        itemStyle: { color: string; borderColor: string; borderWidth: number };
      };
      markLine?: {
        silent: boolean;
        symbol?: string;
        data: Array<{
          yAxis: number;
          name: string;
          lineStyle?: { color: string; type: string; width: number };
          label?: { formatter?: string; color: string; fontSize: number };
        }>;
        lineStyle?: { color: string; type: string; width: number };
        label?: { color: string; fontSize: number };
      };
    }> = [];
    if (visibleCashFlowLines.dti) {
      series.push({
        name: '还款占收入',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: dti,
        lineStyle: { color: BRAND.coral, width: 3 },
        ...overflowPin(dti, BRAND.coral),
        ...(guideFlags.showDti
          ? {
            markLine: {
              silent: true,
              data: [{ yAxis: 35, name: '建议≤35%' }],
              lineStyle: { color: BRAND.coral, type: 'dashed', width: 1.5 },
              label: { color: BRAND.coralDeep, fontSize: isNarrow ? 10 : 12 },
            },
          }
          : {}),
      });
    }
    if (visibleCashFlowLines.expense) {
      series.push({
        name: '支出占收入',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: expense,
        lineStyle: { color: '#64748b', width: 2.5 },
        ...overflowPin(expense, '#64748b'),
        // 与分析占比图同档；轴夹后只保留可视区内警告线
        markLine: {
          silent: true,
          symbol: 'none',
          data: visibleExpenseWarnAxes.map((yAxis) => ({
            yAxis,
            ...expenseWarnMeta[yAxis],
          })),
        },
      });
    }
    if (visibleCashFlowLines.savings) {
      series.push({
        name: '收入剩余',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: savings,
        lineStyle: { color: '#3d8f6e', width: 3 },
        ...overflowPin(savings, '#3d8f6e'),
        ...(guideFlags.showSavings
          ? {
            markLine: {
              silent: true,
              data: [{ yAxis: 20, name: '建议≥20%' }],
              lineStyle: { color: '#3d8f6e', type: 'dashed', width: 1.5 },
              label: { color: '#2f6f56', fontSize: isNarrow ? 10 : 12 },
            },
          }
          : {}),
      });
    }
    return {
      animation: false,
      // 右侧留白给 markLine；窄屏 68px 避免「建议≤35%」裁切
      grid: {
        left: isNarrow ? 40 : 72,
        right: isNarrow ? 68 : '10%',
        top: 40,
        bottom: isNarrow ? 72 : 96,
      },
      tooltip: {
        trigger: 'axis',
        textStyle: { fontSize: 14 },
        valueFormatter: (value: number) => `${Number(value).toFixed(1)}%`,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLabel: {
          color: '#334155',
          fontSize: isNarrow ? 12 : 14,
          fontWeight: 600,
          interval: monthAxisInterval(isNarrow),
          rotate: monthAxisRotate(isNarrow),
          hideOverlap: true,
          margin: 14,
          formatter: (value: string) =>
            formatYearMonthChartAxisLabel(value, isNarrow),
        },
        axisTick: {
          show: true,
          length: 8,
          lineStyle: { color: '#64748b', width: 2 },
        },
        axisLine: { lineStyle: { color: '#64748b', width: 2 } },
        name: '未来月份',
        nameLocation: 'middle',
        nameGap: isNarrow ? 36 : 56,
        nameTextStyle: {
          color: '#334155',
          fontSize: isNarrow ? 11 : 16,
          fontWeight: 600,
        },
      },
      yAxis: {
        type: 'value',
        min: yAxisRange.min,
        max: yAxisRange.max,
        interval: yAxisRange.interval,
        name: '占比 %',
        nameTextStyle: {
          color: '#334155',
          fontSize: isNarrow ? 11 : 16,
          fontWeight: 600,
        },
        axisLabel: {
          color: '#334155',
          fontSize: 14,
          fontWeight: 600,
          formatter: '{value}%',
        },
        axisTick: {
          show: true,
          length: 8,
          lineStyle: { color: '#64748b', width: 2 },
        },
        axisLine: { show: true, lineStyle: { color: '#64748b', width: 2 } },
        splitLine: {
          lineStyle: { color: '#cbd5e1', type: 'dashed', width: 1.5 },
        },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', height: 18, bottom: 8, start: 0, end: 100 },
      ],
      series,
    };
  }, [cashFlowForecast, visibleCashFlowLines, isNarrow]);

  const saveStatusText = savedAt
    ? `已保存到本机 ${savedAt}`
    : authUser
      ? '已自动保存到本机'
      : '访客数据仅保存在本机';
  // 首屏决策摘要：与 result 同源（月支出=聚合口径）
  const decisionSummary = buildDecisionSummary({
    monthlySpendable: result.net,
    monthlyExpense: result.monthlyExpenses,
    monthlySurplus: result.surplus,
    totalAssets,
  });

  // session/hydrate 未就绪：品牌顶栏 + 参数卡骨架，避免空白「加载中」与演示数闪一下
  if (!authReady || !hydrated) {
    return (
      <main
        className="min-h-screen bg-paper text-ink"
        aria-busy="true"
        aria-live="polite"
      >
        <div
          className={`mobile-sticky-top${headerCollapsed ? ' is-header-hidden' : ''}`}
        >
          <header className="app-header page-pad mx-auto flex max-w-[1920px] items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 sm:px-6 lg:px-10">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-sm font-bold text-white">
                M
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">财务规划</p>
                <p className="hidden truncate text-[11px] leading-tight text-slate-400 sm:block">
                  消费承受力测算 · 访客可体验
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2" aria-hidden>
              <span className="cold-skel cold-skel-pill" />
              <span className="cold-skel cold-skel-chip" />
            </div>
          </header>
        </div>
        <div className="page-pad mx-auto max-w-[1920px] px-3 py-3 sm:px-6 lg:px-10">
          <section
            className="section-card rounded-3xl bg-white p-4 shadow-lg sm:p-6"
            aria-hidden
          >
            <span className="cold-skel cold-skel-title" />
            <span className="cold-skel cold-skel-label block" />
            <div className="mt-3 space-y-2.5">
              <span className="cold-skel cold-skel-row" />
              <span className="cold-skel cold-skel-row" />
              <span className="cold-skel cold-skel-row cold-skel-row-short" />
            </div>
            <span className="cold-skel cold-skel-label block" />
            <div className="mt-3 space-y-2.5">
              <span className="cold-skel cold-skel-row" />
              <span className="cold-skel cold-skel-row cold-skel-row-mid" />
            </div>
          </section>
        </div>
        <p className="sr-only">加载中…</p>
      </main>
    );
  }
  // 访客与登录均可进主应用；未登录用示例/本机草稿
  return (
    <main className="min-h-screen bg-paper text-ink pb-[env(safe-area-inset-bottom,0px)]">
      <div
        className={`mobile-sticky-top${headerCollapsed ? ' is-header-hidden' : ''}`}
      >
    <header className="app-header page-pad mx-auto flex max-w-[1920px] items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-sm font-bold text-white">
              M
            </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">财务规划</p>
              <p className="hidden truncate text-[11px] leading-tight text-slate-400 sm:block">
                消费承受力测算 · 访客可体验
              </p>
        </div>
      </div>
      <div className="relative flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
            <span className="sr-only" aria-live="polite">
              {saveStatusText}
            </span>
        <button
          type="button"
          className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink px-2.5 py-1.5 text-left text-white sm:gap-2 sm:px-3"
          title="扣掉本月支出后，还剩下的收入比例"
          aria-label={`收入还剩 ${result.remainDisposablePct}%`}
        >
              <span className="max-w-[4.5rem] text-[10px] leading-tight text-slate-300 sm:max-w-none sm:text-[11px]">
                收入还剩
              </span>
              <strong className="text-base tabular-nums leading-none sm:text-lg">
                {result.remainDisposablePct}
                <span className="text-[11px] font-normal text-slate-400">
                  %
                </span>
              </strong>
        </button>
        <div className="relative">
          {/* 登录态=用户名；访客=「访客」圆形菜单（下拉含登录/注册/重启） */}
          <button
            ref={headerMoreBtnRef}
            type="button"
            aria-expanded={headerMoreOpen}
            aria-haspopup="menu"
                aria-label={
                  headerMoreOpen
                    ? '收起菜单'
                    : authUser
                      ? `${authUser.username}，打开菜单`
                      : '访客，打开菜单'
                }
                title={
                  authUser
                    ? authUser.username
                    : '示例数据仅本机临时；注册使用默认数据，不绑定当前草稿'
                }
            onClick={() => setHeaderMoreOpen((v) => !v)}
            className="touch-btn flex min-h-9 max-w-[9rem] items-center gap-1 rounded-full border border-slate-200 bg-white py-1 pl-2.5 pr-1.5 text-ink hover:border-coral hover:text-coral-deep sm:max-w-[12rem]"
          >
            <span className="min-w-0 truncate text-[11px] font-semibold text-slate-600">
              {authUser ? authUser.username : '访客'}
            </span>
            <svg
              className={`h-3.5 w-3.5 shrink-0 transition-transform ${headerMoreOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
              {headerMorePresent &&
                createPortal(
            <>
                    <button
                      type="button"
                      data-state={headerMoreState}
                      className="header-more-mask fixed inset-0 cursor-default"
                      style={{
                        zIndex: Z_INDEX.mask,
                        pointerEvents:
                          headerMoreState === 'closed' ? 'none' : undefined,
                      }}
                      aria-label="关闭菜单"
                      onClick={() => setHeaderMoreOpen(false)}
                    />
              <div
                ref={headerMoreMenuRef}
                      data-state={headerMoreState}
                className="header-more-menu fixed w-52 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-lg"
                role="menu"
                      style={{
                        top: headerMorePos.top,
                        left: headerMorePos.left,
                        zIndex: Z_INDEX.topbarMenu,
                        pointerEvents:
                          headerMoreState === 'closed' ? 'none' : undefined,
                      }}
              >
                {authUser ? (
                  <>
                    <p className="px-2.5 py-1.5 text-[10px] text-slate-400">
                      {saveStatusText}
                    </p>
                          <div className="header-more-item-wrap">
                            <InstallToDesktop />
                          </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="header-more-item"
                            onClick={() => {
                              setHeaderMoreOpen(false);
                              void restartSite();
                            }}
                    >
                      重启网站
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="header-more-item text-red-600"
                            onClick={() => {
                              setHeaderMoreOpen(false);
                              void logoutSession().then(handleLogout);
                            }}
                    >
                      登出
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className="header-more-item"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        save();
                        router.push(authHref('login'));
                      }}
                    >
                      登录
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="header-more-item"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        setRegisterConfirmOpen(true);
                      }}
                    >
                      注册
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="header-more-item"
                            onClick={() => {
                              setHeaderMoreOpen(false);
                              void restartSite();
                            }}
                    >
                      重启网站
                    </button>
                  </>
                )}
              </div>
            </>,
            document.body,
          )}
        </div>
      </div>
    </header>
    {!authUser && (
      <div className="page-pad mx-auto max-w-[1920px] px-3 pb-1 sm:px-6 lg:px-10">
            <p className="guest-demo-banner">
              示例数据仅保存在本机 · 点数字即可修改
            </p>
      </div>
    )}
    </div>
    {/* ponytail: 侧栏从 xl 起、宽 ≤520——lg+720 会把左栏压到 ~450，xl:grid-cols-3 再把「月结余再投入」挤成竖排字 */}
    <section className="page-pad mx-auto grid max-w-[1920px] grid-cols-1 gap-2 px-3 pb-12 pt-3 sm:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,520px)] xl:px-10">
      <div className="min-w-0 space-y-2">
          <section
            className="decision-summary section-card rounded-3xl bg-white p-3 shadow-lg sm:p-4"
            aria-label="本月决策摘要"
          >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="min-w-0 rounded-2xl bg-[#f8faf9] px-2.5 py-2">
                <p className="text-[10px] font-semibold text-slate-400 sm:text-[11px]">
                  本月可用
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-ink sm:text-base">
                  {money(decisionSummary.monthlySpendable)}
                </p>
            </div>
            <div className="min-w-0 rounded-2xl bg-[#f8faf9] px-2.5 py-2">
                <p className="text-[10px] font-semibold text-slate-400 sm:text-[11px]">
                  月支出
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-ink sm:text-base">
                  {money(decisionSummary.monthlyExpense)}
                </p>
            </div>
            <div className="min-w-0 rounded-2xl bg-[#f8faf9] px-2.5 py-2">
                <p className="text-[10px] font-semibold text-slate-400 sm:text-[11px]">
                  扣支出后剩余
                </p>
                <p
                  className={`mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base ${decisionSummary.monthlySurplus < 0 ? 'text-red-600' : 'text-ink'}`}
                >
                  {money(decisionSummary.monthlySurplus)}
                </p>
            </div>
            <div className="min-w-0 rounded-2xl bg-[#f8faf9] px-2.5 py-2">
                <p className="text-[10px] font-semibold text-slate-400 sm:text-[11px]">
                  总资产
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-ink sm:text-base">
                  {money(decisionSummary.totalAssets)}
                </p>
            </div>
          </div>
          {decisionSummary.riskLine && (
              <p
                className="mt-2 text-[11px] font-medium leading-snug text-amber-800 sm:text-xs"
                role="status"
              >
                {decisionSummary.riskLine}
              </p>
          )}
        </section>
          <section
            id="sec-params"
            className="section-card scroll-mt-24 rounded-3xl bg-white p-4 shadow-lg sm:p-6"
          >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
              <SectionTitle
                title="财务参数"
                tip={
                  '填写收入、资产和每月理财安排。\n退休规划在「五险一金和个税 → 退休与社保」中设置；修改数字后会自动保存。'
                }
              />
            <button
              ref={planChangeBtnRef}
              type="button"
              onClick={() => setPlanChangeOpen((current) => !current)}
              className="text-sm font-semibold text-[#d9654a]"
            >
              {PLAN_CHANGE_ENTRY}
            </button>
            <InfoTip>{PLAN_CHANGE_TIP}</InfoTip>
          </div>
          <PlanChangePanel
            open={planChangeOpen}
            anchorRef={planChangeBtnRef}
            onClose={() => setPlanChangeOpen(false)}
            events={planChanges}
            baseSalary={salary}
            baseTakeHome={takeHomeIncome ?? result.net}
            baseReturnRate={returnRate}
            onChange={(next) => {
              setPlanChanges(next);
              window.dispatchEvent(new Event('money-manage-save'));
            }}
          />
          <div className="section-label flex flex-wrap items-center gap-2">
            收入信息
              <select
                aria-label="收入录入方式"
                className="field-input !mt-0 !w-auto max-w-full py-1 text-xs font-medium text-slate-700"
                value={incomeViewMode}
                onChange={(event) =>
                  setIncomeViewModeSafe(event.target.value as IncomeViewMode)
                }
              >
                <option value="detail">按税前工资</option>
                <option value="takehome">填到手收入</option>
            </select>
          </div>
          {incomeViewMode === 'takehome' ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Editable
                  label="每月到手收入"
                  tip={
                    '每月实际到账的钱，用于计算支出后剩余和资产走势。\n如果需要计算五险一金和个税，请切换为「按税前工资」。'
                  }
                  value={takeHomeIncome ?? result.net}
                  min={0}
                  step={1}
                  onChange={(value) => {
                    setTakeHomeIncome(value);
                  }}
                />
              {retirement.enabled && (
                <button
                  type="button"
                  className="field-row-mobile flex items-center justify-between gap-3 text-left text-sm text-slate-600"
                  onClick={() => setIncomeViewModeSafe('detail')}
                >
                  <span>
                      <span className="block font-medium text-slate-700">
                        退休规划已关联
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        预计退休 {retirementDate || '待完善'}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-coral-deep">
                      前往管理
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Editable
                  label="税前工资"
                  value={salary}
                  min={0}
                  step={1}
                  onChange={setSalary}
                />
              <SocialTaxBreakdown
                salary={salary}
                rows={result.socialRows}
                total={result.social}
                tax={result.tax}
                net={result.net}
                deductions={result.deductions}
                socialEnabled={socialEnabled}
                  onSocialEnabledChange={(value) => {
                    setSocialEnabled(value);
                    window.dispatchEvent(new Event('money-manage-save'));
                  }}
                insuranceBase={effectiveInsuranceBase}
                housingFundBase={effectiveHousingFundBase}
                insuranceFollowSalary={contributionBase == null}
                housingFollowSalary={housingFundBase == null}
                  onInsuranceFollowSalary={() => {
                    setContributionBase(null);
                    window.dispatchEvent(new Event('money-manage-save'));
                  }}
                  onHousingFollowSalary={() => {
                    setHousingFundBase(null);
                    window.dispatchEvent(new Event('money-manage-save'));
                  }}
                // SoftNumber：blur 才 onCommit（联动）；落盘由 SoftNumberInput 自行 money-manage-save，勿在 onCommit 再写盘
                  onInsuranceBaseChange={(value) => {
                    setContributionBase(value);
                  }}
                  onHousingFundBaseChange={(value) => {
                    setHousingFundBase(value);
                  }}
                  onHousingPersonalChange={(value) => {
                    setSocialRates((current) => ({
                      ...current,
                      住房公积金: {
                        ...current['住房公积金'],
                        personal: clamp(value, 5, 12),
                      },
                    }));
                  }}
                  onRentChange={(value) => {
                    setRentEnabled(value);
                    window.dispatchEvent(new Event('money-manage-save'));
                  }}
                  onElderlyChange={(value) => {
                    setElderlyEnabled(value);
                    window.dispatchEvent(new Event('money-manage-save'));
                  }}
                retirement={retirement}
                retirementDate={retirementDate}
                onRetirementChange={updateRetirement}
              />
                <Metric
                  label="到手收入"
                  value={money(result.net)}
                  detail={
                    '税前工资 − 五险一金 − 本月个税。\n退休规划在「五险一金和个税 → 退休与社保」二级弹层设置，不改变到账口径。'
                  }
                />
            </div>
          )}
            <div className="section-label">总资产与备用金</div>
          {/* 仅 sm:2 列；Asset/再投入用 col-span-2。勿加 xl:3——侧栏左栏不够宽会竖排字 */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <AssetLinkedEditor
                totalAssets={totalAssets}
                cash={cash}
                invest={invest}
                investRatio={investRatio}
                onTotal={updateTotalAssets}
                onCash={updateCash}
                onCashByMonths={updateCashByMonths}
                onAnnualSpend={updateAnnualSpend}
                onInvestAmount={updateInvestByAmount}
                onInvestRatio={updateInvestByRatio}
                emergency={emergencySetting}
                planMonthly={planMonthly}
                adjustedAvailableAssets={result.adjustedAvailableAssets}
                monthlyExpenses={result.monthlyExpenses}
                onMonthsPlanChecked={setMonthsPlanChecked}
              />
              <Editable
                label="年化收益率"
                value={returnRate}
                min={0}
                max={100}
                step={0.1}
                suffix="%"
                kind="rangedPercent"
                onChange={setReturnRate}
              />
              <ReinvestEditor
                setting={reinvestSetting}
                monthlySurplus={Math.max(0, result.surplus)}
                onChange={(next) => {
                  setReinvestMode(next.mode);
                  setReinvestRate(next.rate);
                  setReinvestAmount(next.amount);
                }}
              />
          </div>
        </section>
          <section
            id="sec-expenses"
            className="section-card scroll-mt-24 rounded-3xl bg-white p-4 shadow-lg sm:p-6"
          >
            <div>
              <SectionTitle
                title="支出管理"
                tip={
                  '名称、类型、金额等一律点「编辑」修改。\n点「分析」打开对比面板，勾选任意支出看叠在一起的影响。'
                }
              />
            </div>
            <div className="table-wrap mt-5 hidden md:block">
              <table>
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>类型</th>
                    <th>本月支出</th>
                    <th className="cell-wrap">还款信息</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id} data-expense-anchor={expense.id}>
                      <td>
                        <span className="text-sm text-slate-700">
                          {formatTextFieldDisplay(expense.name, '未命名')}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-slate-600">
                          {formatExpenseMode(expense.mode)}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono text-sm tabular-nums text-slate-700">
                          {formatExpensePayment(expense)}
                        </span>
                      </td>
                      <td className="cell-wrap">
                        <span className="text-sm text-slate-500">
                          {expense.mode === 'installment'
                            ? formatExpenseInstallment(expense)
                            : '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <ExpenseEditButton
                            expense={expense}
                            onChange={(patch) => {
                              updateExpense(expense.id, patch);
                              saveEvent();
                            }}
                            retirementDate={
                              retirement.enabled ? retirementDate : undefined
                            }
                          />
                          <ExpenseAnalyzeButton
                            expense={expense}
                            financeInput={financeInput}
                            reinvest={reinvestSetting}
                            retirementDate={
                              retirement.enabled ? retirementDate : undefined
                            }
                            planChanges={planChanges}
                          />
                          <button
                            type="button"
                            onClick={(event) =>
                              requestRemoveExpense(expense, event.currentTarget)
                            }
                            className="text-xs text-red-500 hover:underline"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 space-y-3 md:hidden">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  data-expense-anchor={expense.id}
                  className="expense-card space-y-2"
                >
            <div className="expense-card-head">
              <div className="expense-card-title min-w-0 flex-1">
                      <span className="truncate text-sm font-semibold text-slate-800">
                        {formatTextFieldDisplay(expense.name, '未命名')}
                      </span>
              </div>
              <div className="expense-card-amount min-w-0 shrink">
                <div className="text-right">
                        <p className="text-[11px] text-slate-400">本月支出</p>
                        <p className="font-mono text-sm font-semibold tabular-nums text-slate-700">
                          {formatExpensePayment(expense)}
                        </p>
                </div>
              </div>
            </div>
            <div className="expense-card-meta">
                    <span className="expense-meta-chip text-xs text-slate-600">
                      {formatExpenseMode(expense.mode)}
                    </span>
            </div>
            {expense.mode === 'installment' && (
              <div className="field-row-mobile">
                      <span>还款信息</span>
                      <span className="text-sm text-slate-500">
                        {formatExpenseInstallment(expense)}
                      </span>
              </div>
            )}
            <div className="expense-card-actions">
              <div className="flex flex-1 gap-2">
                      <ExpenseEditButton
                        expense={expense}
                        onChange={(patch) => {
                          updateExpense(expense.id, patch);
                          saveEvent();
                        }}
                        retirementDate={
                          retirement.enabled ? retirementDate : undefined
                        }
                      />
                      <div className="flex-1">
                        <ExpenseAnalyzeButton
                          expense={expense}
                          financeInput={financeInput}
                          reinvest={reinvestSetting}
                          retirementDate={
                            retirement.enabled ? retirementDate : undefined
                          }
                          planChanges={planChanges}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) =>
                        requestRemoveExpense(expense, event.currentTarget)
                      }
                      className="touch-btn rounded-xl border border-red-100 px-3 text-xs font-semibold text-red-500"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <ExpenseAddButton
                onConfirm={confirmAddExpense}
                retirementDate={retirement.enabled ? retirementDate : undefined}
              />
            </div>
          </section>
        </div>
        <div
          id="sec-charts"
          className="min-w-0 w-full scroll-mt-24 xl:sticky xl:top-4 xl:self-start"
        >
          <section className="section-card mb-2 rounded-3xl bg-white p-4 shadow-lg sm:p-6">
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <SectionTitle
                title="资产走势"
                tip={
                  '预计总资产 = 理财资产 + 现金余额。每月先扣当月支出（分期：首月仅首付，次月起月供）；理财占比 > 0 时按比例拆分剩余资产，为 0 时按每月理财投入累积。\n现金低于备用金水位时从理财赎回补足。'
                }
              />
              <button
                ref={assetDetailBtnRef}
                type="button"
                onClick={() => setShowAssetDetails((current) => !current)}
                className="text-sm font-semibold text-coral-deep"
              >
                查看明细
              </button>
              <FloatPanel
                open={showAssetDetails}
                anchorRef={assetDetailBtnRef}
                onClose={() => setShowAssetDetails(false)}
                width={620}
                headerTitle="月度资产明细"
              >
                <div className="table-wrap table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>月份</th>
                        <th>现金余额</th>
                        <th>理财资产</th>
                        <th>预计总资产</th>
                        <th>
                          <span className="inline-flex items-center gap-1">
                            真正可动用的钱
                            <InfoTip>{ADJUSTED_AVAILABLE_ASSETS_TIP}</InfoTip>
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyAssetForecast.map((row) => (
                        <tr key={row.month}>
                          <td>{row.label}</td>
                          <td>{money(row.cash)}</td>
                          <td>{money(row.investment)}</td>
                          <td>{money(row.total)}</td>
                          <td>{money(row.available)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FloatPanel>
            </div>
            <ChartHost className="mt-5" option={assetChartOption} />
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
              <button
                type="button"
                onClick={() =>
                  setVisibleAssetLines((current) => ({
                    ...current,
                    cash: !current.cash,
                  }))
                }
                className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleAssetLines.cash ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}
              >
                <i className="h-2 w-2 rounded-full bg-slate-400" />
                现金余额
              </button>
              <button
                type="button"
                onClick={() =>
                  setVisibleAssetLines((current) => ({
                    ...current,
                    investment: !current.investment,
                  }))
                }
                className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleAssetLines.investment ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}
              >
                <i className="h-2 w-2 rounded-full bg-coral" />
                理财资产
              </button>
              <button
                type="button"
                onClick={() =>
                  setVisibleAssetLines((current) => ({
                    ...current,
                    total: !current.total,
                  }))
                }
                className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleAssetLines.total ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}
              >
                <i className="h-2 w-2 rounded-full bg-ink" />
                预计总资产
              </button>
              </div>
          </section>
          <section className="section-card rounded-3xl bg-white p-4 shadow-lg sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle
                title="每月还剩多少"
                tip={
                  '自今日起模拟 30 年。\n这条线表示扣掉当月全部支出后，还能留下多少收入；低于 0% 表示当月支出超过收入。'
                }
              />
              <span className="hidden text-sm text-slate-500 sm:inline">
                当前方案 · 360 个月
              </span>
            </div>
            <ChartHost
              className="mx-auto mt-4 sm:mt-8"
              option={remainShareChartOption}
            />
            <div className="chart-year-labels mt-3 flex justify-between font-semibold text-slate-600 sm:mt-4 sm:text-base">
              <span>{forecastYearLabel(0)}</span>
              <span>{forecastYearLabel(5)}</span>
              <span>{forecastYearLabel(15)}</span>
              <span>{forecastYearLabel(30)}</span>
          </div>
          </section>
          <section className="section-card mt-2 rounded-3xl bg-white p-4 shadow-lg sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle
                title="每月收入怎么分"
                tip={
                  '三条线分别表示：还款占收入、全部支出占收入、扣除支出后剩余的收入。分期按当月真实月供计算。'
                }
              />
              <span className="hidden text-sm text-slate-500 sm:inline">
                DTI · 支出 · 储蓄
              </span>
            </div>
            <ChartHost className="mt-4 sm:mt-8" option={cashFlowChartOption} />
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
              <button
                type="button"
                onClick={() =>
                  setVisibleCashFlowLines((current) => ({
                    ...current,
                    dti: !current.dti,
                  }))
                }
                className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleCashFlowLines.dti ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}
              >
                <i className="h-2 w-2 rounded-full bg-coral" />
                还款占收入
              </button>
              <button
                type="button"
                onClick={() =>
                  setVisibleCashFlowLines((current) => ({
                    ...current,
                    expense: !current.expense,
                  }))
                }
                className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleCashFlowLines.expense ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}
              >
                <i className="h-2 w-2 rounded-full bg-slate-400" />
                支出占收入
              </button>
              <button
                type="button"
                onClick={() =>
                  setVisibleCashFlowLines((current) => ({
                    ...current,
                    savings: !current.savings,
                  }))
                }
                className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleCashFlowLines.savings ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}
              >
                <i className="h-2 w-2 rounded-full bg-[#3d8f6e]" />
                收入剩余
              </button>
            </div>
            <div className="chart-year-labels mt-3 flex justify-between font-semibold text-slate-600 sm:mt-4 sm:text-base">
              <span>{forecastYearLabel(0)}</span>
              <span>{forecastYearLabel(5)}</span>
              <span>{forecastYearLabel(15)}</span>
              <span>{forecastYearLabel(30)}</span>
            </div>
          </section>
        </div>{' '}
      </section>
      <footer className="page-pad mx-auto max-w-[1920px] px-3 pb-8 text-xs text-slate-400 sm:px-6 lg:px-10">
        原型版 · 个税和五险一金为月度估算，结果仅用于个人财务规划参考
      </footer>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        anchorRef={deleteAnchorRef}
        title={pendingDelete?.title ?? '确认删除'}
        message={pendingDelete?.message ?? ''}
        confirmLabel="确认删除"
        confirmTone="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          removeExpense(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
      <ConfirmDialog
        open={registerConfirmOpen}
        anchorRef={headerMoreBtnRef}
        title="确认注册"
        message={REGISTER_DEFAULT_DATA_MESSAGE}
        confirmLabel="继续注册"
        confirmTone="primary"
        onCancel={() => setRegisterConfirmOpen(false)}
        onConfirm={() => {
          setRegisterConfirmOpen(false);
          save();
          router.push(authHref('register'));
        }}
      />
    </main>
  );
}

/** 支出设置表单；autoFocusName 用于新增面板打开后聚焦名称 */
function ExpenseSettingsFields({
  value,
  onChange,
  retirementDate,
  autoFocusName = false,
}: {
  value: Expense;
  onChange: (patch: Partial<Expense>) => void;
  retirementDate?: string;
  autoFocusName?: boolean;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!autoFocusName) return;
    // 等 FloatPanel portal / sheet 落位后再 focus（不全选，避免打断光标）
    const timer = window.setTimeout(() => {
      nameRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [autoFocusName]);
  const modes: Array<{ value: Expense['mode']; label: string }> = [
    { value: 'fixed', label: '固定金额' },
    { value: 'percentage', label: '按比例' },
    { value: 'installment', label: '分期' },
    { value: 'one_time', label: '一次性' },
  ];
  return (
    <div className="expense-settings-form grid gap-3">
      <label className="block text-xs text-slate-500">
        名称
        <input
          ref={nameRef}
          autoFocus={autoFocusName}
          className="field-input mt-1"
          value={value.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </label>
      <div>
        <p className="text-xs text-slate-500">类型</p>
        {/* 移动：大触控分段；桌面：下拉 */}
        <div className="mt-1 grid grid-cols-2 gap-2 sm:hidden">
          {modes.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange({ mode: item.value })}
              className={`touch-btn rounded-xl border px-2 text-xs font-semibold ${value.mode === item.value ? 'border-ink bg-ink text-white' : 'border-slate-200 bg-white text-slate-600'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <select
          className="field-input mt-1 hidden sm:block"
          value={value.mode}
          onChange={(event) =>
            onChange({ mode: event.target.value as Expense['mode'] })
          }
        >
          {modes.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="settings-summary rounded-xl border border-coral/20 bg-[#fff7f4] px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs text-slate-500">当前月付</p>
          <p className="font-mono text-base font-semibold tabular-nums text-coral-ink">
            {formatExpensePayment(value)}
          </p>
        </div>
      </div>
      {(value.mode === 'fixed' || value.mode === 'one_time') && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-500">
            {value.mode === 'one_time' ? '发生时间（默认当月）' : '开始时间'}
            <input
              className="field-input mt-1"
              type="date"
              value={(
                value.startDate ||
                (value.mode === 'one_time'
                  ? defaultOneTimeDate()
                  : todayDateKey())
              ).slice(0, 10)}
              onChange={(event) =>
                onChange({
                  startDate:
                    event.target.value ||
                    (value.mode === 'one_time'
                      ? defaultOneTimeDate()
                      : todayDateKey()),
                  endDate:
                    value.mode === 'one_time'
                      ? event.target.value || defaultOneTimeDate()
                      : value.endDate,
                })
              }
            />
          </label>
          <label className="block text-xs text-slate-500">
            {value.mode === 'one_time' ? '金额' : '每月金额'}
            <SoftNumberInput
              min={0}
              step={100}
              value={value.amount}
              persistOnBlur={false}
              onCommit={(n) => onChange({ amount: n })}
            />
          </label>
        </div>
      )}
      {value.mode === 'percentage' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-500">
            开始时间
            <input
              className="field-input mt-1"
              type="date"
              value={(value.startDate || todayDateKey()).slice(0, 10)}
              onChange={(event) => onChange({ startDate: event.target.value })}
            />
          </label>
          <label className="block text-xs text-slate-500">
            收入比例
            <SoftNumberInput
              min={0}
              max={100}
              step={1}
              suffix="%"
              value={value.rate || 0}
              persistOnBlur={false}
              onCommit={(n) => onChange({ rate: n })}
            />
          </label>
        </div>
      )}
      {value.mode === 'installment' && (
        <InstallmentSettingsPanel
          expense={value}
          onChange={onChange}
          retirementDate={retirementDate}
        />
      )}
    </div>
  );
}

function ExpenseEditButton({
  expense,
  onChange,
  retirementDate,
}: {
  expense: Expense;
  onChange: (patch: Partial<Expense>) => void;
  retirementDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Expense | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const openPanel = () => {
    setDraft(cloneExpenseDraft(expense));
    setOpen(true);
  };
  const closePanel = () => {
    setOpen(false);
  };
  const patchDraft = (patch: Partial<Expense>) =>
    setDraft((current) => {
    if (!current) return current;
    const next = { ...current, ...patch };
    if (next.mode === 'one_time') {
      if (!next.startDate) next.startDate = defaultOneTimeDate();
      next.endDate = next.startDate;
    } else if (!next.startDate) {
      next.startDate = todayDateKey();
    }
    if (next.mode === 'installment') {
      const start = next.startDate || todayDateKey();
        next.term = clampInstallmentTerm(
          start,
          next.term || 1,
          Boolean(next.followRetirement),
          retirementDate,
        );
      const span = resolveExpenseSpan(next, { retirementDate });
      next.endDate = span.end;
    }
    return next;
  });
  const save = () => {
    if (!draft) return;
    onChange(draft);
    closePanel();
  };
  return (
    <div className="relative inline-block">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        className="touch-btn shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-ink hover:border-coral hover:text-coral-deep sm:border-0 sm:bg-transparent sm:px-1 sm:text-coral-deep sm:hover:underline"
        title="打开支出设置面板"
      >
        编辑
      </button>
      {draft && (
        <FloatPanel
          open={open}
          anchorRef={anchorRef}
          onClose={closePanel}
          onExited={() => setDraft(null)}
          width={420}
          maxHeightVh={85}
          center
          headerTitle="编辑支出"
          mode="auto"
          density="panel"
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closePanel}
                className="touch-btn flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={save}
                className="touch-btn flex-1 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-hover"
              >
                保存
              </button>
            </div>
          }
        >
          <p className="text-xs text-slate-400">
            名称、类型、金额、分期等在此修改；点「保存」写回列表。
          </p>
          <div className="mt-3">
            <ExpenseSettingsFields
              value={draft}
              onChange={patchDraft}
              retirementDate={retirementDate}
            />
          </div>
        </FloatPanel>
      )}
    </div>
  );
}

function ExpenseAddButton({
  onConfirm,
  retirementDate,
}: {
  onConfirm: (expense: Expense) => void;
  retirementDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Expense | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const openPanel = () => {
    setDraft({
      id: 'draft-new',
      name: '新支出',
      category: '',
      mode: 'fixed',
      amount: 0,
      startDate: todayDateKey(),
    });
    setOpen(true);
  };
  const closePanel = () => {
    setOpen(false);
  };
  const patchDraft = (patch: Partial<Expense>) =>
    setDraft((current) => {
    if (!current) return current;
    const next = { ...current, ...patch };
    if (next.mode === 'one_time') {
      if (!next.startDate) next.startDate = defaultOneTimeDate();
      next.endDate = next.startDate;
    } else if (!next.startDate) {
      next.startDate = todayDateKey();
    }
    if (next.mode === 'installment') {
      const start = next.startDate || todayDateKey();
        next.term = clampInstallmentTerm(
          start,
          next.term || 36,
          Boolean(next.followRetirement),
          retirementDate,
        );
      const span = resolveExpenseSpan(next, { retirementDate });
      next.endDate = span.end;
    }
    return next;
  });
  const confirm = () => {
    if (!draft) return;
    onConfirm({
      ...draft,
      id: uid(),
      name: (draft.name || '').trim() || '新支出',
      category: (draft.category || '').trim(),
    });
    closePanel();
  };
  return (
    <div className="relative inline-block w-full sm:w-auto">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        className="touch-btn w-full rounded-xl bg-coral px-4 text-sm font-semibold text-white hover:bg-coral-hover sm:w-auto"
      >
        + 新增支出
      </button>
      {draft && (
        <FloatPanel
          open={open}
          anchorRef={anchorRef}
          onClose={closePanel}
          onExited={() => setDraft(null)}
          width={420}
          maxHeightVh={85}
          center
          headerTitle="新增支出"
          mode="auto"
          density="panel"
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closePanel}
                className="touch-btn flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirm}
                className="touch-btn flex-1 rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white hover:bg-coral-hover"
              >
                确认添加
              </button>
            </div>
          }
        >
          <p className="text-xs text-slate-400">
            填写后点「确认添加」才会写入列表；关闭或取消不保存。
          </p>
          <div className="mt-3">
            <ExpenseSettingsFields
              value={draft}
              onChange={patchDraft}
              retirementDate={retirementDate}
              autoFocusName
            />
          </div>
        </FloatPanel>
      )}
    </div>
  );
}

function ExpenseAnalyzeButton({
  expense,
  financeInput,
  reinvest,
  retirementDate,
  planChanges = [],
}: {
  expense: Expense;
  financeInput: FinanceInput;
  reinvest: ReinvestSetting;
  retirementDate?: string;
  planChanges?: PlanChangeEvent[];
}) {
  const [open, setOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([expense.id]);
  // 虚拟系列：把「剩余可支配」按闲钱投资设置拆成投资 + 可花费剩余
  const [includeInvestShare, setIncludeInvestShare] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  // 任一行「分析」打开同一面板；默认勾上该行，可改选任意支出
  const openAnalyze = () => {
    setCompareIds([expense.id]);
    setOpen(true);
  };
  const closeAnalyze = () => setOpen(false);
  const toggleCompareId = (id: string) => {
    setCompareIds((ids) => {
      if (ids.includes(id)) {
        if (ids.length === 1) return ids; // 至少保留一项
        return ids.filter((itemId) => itemId !== id);
      }
      return [...ids, id];
    });
  };
  // 勾选集合：表内顺序，用已保存支出（无本行草稿）
  const selectedExpenses = useMemo(() => {
    const idSet = new Set(compareIds);
    return financeInput.expenses.filter((item) => idSet.has(item.id));
  }, [compareIds, financeInput.expenses]);
  const allExpenseIds = useMemo(
    () => financeInput.expenses.map((item) => item.id),
    [financeInput.expenses],
  );

  // 始终 isolated：消费前=无支出，测算=仅勾选集合
  const before = useMemo(
    () => computeFinanceResult({ ...financeInput, expenses: [] }),
    [financeInput],
  );
  const after = useMemo(
    () => computeFinanceResult({ ...financeInput, expenses: selectedExpenses }),
    [financeInput, selectedExpenses],
  );

  // KPI「30 年资产差额」仍用消费前/测算两端资产（叠加计划变更）
  const assetBefore = useMemo(() => {
    const total = financeInput.cash + financeInput.invest;
    const ratio = total > 0 ? (financeInput.invest / total) * 100 : 0;
    return forecastYearlyTotals(
      financeInput.cash,
      financeInput.invest,
      financeInput.returnRate,
      reinvest,
      ratio,
      [],
      retirementDate,
      planChanges,
      { ...financeInput, expenses: [] },
    );
  }, [financeInput, reinvest, retirementDate, planChanges]);
  const assetAfter = useMemo(() => {
    const total = financeInput.cash + financeInput.invest;
    const ratio = total > 0 ? (financeInput.invest / total) * 100 : 0;
    return forecastYearlyTotals(
      financeInput.cash,
      financeInput.invest,
      financeInput.returnRate,
      reinvest,
      ratio,
      selectedExpenses,
      retirementDate,
      planChanges,
      { ...financeInput, expenses: selectedExpenses },
    );
  }, [financeInput, reinvest, selectedExpenses, retirementDate, planChanges]);
  // ponytail: 分析图拆层仍吃 %；金额模式用「典型月结余」换算等效比例
  const chartInvestRate = useMemo(() => {
    const typicalSurplus = Math.max(
      0,
      before.net + before.investmentIncome - before.recurringMonthlyExpenses,
    );
    return effectiveInvestRate(typicalSurplus, reinvest);
  }, [
    before.net,
    before.investmentIncome,
    before.recurringMonthlyExpenses,
    reinvest,
  ]);
  const expenseShareOption = useMemo(() => {
    // 前缀绝对占比 → 支出堆叠；勾选投资时把剩余可支配拆成 投资 + 可花费剩余
    const items = selectedExpenses.map((item) => ({
      id: item.id,
      name: item.name || '未命名',
    }));
    const cumulatives: number[][] = [];
    let labels: string[] = [];
    for (let prefix = 0; prefix <= selectedExpenses.length; prefix += 1) {
      const list = buildPrefixExpenses(
        financeInput.expenses,
        selectedExpenses,
        prefix,
        'isolated',
      );
      const rows = forecastExpenseShareByMonth(
        list,
        (index) =>
          financeAtPlanMonth(
            { ...financeInput, expenses: list },
            planChanges,
            yearMonthOffset(index),
          ).net,
        (index) =>
          financeAtPlanMonth(
            { ...financeInput, expenses: list },
            planChanges,
            yearMonthOffset(index),
          ).investmentIncome,
        360,
        retirementDate,
      );
      if (!labels.length) labels = rows.map((row) => row.label);
      cumulatives.push(rows.map((row) => row.pct));
    }
    const layers = toStackedLayersColored(cumulatives, items, allExpenseIds);
    const windows = buildTemporalWindows(selectedExpenses, { retirementDate });
    const topExpense = layers[layers.length - 1]?.cumulative ?? [];
    const savingsName = includeInvestShare ? SPENDABLE_REMAIN_NAME : '结余';
    const remainSeries = includeInvestShare
      ? remainInvestSpendableSeries(topExpense, chartInvestRate, {
          disposableIncome: before.net,
        })
      : savingsFillTo100Series(topExpense, { name: savingsName });
    const series = [
      ...impactTemporalStackedSeries(layers, windows),
      ...remainSeries,
    ];
    const seriesValues = series.flatMap((row) =>
      (Array.isArray(row.data) ? row.data : [])
        .filter(
          (value): value is number =>
            value !== null && Number.isFinite(Number(value)),
        )
        .map(Number),
    );
    // 用真实峰值稀疏警告线；yMax 再盖住所选档位（首月重度超支时省略中间档）
    const dataPeak = seriesValues.length ? Math.max(...seriesValues) : 0;
    const expenseWarnAxes = pickExpenseShareWarnYAxes(dataPeak);
    const warnCeil = expenseWarnAxes.length
      ? Math.max(...expenseWarnAxes)
      : 100;
    const yMax = Math.max(
      warnCeil,
      seriesValues.length ? Math.max(100, ...seriesValues) : 100,
    );
    const yMin = seriesValues.length ? Math.min(0, ...seriesValues) : 0;
    // 第一层是不算所选支出的零高度辅助层，只参与堆叠归因，不放进用户图例。
    const legendNames = [
      ...layers.slice(1).map((layer) => layer.name),
      ...(includeInvestShare
        ? [INVEST_SHARE_NAME, SPENDABLE_REMAIN_NAME]
        : [savingsName]),
    ];
    // 可支配 100% + 按峰值稀疏的超支警告线 + 计划变更竖线；挂最后一条 series
    const expenseWarnMeta: Record<
      number,
      {
        name: string;
        lineStyle: { type: 'solid' | 'dashed'; color: string; width: number };
        label: { formatter: string; color: string };
      }
    > = {
      100: {
        name: '可支配 100%',
        lineStyle: { type: 'solid', color: BRAND.ink, width: 1.5 },
        label: { formatter: '可支配 100%', color: BRAND.ink },
      },
      110: {
        name: '警告 110%',
        lineStyle: { type: 'dashed', color: '#f59e0b', width: 1 },
        label: { formatter: '警告 110%', color: '#b45309' },
      },
      120: {
        name: '警告 120%',
        lineStyle: { type: 'dashed', color: '#f97316', width: 1 },
        label: { formatter: '警告 120%', color: '#c2410c' },
      },
      150: {
        name: '警告 150%',
        lineStyle: { type: 'dashed', color: '#dc2626', width: 1 },
        label: { formatter: '警告 150%', color: '#b91c1c' },
      },
    };
    const shareWarnMarkLine = {
      silent: true,
      symbol: 'none' as const,
      label: { position: 'insideEndTop' as const, fontSize: 10, distance: 2 },
      data: [
        ...expenseWarnAxes.map((yAxis) => ({
          yAxis,
          ...expenseWarnMeta[yAxis],
        })),
        ...planChangeMarkLinesForYearMonthAxis(planChanges),
      ],
    };
    const seriesWithMark = series.length
      ? [
          ...series.slice(0, -1),
          { ...series[series.length - 1], markLine: shareWarnMarkLine },
        ]
      : series;
    return {
      animation: false,
      color: [
        ...layers.map((layer) => layer.color),
        ...(includeInvestShare
          ? [INVEST_SHARE_COLOR, SAVINGS_COLOR]
          : [SAVINGS_COLOR]),
      ],
      // 自下而上：dataZoom → legend → 旋转日期；grid.bottom 留足三者间距，避免挡绘图区
      legend: {
        type: 'scroll',
        bottom: 36,
        data: legendNames,
        textStyle: { fontSize: 11 },
      },
      grid: {
        left:
          typeof window !== 'undefined' && window.innerWidth < 640 ? 40 : 48,
        right:
          typeof window !== 'undefined' && window.innerWidth < 640 ? 8 : 16,
        top: 28,
        bottom:
          typeof window !== 'undefined' && window.innerWidth < 640 ? 100 : 118,
      },
      tooltip: {
        trigger: 'axis',
        formatter: (
          params: Array<{
            seriesName: string;
            value: number | null;
            marker: string;
            axisValue: string;
            seriesType?: string;
          }>,
        ) => {
          const rows = params.filter(
            (row) =>
              row.value !== null &&
              row.value !== undefined &&
              Number.isFinite(Number(row.value)),
          );
          if (!rows.length) return '';
          const remainNames = new Set([
            savingsName,
            INVEST_SHARE_NAME,
            SPENDABLE_REMAIN_NAME,
          ]);
          const expenseRows = rows.filter(
            (row) =>
              !remainNames.has(row.seriesName) &&
              !String(row.seriesName).endsWith('·垫'),
          );
          const remainRows = rows.filter(
            (row) =>
              row.seriesName === INVEST_SHARE_NAME ||
              row.seriesName === savingsName ||
              row.seriesName === SPENDABLE_REMAIN_NAME,
          );
          const stackedRows = expenseRows.filter(
            (row) => row.seriesType !== 'scatter',
          );
          const scatterRows = expenseRows.filter(
            (row) => row.seriesType === 'scatter',
          );
          let expenseTotal = stackedRows.reduce(
            (sum, row) => sum + Number(row.value),
            0,
          );
          if (scatterRows.length) {
            expenseTotal = Math.max(
              expenseTotal,
              ...scatterRows.map((row) => Number(row.value)),
            );
          }
          const remainTotal = remainRows.reduce(
            (sum, row) => sum + Number(row.value),
            0,
          );
          const head = rows[0]?.axisValue ?? '';
          const body = rows
            .filter((row) => !String(row.seriesName).endsWith('·垫'))
            .map(
              (row) =>
                `${row.marker}${row.seriesName}：${Number(row.value).toFixed(1)}%`,
            )
            .join('<br/>');
          return `${head}<br/>${body}<br/>支出合计：${expenseTotal.toFixed(1)}%<br/>剩余可支配：${remainTotal.toFixed(1)}%`;
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLabel: (() => {
          const narrow =
            typeof window !== 'undefined' && window.innerWidth < 640;
          return {
            fontSize: 10,
            color: '#64748b',
            interval: monthAxisInterval(narrow),
            rotate: monthAxisRotate(narrow),
            hideOverlap: true,
            margin: 12,
            formatter: (value: string) =>
              formatYearMonthChartAxisLabel(value, narrow),
          };
        })(),
      },
      yAxis: {
        type: 'value',
        min: yMin < 0 ? Math.floor(yMin / 10) * 10 : 0,
        max: Math.ceil(yMax / 10) * 10,
        axisLabel: { fontSize: 10, color: '#64748b', formatter: '{value}%' },
        splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', height: 18, bottom: 8, start: 0, end: 100 },
      ],
      series: seriesWithMark,
    };
  }, [
    selectedExpenses,
    financeInput,
    allExpenseIds,
    retirementDate,
    includeInvestShare,
    chartInvestRate,
    before.net,
    planChanges,
  ]);

  const assetCompareOption = useMemo(() => {
    const labels = assetBefore.map((row) => row.label);
    const beforeTotals = assetBefore.map((row) => row.total);
    const afterTotals = assetAfter.map((row) => row.total);
    const { min: yMin, max: yMax } = assetAxisBounds([
      ...beforeTotals,
      ...afterTotals,
    ]);
    const narrow = typeof window !== 'undefined' && window.innerWidth < 640;
    const planMarks = planChangeMarkLinesForYearLabelAxis(
      planChanges,
      forecastYearLabel,
    );
    const afterSeries: {
      name: string;
      type: string;
      smooth: boolean;
      symbol: string;
      data: number[];
      lineStyle: { color: string; width: number };
      areaStyle: { color: string };
      markLine?: { silent: boolean; symbol: string; data: typeof planMarks };
    } = {
      name: '算上所选支出 · 预计总资产',
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: afterTotals,
      lineStyle: { color: BRAND.coral, width: 3 },
      areaStyle: { color: 'rgba(240,127,98,0.08)' },
    };
    if (planMarks.length) {
      afterSeries.markLine = {
        silent: true,
        symbol: 'none',
        data: planMarks,
      };
    }
    return {
      animation: false,
      legend: {
        type: 'scroll',
        bottom: 8,
        data: ['不算所选支出 · 预计总资产', '算上所选支出 · 预计总资产'],
        textStyle: { fontSize: 11 },
      },
      grid: {
        left: narrow ? 44 : 64,
        right: narrow ? 12 : 24,
        top: 28,
        bottom: narrow ? 56 : 48,
      },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: number) => money(Number(value)),
        formatter: (
          params: Array<{
            seriesName: string;
            value: number;
            marker: string;
            axisValue: string;
          }>,
        ) => {
          if (!params?.length) return '';
          const head = params[0]?.axisValue ?? '';
          const body = params
            .map(
              (row) =>
                `${row.marker}${row.seriesName}：${money(Number(row.value))}`,
            )
            .join('<br/>');
          const beforeV = params.find((row) =>
            row.seriesName.startsWith('不算所选支出'),
          )?.value;
          const afterV = params.find((row) =>
            row.seriesName.startsWith('算上所选支出'),
          )?.value;
          const delta =
            beforeV != null && afterV != null
              ? Number(afterV) - Number(beforeV)
              : null;
          const deltaLine =
            delta == null
              ? ''
              : `<br/>差额（算上支出 − 不算支出）：${delta >= 0 ? '+' : ''}${money(delta)}`;
          return `${head}<br/>${body}${deltaLine}`;
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLabel: {
          fontSize: 10,
          color: '#64748b',
          interval: narrow ? 4 : 2,
          hideOverlap: true,
          formatter: (value: string) =>
            formatAssetChartAxisLabel(value, narrow),
        },
      },
      yAxis: {
        type: 'value',
        min: yMin,
        max: yMax,
        axisLabel: {
          fontSize: 10,
          color: '#64748b',
          formatter: (value: number) => {
            const n = Number(value);
            if (Math.abs(n) >= 10000) return `${Math.round(n / 10000)}万`;
            return String(Math.round(n));
          },
        },
        splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } },
      },
      series: [
        {
          name: '不算所选支出 · 预计总资产',
          type: 'line',
          smooth: true,
          symbol: 'none',
          data: beforeTotals,
          lineStyle: { color: '#94a3b8', width: 2.5 },
          areaStyle: { color: 'rgba(148,163,184,0.10)' },
        },
        afterSeries,
      ],
    };
  }, [assetBefore, assetAfter, planChanges]);

  const deltaTotal30 =
    (assetAfter.at(-1)?.total ?? 0) - (assetBefore.at(-1)?.total ?? 0);
  const monthlySurplusImpact = after.surplus - before.surplus;
  const monthlyExpenseImpact = after.monthlyExpenses - before.monthlyExpenses;
  const remainShareImpact =
    after.remainDisposablePct - before.remainDisposablePct;
  const selectedNames = selectedExpenses
    .map((item) => item.name || '未命名')
    .join('、');
  const conclusion = `${selectedNames}每月让结余${monthlySurplusImpact <= 0 ? '减少' : '增加'}${money(Math.abs(monthlySurplusImpact))}，每月可用收入${remainShareImpact <= 0 ? '减少' : '增加'}${Math.abs(roundPct(remainShareImpact))}个百分点；按当前方案持续 30 年，预计总资产${deltaTotal30 <= 0 ? '减少' : '增加'}${money(Math.abs(deltaTotal30))}。`;
  const kpiCards = [
    {
      label: '每月少结余',
      value: `${monthlySurplusImpact <= 0 ? '-' : '+'}${money(Math.abs(monthlySurplusImpact))}`,
      sub: `${money(before.surplus)} → ${money(after.surplus)}`,
      delta: monthlySurplusImpact,
    },
    {
      label: '收入用掉后还剩',
      value: `${after.remainDisposablePct}%`,
      sub: `不算所选支出 ${before.remainDisposablePct}% → 算上后`,
      delta: remainShareImpact,
    },
    {
      label: '每月新增支出',
      value: `${monthlyExpenseImpact >= 0 ? '+' : '-'}${money(Math.abs(monthlyExpenseImpact))}`,
      sub: `${money(before.monthlyExpenses)} → ${money(after.monthlyExpenses)}`,
      delta: monthlyExpenseImpact,
    },
    {
      label: deltaTotal30 <= 0 ? '30 年后资产减少' : '30 年后资产增加',
      value: money(Math.abs(deltaTotal30)),
      sub: '算上所选支出 vs 不算',
      delta: deltaTotal30,
    },
  ];
  return (
    <div className="relative inline-block">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => (open ? closeAnalyze() : openAnalyze())}
        className="touch-btn w-full rounded-xl bg-ink px-3 text-xs font-semibold text-white hover:bg-ink-hover sm:w-auto sm:bg-transparent sm:px-0 sm:text-coral-deep sm:hover:bg-transparent sm:hover:underline"
      >
        分析
      </button>
      <FloatPanel
        open={open}
        anchorRef={anchorRef}
        onClose={closeAnalyze}
        width={920}
        maxHeightVh={90}
        center
        draggable
        headerTitle="消费影响分析"
        mode="auto"
        density="panel"
      >
          <div className="rounded-2xl border border-slate-200 bg-[#f8faf9] px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1 text-sm font-semibold text-slate-700">
              先选择要计入的支出
                <InfoTip>{ANALYZE_PICK_TIP}</InfoTip>
              </p>
              <button
                type="button"
              onClick={() =>
                setCompareIds(financeInput.expenses.map((item) => item.id))
              }
                className="text-[11px] font-semibold text-coral-deep hover:underline"
              >
                全选
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {financeInput.expenses.map((item) => {
                const checked = compareIds.includes(item.id);
                const swatch = colorForItemId(item.id, allExpenseIds);
                return (
                  <label
                    key={item.id}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${checked ? 'bg-white font-semibold text-slate-700 shadow-sm' : 'border-slate-200 bg-white/60 text-slate-400'}`}
                    style={checked ? { borderColor: swatch } : undefined}
                  >
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      style={{ accentColor: swatch }}
                      checked={checked}
                      onChange={() => toggleCompareId(item.id)}
                    />
                  <i
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: swatch, opacity: checked ? 1 : 0.35 }}
                  />
                    <span>{item.name || '未命名'}</span>
                  </label>
                );
              })}
              <label
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${includeInvestShare ? 'bg-white font-semibold text-slate-700 shadow-sm' : 'border-slate-200 bg-white/60 text-slate-400'}`}
              style={
                includeInvestShare
                  ? { borderColor: INVEST_SHARE_COLOR }
                  : undefined
              }
              >
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  style={{ accentColor: INVEST_SHARE_COLOR }}
                  checked={includeInvestShare}
                  onChange={() => setIncludeInvestShare((current) => !current)}
                />
              <i
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  background: INVEST_SHARE_COLOR,
                  opacity: includeInvestShare ? 1 : 0.35,
                }}
              />
                <span className="inline-flex items-center gap-1">
                在图中拆出{INVEST_SHARE_NAME}（剩余×
                {Number.isInteger(chartInvestRate)
                  ? chartInvestRate
                  : chartInvestRate.toFixed(1)}
                %）
                  <InfoTip>{ANALYZE_INVEST_TIP}</InfoTip>
                </span>
              </label>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
            图表对比：不算这些支出 vs 算上这些支出
            <br />
              已选 {selectedExpenses.length} 项
              {includeInvestShare ? ` · ${INVEST_SHARE_NAME}已勾选` : ''}
            </p>
          </div>

        <div className="mt-4 rounded-2xl border border-coral/20 bg-coral/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-coral-deep">
            一句话结论
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
            {conclusion}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            {kpiCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"
            >
              <p className="min-h-[2rem] text-[11px] font-semibold leading-4 text-slate-500">
                {card.label}
              </p>
              <p
                className="mt-1 text-xl font-semibold tabular-nums"
                style={{ color: deltaTone(card.delta) }}
              >
                {card.value}
              </p>
              <p className="mt-1 font-mono text-[11px] text-slate-400">
                {card.sub}
              </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-3">
            <p className="flex items-center gap-1 text-sm font-semibold">
            每月支出压力
              <InfoTip>{ANALYZE_CHART_TIP}</InfoTip>
            </p>
          <p className="mt-1 text-[11px] text-slate-500">
            看支出占到手收入的比例：100% = 刚好用完，超过 100% = 当月不够用。
          </p>
          <ChartHost
            className="mt-2 !rounded-xl !bg-white"
            option={expenseShareOption}
          />
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-3">
            <p className="flex items-center gap-1 text-sm font-semibold">
            长期代价：30 年资产走势
              <InfoTip>{ANALYZE_ASSET_TIP}</InfoTip>
            </p>
          <p className="mt-1 text-[11px] text-slate-500">
            灰线 = 不算所选支出；红线 =
            算上所选支出。两条线的终点差距，就是长期影响。
          </p>
          <ChartHost
            className="mt-2 !rounded-xl !bg-white"
            option={assetCompareOption}
          />
          </div>
        </FloatPanel>
    </div>
  );
}

/** 图表宿主：仅客户端挂载 ECharts + 固定高度 + 可见/尺寸变化时 resize，避免 SSR/hydration 后 0×0 */
function ChartHost({
  option,
  className = '',
}: {
  option: Record<string, unknown>;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<InstanceType<typeof ReactECharts>>(null);
  // ponytail: SSR 与首屏一致留空盒，挂载后再画，躲开 echarts DOM 水合不一致
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted) return;
    const el = wrapRef.current;
    if (!el) return;
    const resize = () => {
      try {
        chartRef.current?.getEchartsInstance()?.resize();
      } catch {
        /* chart may unmount */
      }
    };
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => resize())
        : null;
    ro?.observe(el);
    // 走势分区跳转后图进视口再 resize
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          requestAnimationFrame(resize);
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    const timer = window.setTimeout(resize, 80);
    return () => {
      ro?.disconnect();
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [mounted]);
  return (
    <div
      ref={wrapRef}
      className={`chart-box overflow-hidden rounded-2xl bg-slate-50 p-2 sm:p-3 ${className}`}
    >
      {mounted && (
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: '100%', width: '100%', minHeight: 220 }}
          opts={{ renderer: 'canvas' }}
          notMerge
          lazyUpdate
          onChartReady={(chart) => chart.resize()}
        />
      )}
    </div>
  );
}

/** 计划变更：列表 + 同层编辑；多指标 / 同指标多时点；指标可搜索 */
function PlanChangePanel({
  open,
  anchorRef,
  onClose,
  events,
  baseSalary,
  baseTakeHome,
  baseReturnRate,
  onChange,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  events: PlanChangeEvent[];
  baseSalary: number;
  baseTakeHome: number;
  baseReturnRate: number;
  onChange: (next: PlanChangeEvent[]) => void;
}) {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [draft, setDraft] = useState<PlanChangeEvent | null>(null);
  const [fieldQuery, setFieldQuery] = useState('');
  const [fieldMenuOpen, setFieldMenuOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setView('list');
      setDraft(null);
      setFieldQuery('');
      setFieldMenuOpen(false);
    }
  }, [open]);

  const defaultValueForField = (field: PlanChangeField): number => {
    if (field === 'takeHomeIncome')
      return Math.max(0, Math.round(baseTakeHome));
    if (field === 'annualReturn')
      return Math.max(0, Number(baseReturnRate) || 0);
    return Math.max(0, Math.round(baseSalary));
  };

  const startCreate = () => {
    setDraft(
      createPlanChangeEvent({
      field: 'grossSalary',
      startYearMonth: yearMonthOffset(12),
      value: defaultValueForField('grossSalary'),
      }),
    );
    setFieldQuery('');
    setFieldMenuOpen(false);
    setView('edit');
  };
  const startEdit = (event: PlanChangeEvent) => {
    setDraft({ ...event });
    setFieldQuery('');
    setFieldMenuOpen(false);
    setView('edit');
  };
  const saveDraft = () => {
    if (!draft) return;
    const next = createPlanChangeEvent(draft);
    const exists = events.some((item) => item.id === next.id);
    onChange(
      exists
        ? events.map((item) => (item.id === next.id ? next : item))
        : [...events, next],
    );
    setView('list');
    setDraft(null);
    setFieldQuery('');
    setFieldMenuOpen(false);
  };
  const removeEvent = (id: string) => {
    onChange(events.filter((item) => item.id !== id));
  };
  const toggleEnabled = (id: string, enabled: boolean) => {
    onChange(
      events.map((item) => (item.id === id ? { ...item, enabled } : item)),
    );
  };
  const changeDraftField = (field: PlanChangeField) => {
    if (!draft) return;
    setDraft({
      ...draft,
      field,
      value: defaultValueForField(field),
    });
    setFieldQuery('');
    setFieldMenuOpen(false);
  };

  const filteredFields = filterPlanChangeFieldOptions(fieldQuery);
  const headerTitle =
    view === 'list'
    ? PLAN_CHANGE_PANEL_TITLE
      : draft && events.some((item) => item.id === draft.id)
        ? '编辑计划变更'
        : '新增计划变更';

  return (
    <FloatPanel
      open={open}
      anchorRef={anchorRef}
      onClose={() => {
        if (view === 'edit') {
          setView('list');
          setDraft(null);
          setFieldQuery('');
          setFieldMenuOpen(false);
          return;
        }
        onClose();
      }}
      width={420}
      maxHeightVh={78}
      zIndex={Z_INDEX.panel}
      headerTitle={headerTitle}
      density="panel"
      scrollResetKey={view}
      footer={
        view === 'edit' ? (
        <div className="flex gap-2">
            <button
              type="button"
              className="touch-btn flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600"
              onClick={() => {
                setView('list');
                setDraft(null);
                setFieldQuery('');
                setFieldMenuOpen(false);
              }}
            >
              取消
            </button>
            <button
              type="button"
              className="touch-btn flex-1 rounded-xl bg-[#f07f62] px-3 py-2.5 text-sm font-semibold text-white"
              onClick={saveDraft}
            >
              保存
            </button>
        </div>
        ) : undefined
      }
    >
      {view === 'list' ? (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-500">
            {PLAN_CHANGE_TIP}
          </p>
          {events.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
              暂无计划变更
            </p>
          ) : (
            <ul className="space-y-2">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700">
                        {formatPlanChangeListLine(
                          event.field,
                          event.startYearMonth,
                          event.value,
                        )}
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        className="accent-[#f07f62]"
                        checked={event.enabled}
                        onChange={(e) =>
                          toggleEnabled(event.id, e.target.checked)
                        }
                      />
                      启用
                    </label>
                  </div>
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#d9654a]"
                      onClick={() => startEdit(event)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-500"
                      onClick={() => removeEvent(event.id)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={startCreate}
            className="touch-btn w-full rounded-xl border border-dashed border-[#f07f62]/60 px-3 py-2.5 text-sm font-semibold text-[#d9654a]"
          >
            新增计划变更
          </button>
        </div>
      ) : draft ? (
        <div className="space-y-3">
          <div className="relative block text-sm text-slate-600">
            <span className="block">改什么</span>
            <p className="mt-1 text-xs text-slate-500">
              已选：{PLAN_CHANGE_FIELD_LABEL[draft.field]}
            </p>
            <input
              type="search"
              aria-label="搜索指标"
              placeholder="搜索指标…"
              value={fieldQuery}
              onChange={(e) => {
                setFieldQuery(e.target.value);
                setFieldMenuOpen(true);
              }}
              onFocus={() => setFieldMenuOpen(true)}
              className="field-input mt-1"
              autoComplete="off"
            />
            {fieldMenuOpen && (
              <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {filteredFields.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-slate-400">
                    无匹配指标
                  </li>
                ) : (
                  filteredFields.map((opt) => (
                    <li key={opt.value}>
                      <button
                        type="button"
                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${opt.value === draft.field ? 'font-semibold text-[#d9654a]' : 'text-slate-700'}`}
                        onClick={() => changeDraftField(opt.value)}
                      >
                        {opt.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          <label className="block text-sm text-slate-600">
            从何时
            <input
              type="month"
              value={draft.startYearMonth}
              onChange={(e) =>
                setDraft({ ...draft, startYearMonth: e.target.value })
              }
              className="field-input mt-1"
            />
          </label>
          <label className="block text-sm text-slate-600">
            变成多少{draft.field === 'annualReturn' ? '（%）' : ''}
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={draft.field === 'annualReturn' ? 100 : undefined}
              step={draft.field === 'annualReturn' ? 0.1 : 1}
              value={draft.value}
              onChange={(e) => {
                const n = Number(e.target.value);
                setDraft({
                  ...draft,
                  value: Number.isFinite(n) ? Math.max(0, n) : 0,
                });
              }}
              className="field-input mt-1"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="accent-[#f07f62]"
              checked={draft.enabled}
              onChange={(e) =>
                setDraft({ ...draft, enabled: e.target.checked })
              }
            />
            启用
          </label>
        </div>
      ) : null}
    </FloatPanel>
  );
}

/** 闲钱投资：行内 select + SoftNumberInput；不为切模式/改数值单独开 FloatPanel */
function ReinvestEditor({
  setting,
  monthlySurplus,
  onChange,
}: {
  setting: ReinvestSetting;
  monthlySurplus: number;
  onChange: (next: ReinvestSetting) => void;
}) {
  const isPercent = setting.mode === 'percent';
  const apply = (next: ReinvestSetting) => {
    onChange(next);
  };
  const commit = (next: ReinvestSetting) => {
    onChange(next);
    window.dispatchEvent(new Event('money-manage-save'));
  };
  const switchMode = (mode: ReinvestMode) => {
    commit(switchReinvestMode(setting, mode, monthlySurplus));
  };
  return (
    <div className="relative block min-w-0 sm:col-span-2">
      {/* 与 Editable「年化收益率」同一套 field-row 左右节奏；右侧仍为 select+数字同行 */}
      <div className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600 sm:flex-row sm:items-center">
        <div className="flex w-[7.5rem] shrink-0 items-center gap-1 whitespace-nowrap">
          每月理财投入
          <InfoTip>
            {
              '每月剩余的钱中，有多少拿去理财。\n可以按结余比例投入，也可以填写每月固定金额；不会超过当月剩余。\n理财占比 > 0 时按比例再平衡，本项（每月投入）不生效。'
            }
          </InfoTip>
        </div>
        <SelectNumberField
          className="!gap-1 min-w-0 shrink-0 self-center sm:self-auto [&>div:last-child]:!min-w-0 [&>div:last-child]:flex-none"
          select={
            <select
              aria-label="再投入模式"
              className="field-input !mt-0 !w-[5.5rem] max-w-[5.5rem] !px-1.5 py-0.5 text-[11px] font-medium leading-tight text-slate-700"
              value={setting.mode}
              onChange={(event) =>
                switchMode(event.target.value as ReinvestMode)
              }
            >
              <option value="percent">百分比</option>
              <option value="amount">固定金额</option>
            </select>
          }
          input={
            isPercent ? (
            <SoftNumberInput
                className="field-input !mt-0 w-24 !w-24"
              min={0}
              max={100}
              step={1}
              suffix="%"
                value={
                  Number.isInteger(setting.rate)
                    ? setting.rate
                    : Number(setting.rate.toFixed(1))
                }
              onCommit={(n) => apply({ ...setting, rate: n })}
            />
          ) : (
            <SoftNumberInput
                className="field-input !mt-0 w-24 !w-24"
              min={0}
              step={100}
              suffix="/月"
              value={setting.amount}
              onCommit={(n) => apply({ ...setting, amount: n })}
            />
            )
          }
        />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
        {isPercent
          ? `当前约投入 ${money(Math.round((monthlySurplus * clamp(setting.rate, 0, 100)) / 100))}/月（按月度剩余估算）`
          : `不超过当月结余；当前结余约 ${money(Math.round(monthlySurplus))}`}
      </p>
    </div>
  );
}
/** 只改一个数：点击原地 input，blur/Enter 保存；非法恢复编辑前原值。kind 保留兼容，一律 inline。 */
function Editable({
  label,
  value,
  min = 0,
  max,
  step,
  suffix = '',
  tip,
  onChange,
}: EditableProps) {
  const [editing, setEditing] = useState(false);
  const [editBox, setEditBox] = useState<{ w: number; h: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(String(value));
  // ponytail: 空视同 0；非法不 live 改父、blur 恢复 value（勿落 0）
  const formatValue = (n: number) =>
    String(Number.isInteger(n) ? n : Number(n.toFixed(1)));
  useEffect(() => {
    if (!editing) setDraft(formatValue(value));
  }, [value, editing]);
  useEffect(() => {
    if (!editing || !inputRef.current) return;
    inputRef.current.focus();
  }, [editing]);
  // change 只改 draft；blur 才 onChange（摘要/图表联动）+ 落盘
  const commit = (nextValue: number, persist: boolean) => {
    const next = clampNumberField(nextValue, { min, max });
    setDraft(formatValue(next));
    onChange(next);
    if (persist) window.dispatchEvent(new Event('money-manage-save'));
  };
  const endInline = () => {
    setEditing(false);
    setEditBox(null);
  };
  const startInline = () => {
    const el = anchorRef.current;
    // 锁定切换前按钮盒尺寸，避免 input 换行跳动
    if (el) setEditBox({ w: el.offsetWidth, h: el.offsetHeight });
    setDraft(formatValue(value));
    setEditing(true);
  };
  const onDraftBlur = () => {
    if (softNumberIsInvalid(draft)) {
      setDraft(formatValue(value));
      endInline();
      return;
    }
    commit(softNumberCommit(draft, value), true);
    endInline();
  };
  // 单位外置：展示/编辑框只含数值；suffix（%、个月、年等）旁侧展示，不进 input
  const displayNum = formatEditableNumber(value);
  const unit = suffix.trim();
  return (
    <div className="relative block">
      <span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600 sm:flex-row sm:items-center">
        <span className="flex items-center gap-1">
          {label}
          {tip ? <InfoTip>{tip}</InfoTip> : null}
        </span>
        <span className="field-value-with-unit self-start sm:self-auto">
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              min={min}
              max={max}
              step={step}
              aria-label={label}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={onDraftBlur}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setDraft(formatValue(value));
                  endInline();
                }
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
              }}
              className="field-inline-input"
              style={
                editBox
                  ? {
                      width: editBox.w,
                      height: editBox.h,
                      minWidth: editBox.w,
                      minHeight: editBox.h,
                    }
                  : undefined
              }
            />
          ) : (
            <button
              ref={anchorRef}
              type="button"
              onClick={startInline}
              onDoubleClick={startInline}
              title="点击直接编辑"
              className="field-click"
            >
              {displayNum}
            </button>
          )}
          {unit ? <span className="field-unit">{unit}</span> : null}
        </span>
      </span>
    </div>
  );
}

/** 退休规划社保基数编辑体：城市快捷 + 手改；与收入区五险基数独立。 */
function SocialBaseEditor({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [cityId, setCityId] = useState('');
  // ponytail: cityId 仅会话标记，不持久化
  const commit = (next: number) => {
    onChange(next);
    window.dispatchEvent(new Event('money-manage-save'));
  };
  return (
    <div className="space-y-3">
      <label className="block text-xs text-slate-500">
        城市快捷
        <select
          aria-label="按城市填入社保基数"
          className="field-input mt-1"
          value={cityId}
          onChange={(event) => {
            const id = event.target.value;
            setCityId(id);
            const next = resolveCitySocialBase(id);
            if (next == null) return;
            commit(next);
          }}
        >
          <option value="">选城市…</option>
          {CITY_SOCIAL_BASE_PRESETS.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name} {city.year}（{city.base.toLocaleString('zh-CN')}）
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-slate-500">
        退休规划缴费基数
        <SoftNumberInput
          min={0}
          step={1}
          value={value}
          onCommit={(n) => {
            if (cityId && resolveCitySocialBase(cityId) !== n) setCityId('');
            onChange(n);
          }}
        />
      </label>
      <p className="text-[11px] leading-snug text-slate-400">
        选城市只填入规划基数，仍可手改；不改变当前工资的五险缴费基数。
      </p>
    </div>
  );
}

function RetirementSocialEditor({
  retirement,
  retirementDate,
  onChange,
}: {
  retirement: RetirementSetting;
  retirementDate: string;
  onChange: (patch: Partial<RetirementSetting>) => void;
}) {
  const apply = (patch: Partial<RetirementSetting>) => {
    onChange(patch);
  };
  const commit = (patch: Partial<RetirementSetting>) => {
    onChange(patch);
    window.dispatchEvent(new Event('money-manage-save'));
  };
  // 二级弹层正文：无再套标题（PanelHeader 已有「退休与社保」）
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 accent-coral"
          checked={retirement.enabled}
          onChange={(event) => commit({ enabled: event.target.checked })}
          aria-label="纳入退休规划"
        />
        <span>
          <span className="block font-medium">纳入退休规划</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
            用于计算退休前还清和支出走势；关闭后仍保留下面的规划参数。
          </span>
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-500">
          出生日期
          <input
            type="date"
            className="field-input mt-1"
            value={retirement.birthDate}
            onChange={(event) => commit({ birthDate: event.target.value })}
          />
        </label>
        <label className="block text-xs text-slate-500">
          身份
          <select
            className="field-input mt-1"
            value={retirement.identity}
            onChange={(event) => commit({ identity: event.target.value })}
          >
            <option value="male">男性</option>
            <option value="female-worker">女性职工</option>
            <option value="female-cadre">女性干部</option>
          </select>
        </label>
        <label className="block text-xs text-slate-500">
          参保开始日期
          <input
            type="date"
            className="field-input mt-1"
            value={retirement.insuranceStartDate}
            onChange={(event) =>
              commit({ insuranceStartDate: event.target.value })
            }
          />
        </label>
        <label className="block text-xs text-slate-500">
          计划缴费年限
          <SoftNumberInput
            min={0}
            max={20}
            step={1}
            suffix="年"
            value={retirement.contributionYears}
            onCommit={(value) => apply({ contributionYears: value })}
          />
        </label>
      </div>
      <SocialBaseEditor
        value={retirement.base}
        onChange={(value) => onChange({ base: value })}
      />
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
        <span>预计退休</span>
        <strong className="tabular-nums text-slate-700">
          {retirementDate || '未设置'}
        </strong>
      </div>
    </div>
  );
}
function DateEditable({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="relative block">
      <span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600 sm:flex-row">
        <span>{label}</span>
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          onDoubleClick={() => setOpen(true)}
          title="点击打开编辑"
          className="field-click self-start sm:self-auto"
        >
          {value || '未设置'}
        </button>
      </span>
      <FloatPanel
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        width={280}
        maxHeightVh={40}
        headerTitle={label}
        density="field"
      >
        <label className="block text-xs text-slate-500">
          选择日期
          <input
            autoFocus
            type="date"
            min={min}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              window.dispatchEvent(new Event('money-manage-save'));
            }}
            className="field-input mt-2"
          />
        </label>
      </FloatPanel>
    </div>
  );
}
function SelectEditable({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const display = options.find((item) => item.value === value)?.label ?? value;
  return (
    <div className="relative block">
      <span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600 sm:flex-row">
        <span>{label}</span>
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          onDoubleClick={() => setOpen(true)}
          title="点击打开编辑"
          className="field-click self-start sm:self-auto"
        >
          {display}
        </button>
      </span>
      <FloatPanel
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        width={280}
        maxHeightVh={40}
        headerTitle={label}
        density="field"
      >
        <label className="block text-xs text-slate-500">
          选择
          <select
            autoFocus
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              window.dispatchEvent(new Event('money-manage-save'));
            }}
            className="field-input mt-1"
          >
            {options.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </FloatPanel>
    </div>
  );
}
const saveEvent = () => window.dispatchEvent(new Event('money-manage-save'));

/** 数值输入：聚焦可空；change 只改 draft；blur 才 onCommit（联动）+ 落盘 */
function SoftNumberInput({
  value,
  min,
  max,
  step,
  className = 'field-input mt-1',
  suffix = '',
  onCommit,
  persistOnBlur = true,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number | string;
  className?: string;
  suffix?: string;
  onCommit: (n: number) => void;
  /** false：仅改父 draft（如支出编辑面板），不触发全局落盘 */
  persistOnBlur?: boolean;
}) {
  const lo = min ?? Number.NEGATIVE_INFINITY;
  const hi = max ?? Number.POSITIVE_INFINITY;
  const focusedRef = useRef(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    if (!focusedRef.current) setDraft(String(value));
  }, [value]);
  const finish = (raw: string) => {
    // 非法 → 恢复编辑前 value，不 onCommit
    if (softNumberIsInvalid(raw)) {
      setDraft(String(value));
      return;
    }
    const next = clamp(softNumberCommit(raw, value), lo, hi);
    setDraft(String(next));
    onCommit(next);
  };
  const unit = suffix.trim();
  // 调用方已写死 w-* / min-w-[*] 时勿再 flex-1，否则单位长短（% vs /月）会挤歪数字框
  const hasExplicitWidth =
    /\bw-(?:\[[^\]]+\]|\d+)\b/.test(className) || /\bmin-w-\[/.test(className);
  const noTopMargin = /\b!?mt-0\b/.test(className);
  const stripped = className.replace(/\bmt-1\b/g, '').trim();
  const inputClass = unit
    ? `${stripped}${hasExplicitWidth ? ' shrink-0' : ' min-w-0 flex-1'}`.trim()
    : className;
  const input = (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      className={inputClass}
      value={draft}
      onFocus={() => {
        focusedRef.current = true;
        setDraft(String(value));
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        focusedRef.current = false;
        finish(draft);
        if (persistOnBlur) window.dispatchEvent(new Event('money-manage-save'));
      }}
    />
  );
  if (!unit) return input;
  return (
    <span
      className={`field-value-with-unit justify-start${noTopMargin ? '' : ' mt-1'}${hasExplicitWidth ? '' : ' w-full'}`}
    >
      {input}
      <span className="field-unit">{unit}</span>
    </span>
  );
}

function formatExpensePayment(expense: Expense) {
  if (expense.mode === 'one_time') {
    const when = monthKey(expense.startDate || defaultOneTimeDate());
    return `${money(expense.amount)} · ${when}`;
  }
  if (expense.mode === 'fixed') return money(expense.amount);
  if (expense.mode === 'percentage') return `${expense.rate || 0}% 收入`;
  const payment = installmentMonthlyPayment(expense);
  const mode = expense.repaymentMode || 'equal_principal_interest';
  const start = monthKey(expense.startDate || todayDateKey());
  return mode === 'equal_principal'
    ? `${money(payment)}/月（首月） · ${start}起`
    : `${money(payment)}/月 · ${start}起`;
}
function formatExpenseMode(mode: Expense['mode']) {
  return mode === 'installment'
    ? '分期'
    : mode === 'percentage'
      ? '按比例'
      : mode === 'one_time'
        ? '一次性'
        : '固定金额';
}
function formatExpenseInstallment(expense: Expense) {
  if (expense.mode !== 'installment') return '—';
  const total = expense.total || 0;
  const down = expense.downPayment || 0;
  const term = expense.term || 36;
  const pct = total > 0 ? (down / total) * 100 : 0;
  const years = term / 12;
  const yearLabel = Number.isInteger(years) ? `${years}` : years.toFixed(1);
  return `${repaymentModeLabel(expense.repaymentMode)} · ${money(total)} · 首付 ${money(down)}（${pct.toFixed(1)}%）· ${term} 期 / ${yearLabel} 年 · ${expense.interest || 0}%`;
}
/**
 * 资产配置：FloatPanel density=panel → sheet-page 全屏内页（SheetPageShell）。
 * 两区块：总资产 | 备用金；往年支出独立；应急月数↔备用金额用 LinkedNumberFields。
 */
function AssetLinkedEditor({
  totalAssets,
  cash,
  invest,
  investRatio,
  onTotal,
  onCash,
  onCashByMonths,
  onAnnualSpend,
  onInvestAmount,
  onInvestRatio,
  emergency,
  planMonthly,
  adjustedAvailableAssets,
  monthlyExpenses,
  onMonthsPlanChecked,
}: {
  totalAssets: number;
  cash: number;
  invest: number;
  investRatio: number;
  onTotal: (value: number) => void;
  onCash: (value: number) => void;
  onCashByMonths: (months: number) => void;
  onAnnualSpend: (annual: number) => void;
  onInvestAmount: (value: number) => void;
  onInvestRatio: (value: number) => void;
  emergency: EmergencySetting;
  planMonthly: number;
  adjustedAvailableAssets: number;
  monthlyExpenses: number;
  onMonthsPlanChecked: (checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const formulaMode = emergency.mode === 'months';
  const plan = emergency.monthsPlan;
  const modeLabel = formulaMode ? '按月数计算' : '填金额';
  const cashSummary = formulaMode
    ? plan.months > 0
      ? `${modeLabel} · ${plan.months} 月 · ${money(cash)}`
      : `${modeLabel} · ${money(cash)}`
    : `${modeLabel} · ${money(cash)}`;
  const setCashMode = (mode: 'amount' | 'months') => {
    onMonthsPlanChecked(mode === 'months');
  };
  const autoMonthly = monthlyFromAnnual(plan.annualSpend) || planMonthly;
  return (
    <div className="relative block min-w-0 sm:col-span-2">
      <span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600 sm:flex-row sm:items-center">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            总资产与备用金
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-coral/10 px-1.5 py-0.5 text-[10px] font-semibold text-coral-deep"
              title="现金+理财=总资产"
            >
              <LinkLockIcon className="h-3 w-3" />
              自动同步
            </span>
            <InfoTip>{`点开内页改总资产与备用金。\n备用金可以直接填写金额，也可以按每月生活费和备用月数计算；改一边，另一边会自动同步。`}</InfoTip>
          </span>
          <span className="text-[11px] font-normal leading-snug text-slate-400">
            总资产 {money(totalAssets)} · 备用金 {cashSummary}
          </span>
        </span>
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          onDoubleClick={() => setOpen(true)}
          title="点击打开资产配置内页"
          className="field-click min-w-0 max-w-full self-start truncate sm:self-auto"
        >
          {money(totalAssets)}
        </button>
      </span>
      <FloatPanel
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        width={400}
        maxHeightVh={90}
        headerTitle="资产配置"
        density="panel"
      >
        <div className="space-y-5">
          {/* —— 总资产 —— */}
          <section className="space-y-3" data-asset-section="total">
            <h4 className="text-sm font-semibold text-slate-800">总资产</h4>
            <label className="block text-xs text-slate-500">
              总资产
              <SoftNumberInput
                min={0}
                step={1000}
                value={totalAssets}
                onCommit={onTotal}
              />
            </label>
            <LinkedNumberFields alwaysRow hint="理财金额 ↔ 占比（相对总资产）">
              <label className="block text-xs text-slate-500">
                理财资产
                <SoftNumberInput
                  min={0}
                  max={totalAssets}
                  step={1000}
                  value={invest}
                  onCommit={onInvestAmount}
                />
              </label>
              <label className="block text-xs text-slate-500">
                理财占比
                <SoftNumberInput
                  min={0}
                  max={100}
                  step={1}
                  suffix="%"
                  value={
                    Number.isInteger(investRatio)
                      ? investRatio
                      : Number(investRatio.toFixed(1))
                  }
                  onCommit={onInvestRatio}
                />
              </label>
            </LinkedNumberFields>
            <p className="text-[11px] leading-snug text-slate-400">
              现金（备用金）+ 理财 = 总资产
            </p>
          </section>

          {/* —— 备用金：表单常显；模式只换驱动 —— */}
          <section
            className="space-y-3 border-t border-slate-100 pt-4"
            data-asset-section="emergency"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
                备用金
                <InfoTip>{EMERGENCY_CASH_MODE_TIP}</InfoTip>
              </h4>
              <select
                aria-label="备用金方式"
                className="field-input !mt-0 !w-auto max-w-full py-1 text-xs font-medium text-slate-700"
                value={formulaMode ? 'months' : 'amount'}
                onChange={(event) =>
                  setCashMode(
                    event.target.value === 'months' ? 'months' : 'amount',
                  )
                }
              >
                <option value="amount">填金额</option>
                <option value="months">按月数计算</option>
              </select>
            </div>

            <label className="block text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                每年大概花费<InfoTip>{EMERGENCY_ANNUAL_SPEND_TIP}</InfoTip>
              </span>
              <SoftNumberInput
                min={0}
                step={1000}
                value={plan.annualSpend}
                onCommit={onAnnualSpend}
              />
            </label>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>每月支出（自动）</span>
              <span className="font-mono font-semibold tabular-nums text-ink">
                {money(autoMonthly)}
                <span className="ml-1 font-sans font-normal text-slate-400">
                  = 往年÷12
                </span>
              </span>
            </div>
            {plan.annualSpend <= 0 && monthlyExpenses > 0 && (
              <p className="text-[11px] leading-snug text-slate-400">
                尚未填往年时，暂用账本本月支出 {money(monthlyExpenses)} 作月均
              </p>
            )}

            {/* 仅月数↔金额进 LinkedNumberFields；往年支出不进 */}
            <LinkedNumberFields
              alwaysRow
              hint="应急月数 ↔ 备用金额（月均×月数；改金额反推月数，不改往年支出）"
            >
              <label className="block text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  备用月数<InfoTip>{EMERGENCY_MONTHS_FIELD_TIP}</InfoTip>
                </span>
                <SoftNumberInput
                  min={0}
                  max={36}
                  step={0.5}
                  suffix="个月"
                  value={plan.months}
                  onCommit={onCashByMonths}
                />
              </label>
              <label className="block text-xs text-slate-500">
                备用金额
                <SoftNumberInput
                  min={0}
                  max={totalAssets}
                  step={1000}
                  value={cash}
                  onCommit={onCash}
                />
              </label>
            </LinkedNumberFields>
          </section>

          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                真正可动用的钱<InfoTip>{ADJUSTED_AVAILABLE_ASSETS_TIP}</InfoTip>
              </span>
              <span className="font-mono tabular-nums text-ink">
                {money(adjustedAvailableAssets)}
              </span>
            </div>
          </div>
        </div>
      </FloatPanel>
    </div>
  );
}

function InstallmentSettingsPanel({
  expense,
  onChange,
  retirementDate,
}: {
  expense: Expense;
  onChange: (patch: Partial<Expense>) => void;
  retirementDate?: string;
}) {
  const startDate = expense.startDate || todayDateKey();
  const total = expense.total || 0;
  const down = Math.min(expense.downPayment || 0, total);
  const followRetirement = Boolean(expense.followRetirement);
  const term = clampInstallmentTerm(
    startDate,
    Math.max(1, expense.term || 36),
    followRetirement,
    retirementDate,
  );
  const downPercent = total > 0 ? Math.round((down / total) * 1000) / 10 : 0;
  const years = Math.round((term / 12) * 10) / 10;
  const mode = expense.repaymentMode || 'equal_principal_interest';
  const loanInput = { ...expense, term, downPayment: down, total, startDate };
  const monthly = installmentMonthlyPayment(loanInput);
  const explanation = explainInstallmentPayment(loanInput);
  const span = resolveExpenseSpan(
    { ...expense, startDate, term, followRetirement },
    { retirementDate },
  );
  const patchTotal = (nextTotal: number) => {
    const safeTotal = Math.max(0, nextTotal);
    const ratio = total > 0 ? down / total : 0;
    const nextDown = clamp(Math.round(safeTotal * ratio), 0, safeTotal);
    onChange({ total: safeTotal, downPayment: nextDown });
  };
  const patchDownAmount = (amount: number) => {
    const next = clamp(amount, 0, total);
    onChange({ downPayment: next });
  };
  const patchDownPercent = (percent: number) => {
    const pct = clamp(percent, 0, 100);
    onChange({ downPayment: clamp(Math.round((total * pct) / 100), 0, total) });
  };
  const patchTermMonths = (months: number) => {
    const next = clampInstallmentTerm(
      startDate,
      months,
      followRetirement,
      retirementDate,
    );
    onChange({
      term: next,
      endDate: resolveExpenseSpan(
        { ...expense, startDate, term: next, followRetirement },
        { retirementDate },
      ).end,
    });
  };
  const patchTermYears = (value: number) => {
    const safeYears = clamp(value, 1 / 12, 30);
    patchTermMonths(Math.round(safeYears * 12));
  };
  const patchStart = (value: string) => {
    const start = value || todayDateKey();
    const nextTerm = clampInstallmentTerm(
      start,
      term,
      followRetirement,
      retirementDate,
    );
    onChange({
      startDate: start,
      term: nextTerm,
      endDate: resolveExpenseSpan(
        { ...expense, startDate: start, term: nextTerm, followRetirement },
        { retirementDate },
      ).end,
    });
  };
  const patchFollowRetirement = (checked: boolean) => {
    const nextTerm = clampInstallmentTerm(
      startDate,
      term,
      checked,
      retirementDate,
    );
    onChange({
      followRetirement: checked,
      term: nextTerm,
      endDate: resolveExpenseSpan(
        { ...expense, startDate, term: nextTerm, followRetirement: checked },
        { retirementDate },
      ).end,
    });
  };
  const isNarrow = useIsMobile();
  const [formulaOpen, setFormulaOpen] = useState(false);
  return (
    <div className="installment-settings space-y-3">
      <label className="block text-xs text-slate-500">
        还款方式
        <select
          className="field-input mt-1"
          value={mode}
          onChange={(event) =>
            onChange({ repaymentMode: event.target.value as RepaymentMode })
          }
        >
          <option value="equal_principal_interest">每月还款相同</option>
          <option value="equal_principal">每月逐渐减少</option>
        </select>
      </label>
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <span className="text-xs text-slate-500">
            {mode === 'equal_principal' ? '预估首月月供' : '预估月供'}
          </span>
          <strong className="font-mono text-base tabular-nums text-ink">
            {money(monthly)}
          </strong>
      </div>
        <p className="mt-1 text-[11px] leading-snug text-slate-400">
          已计入每月还款，并同步到收入剩余比例
        </p>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-500">
          开始时间（默认当月）
          <input
            className="field-input mt-1"
            type="date"
            value={startDate.slice(0, 10)}
            onChange={(event) => patchStart(event.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-500">
          总价
          <SoftNumberInput
            min={0}
            step={1000}
            value={total}
            persistOnBlur={false}
            onCommit={patchTotal}
          />
        </label>
    </div>
    <label className="flex items-start gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-xs leading-snug text-slate-600">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-coral"
          checked={followRetirement}
          onChange={(event) => patchFollowRetirement(event.target.checked)}
        />
      <span>勾选后须在退休前还清（自动截断最长还款期）</span>
    </label>
    {followRetirement && (
      <p className="text-[11px] leading-snug text-slate-500">
          退休日期 {retirementDate || '未设置'} · 还款 {term} 个月 · 预计还清{' '}
          {span.end}
      </p>
    )}
    <LinkedNumberFields hint="首付金额 ↔ 比例（相对总价）；改一边另一边跟">
        <label className="block text-xs text-slate-500">
          首付金额
          <SoftNumberInput
            min={0}
            step={1000}
            value={down}
            persistOnBlur={false}
            onCommit={patchDownAmount}
          />
        </label>
        <label className="block text-xs text-slate-500">
          首付比例
          <SoftNumberInput
            min={0}
            max={100}
            step={0.1}
            suffix="%"
            value={downPercent}
            persistOnBlur={false}
            onCommit={patchDownPercent}
          />
        </label>
    </LinkedNumberFields>
      <LinkedNumberFields hint="年数和月数会自动换算，计算统一按月数进行">
        <label className="block text-xs text-slate-500">
          年数
          <SoftNumberInput
            min={0.1}
            max={30}
            step={0.1}
            suffix="年"
            value={years}
            persistOnBlur={false}
            onCommit={patchTermYears}
          />
        </label>
        <label className="block text-xs text-slate-500">
          还款月数
          <SoftNumberInput
            min={1}
            max={360}
            step={1}
            suffix="月"
            value={term}
            persistOnBlur={false}
            onCommit={patchTermMonths}
          />
        </label>
    </LinkedNumberFields>
      <label className="block text-xs text-slate-500">
        年化利率
        <SoftNumberInput
          min={0}
          max={100}
          step={0.1}
          suffix="%"
          value={expense.interest || 0}
          persistOnBlur={false}
          onCommit={(n) => onChange({ interest: n })}
        />
      </label>
    {isNarrow ? (
      <div className="rounded-xl border border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={() => setFormulaOpen((current) => !current)}
            className="touch-btn flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-semibold text-slate-700"
          >
          <span>计算说明</span>
            <span className="text-slate-400">
              {formulaOpen ? '收起' : '展开'}
            </span>
        </button>
        {formulaOpen && (
          <div className="space-y-1.5 border-t border-slate-100 px-3 py-2.5 text-xs text-slate-600">
            <div className="font-medium text-slate-700">计算公式</div>
              <p className="leading-relaxed break-words">
                {explanation.formula}
              </p>
            <div className="pt-1 font-medium text-slate-700">计算过程</div>
            <ol className="list-decimal space-y-0.5 pl-4 leading-relaxed tabular-nums">
                {explanation.steps.map((step) => (
                  <li key={step} className="break-words">
                    {step}
                  </li>
                ))}
            </ol>
          </div>
        )}
      </div>
    ) : (
      <div className="space-y-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
        <div className="font-medium text-slate-700">计算公式</div>
        <p className="leading-relaxed">{explanation.formula}</p>
        <div className="pt-1 font-medium text-slate-700">计算过程</div>
        <ol className="list-decimal space-y-0.5 pl-4 leading-relaxed tabular-nums">
            {explanation.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
        </ol>
      </div>
    )}
    </div>
  );
}
/** 只改一个纯文本：点击原地 input，blur/Enter 保存；空按 allowEmpty，否则恢复原值。 */
function TextEditable({
  value,
  emptyLabel,
  allowEmpty = true,
  ariaLabel,
  className,
  onChange,
}: {
  value: string;
  emptyLabel: string;
  allowEmpty?: boolean;
  ariaLabel?: string;
  className?: string;
  onChange: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editBox, setEditBox] = useState<{ w: number; h: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  useEffect(() => {
    if (!editing || !inputRef.current) return;
    inputRef.current.focus();
  }, [editing]);
  const endInline = () => {
    setEditing(false);
    setEditBox(null);
  };
  const startInline = () => {
    const el = anchorRef.current;
    // 锁定切换前按钮盒尺寸，避免 input 换行跳动
    if (el) setEditBox({ w: el.offsetWidth, h: el.offsetHeight });
    setDraft(value);
    setEditing(true);
  };
  const onDraftBlur = () => {
    const next = commitTextField(draft, value, { allowEmpty });
    setDraft(next);
    if (next !== value) {
      onChange(next);
      window.dispatchEvent(new Event('money-manage-save'));
    }
    endInline();
  };
  const display = formatTextFieldDisplay(value, emptyLabel);
  const btnClass = className ?? 'field-click max-w-full truncate text-left';
  return (
    <div className="relative inline-block max-w-full">
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          aria-label={ariaLabel ?? emptyLabel}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={onDraftBlur}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setDraft(value);
              endInline();
            }
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
          className={`field-inline-input field-inline-text ${className ?? ''}`.trim()}
          style={
            editBox
              ? {
                  width: Math.max(editBox.w, 96),
                  height: editBox.h,
                  minWidth: Math.max(editBox.w, 96),
                  minHeight: editBox.h,
                }
              : undefined
          }
        />
      ) : (
        <button
          ref={anchorRef}
          type="button"
          onClick={startInline}
          onDoubleClick={startInline}
          title="点击直接编辑"
          className={
            btnClass.includes('field-click')
              ? btnClass
              : `field-click max-w-full truncate text-left ${btnClass}`
          }
        >
          {display}
        </button>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  negative = false,
}: {
  label: string;
  value: string;
  detail: string;
  negative?: boolean;
}) {
  return (
    <div className="relative block">
      <span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600">
        <span className="flex items-center gap-1">
          {label}
          <InfoTip>{detail}</InfoTip>
        </span>
        <span className={`field-readonly ${negative ? 'text-red-500' : ''}`}>
          {value}
        </span>
      </span>
    </div>
  );
}
function Breakdown({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="relative block">
      <span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600">
        <span className="flex items-center gap-1">
          {label}
          <InfoTip>{detail}</InfoTip>
        </span>
        <span className="field-readonly">{value}</span>
      </span>
    </div>
  );
}
function SocialTaxBreakdown({
  salary,
  rows,
  total,
  tax,
  net,
  deductions,
  socialEnabled,
  onSocialEnabledChange,
  insuranceBase,
  housingFundBase,
  insuranceFollowSalary,
  housingFollowSalary,
  onInsuranceFollowSalary,
  onHousingFollowSalary,
  onInsuranceBaseChange,
  onHousingFundBaseChange,
  onHousingPersonalChange,
  onRentChange,
  onElderlyChange,
  retirement,
  retirementDate,
  onRetirementChange,
}: {
  salary: number;
  rows: Array<{
    name: string;
    personal: number;
    personalAmount: number;
    company: number;
    companyAmount: number;
    base?: number;
  }>;
  total: number;
  tax: number;
  net: number;
  deductions: Array<{
    name: string;
    standard: number;
    actual: number;
    enabled: boolean;
  }>;
  socialEnabled: boolean;
  onSocialEnabledChange: (value: boolean) => void;
  insuranceBase: number;
  housingFundBase: number;
  insuranceFollowSalary: boolean;
  housingFollowSalary: boolean;
  onInsuranceFollowSalary: () => void;
  onHousingFollowSalary: () => void;
  onInsuranceBaseChange: (value: number) => void;
  onHousingFundBaseChange: (value: number) => void;
  onHousingPersonalChange: (value: number) => void;
  onRentChange: (value: boolean) => void;
  onElderlyChange: (value: boolean) => void;
  retirement: RetirementSetting;
  retirementDate: string;
  onRetirementChange: (patch: Partial<RetirementSetting>) => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [retirementSettingsOpen, setRetirementSettingsOpen] = useState(false);
  const [taxDetailOpen, setTaxDetailOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const retirementSettingsAnchorRef = useRef<HTMLButtonElement>(null);
  const taxDetailAnchorRef = useRef<HTMLButtonElement>(null);
  // 一级关闭时收起退休二级与个税二级，避免残留状态。
  useEffect(() => {
    if (!open) {
      setRetirementSettingsOpen(false);
      setTaxDetailOpen(false);
    }
  }, [open]);
  const housingPersonal =
    rows.find((row) => row.name === HOUSING_FUND_NAME)?.personal ?? 5;
  // 企业合计 = 各险种企业部分之和（不含个税）；合计列 = 个人 + 企业
  const companyTotal = rows.reduce((sum, row) => sum + row.companyAmount, 0);
  const bothTotal = total + companyTotal;
  const burdenSharePct = calcSocialBurdenSharePct({
    salary,
    personalTotal: total,
    companyTotal,
  });
  const deductionTotal = total + tax;
  const taxable = Math.max(
    0,
    salary - total - deductions.reduce((sum, row) => sum + row.actual, 0),
  );
  const bracket = findTaxMonthlyBracket(taxable);
  const bracketSliceRows = buildTaxBracketSliceRows(taxable);
  const mobileSubView = isMobile
    ? retirementSettingsOpen
      ? 'retirement'
      : taxDetailOpen
        ? 'tax'
        : null
    : null;
  const popSub = () => {
    setRetirementSettingsOpen(false);
    setTaxDetailOpen(false);
  };
  // Esc/关闭：子页先返回一级；一级再关 sheet
  const closeMain = () => {
    if (mobileSubView) {
      popSub();
      return;
    }
    setRetirementSettingsOpen(false);
    setTaxDetailOpen(false);
    setOpen(false);
  };
  const openRetirementSub = () => {
    setTaxDetailOpen(false);
    setRetirementSettingsOpen((current) => !current);
  };
  const openTaxSub = () => {
    setRetirementSettingsOpen(false);
    setTaxDetailOpen((current) => !current);
  };
  const panelTitle =
    mobileSubView === 'retirement'
    ? INCOME_DETAIL_SOCIAL_SETTINGS_PANEL_TITLE
    : mobileSubView === 'tax'
      ? INCOME_DETAIL_TAX_DETAIL_PANEL_TITLE
      : INCOME_DETAIL_DEDUCTION_PANEL_TITLE;
  const taxDetailBody = (
    <div data-sheet-subview="tax">
      <section className="space-y-3 text-sm">
        <p className="text-xs font-medium text-slate-600">专项附加扣除</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-coral"
                checked={
                  deductions.find((row) => row.name === '住房租金')?.enabled ??
                  false
                }
                onChange={(event) => onRentChange(event.target.checked)}
              />
              <span>
                住房租金
                <span className="ml-1 font-normal text-slate-400">
                  （勾选计入专项附加扣除）
                </span>
              </span>
            </span>
            <span className="mt-2 block text-xs text-slate-500">
              政策标准{' '}
              {money(
                deductions.find((row) => row.name === '住房租金')?.standard ??
                  0,
              )}{' '}
              / 月
            </span>
          </label>
          <label className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-coral"
                checked={
                  deductions.find((row) => row.name === '赡养老人')?.enabled ??
                  false
                }
                onChange={(event) => onElderlyChange(event.target.checked)}
              />
              <span>
                赡养老人
                <span className="ml-1 font-normal text-slate-400">
                  （勾选计入专项附加扣除）
                </span>
              </span>
            </span>
            <span className="mt-2 block text-xs text-slate-500">
              政策标准{' '}
              {money(
                deductions.find((row) => row.name === '赡养老人')?.standard ??
                  0,
              )}{' '}
              / 月
            </span>
          </label>
        </div>
        <div className="space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
          <div className="flex justify-between">
            <span>税前工资</span>
            <span className="tabular-nums text-slate-700">{money(salary)}</span>
          </div>
          <div className="flex justify-between">
            <span>个人五险一金</span>
            <span className="tabular-nums text-slate-700">-{money(total)}</span>
          </div>
          {deductions.map((row) => (
            <div key={row.name} className="flex justify-between">
              <span>{row.name}</span>
              <span className="tabular-nums text-slate-700">
                -{money(row.actual)}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-100 pt-1 font-medium text-slate-700">
            <span>应纳税所得额</span>
            <span className="tabular-nums">{money(taxable)}</span>
          </div>
          <div className="flex justify-between">
            <span>当前区间：税率 / 速算扣除数</span>
            <span className="tabular-nums">
              {bracket.rate}% / {money(bracket.quick)}
            </span>
          </div>
        </div>
      </section>
      <section className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
        <p className="text-xs text-slate-500">
          按当前应纳税所得额 {money(taxable)}{' '}
          分档累进；高亮为命中档。各档税额之和 = 本月预估个税。
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>月应纳税所得额</th>
                <th>税率</th>
                <th>本区间税额</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {bracketSliceRows.map((item) => (
                <tr
                  key={item.range}
                  className={
                    item.isCurrent ? 'bg-emerald-50 font-semibold' : ''
                  }
                >
                  <td>{item.range}</td>
                  <td>{item.rate}%</td>
                  <td className="tabular-nums">{money(item.sliceTax)}</td>
                  <td>{item.isCurrent ? '当前区间' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
        <p className="text-xs font-medium text-slate-600">
          纳税区间表（税率 / 速算扣除数）
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>月应纳税所得额</th>
                <th>税率</th>
                <th>速算扣除数</th>
                <th>当前状态</th>
              </tr>
            </thead>
            <tbody>
              {TAX_MONTHLY_BRACKETS.map((item) => (
                <tr
                  key={item.range}
                  className={
                    item.range === bracket.range
                      ? 'bg-emerald-50 font-semibold'
                      : ''
                  }
                >
                  <td>{item.range}</td>
                  <td>{item.rate}%</td>
                  <td>{money(item.quick)}</td>
                  <td>
                    {item.range === bracket.range ? '当前区间' : '可选区间'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
  return (
    <div className="relative block">
      <span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600 sm:flex-row">
        <span className="flex items-center gap-1">
          五险一金和个税
          <InfoTip>
            {
              '个人五险一金 + 本月预估个税。\n点金额打开明细；「退休与社保」在二级弹层设置。'
            }
          </InfoTip>
        </span>
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          onDoubleClick={() => setOpen(true)}
          title="点击查看明细"
          className="field-click self-start sm:self-auto"
        >
          -{money(deductionTotal)}
        </button>
      </span>
      <FloatPanel
        open={open}
        anchorRef={anchorRef}
        onClose={closeMain}
        onBack={mobileSubView ? popSub : undefined}
        width={620}
        headerTitle={panelTitle}
      >
        {mobileSubView === 'retirement' ? (
          <div data-sheet-subview="retirement">
            <RetirementSocialEditor
              retirement={retirement}
              retirementDate={retirementDate}
              onChange={onRetirementChange}
            />
            <div className="h-16 shrink-0" aria-hidden />
          </div>
        ) : mobileSubView === 'tax' ? (
          <>
            {taxDetailBody}
            <div className="h-16 shrink-0" aria-hidden />
          </>
        ) : (
        <>
        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">五险一金</h4>
          <label className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-coral"
                  checked={socialEnabled}
                  onChange={(event) =>
                    onSocialEnabledChange(event.target.checked)
                  }
                />
            <span className="font-medium">缴纳五险一金</span>
                <span className="text-xs text-slate-400">
                  {socialEnabled
                    ? '勾选后按费率扣个人/企业社保，并抵减个税'
                    : '未勾选：个人/企业均为 0，个税无社保扣减'}
                </span>
          </label>
          {/* 入口行 → 移动同 sheet 子页 / PC 二级 FloatPanel（nestedPanel）；勿在一级内折叠展开 */}
          <div className="relative">
            <button
              ref={retirementSettingsAnchorRef}
              type="button"
              onClick={openRetirementSub}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left text-sm hover:border-slate-200"
            >
                  <span className="font-medium text-slate-700">
                    {INCOME_DETAIL_SOCIAL_SETTINGS_ENTRY}
                  </span>
              <span className="tabular-nums text-xs text-slate-500">
                    {retirement.enabled
                      ? `已关联 · ${retirementDate || '待完善'}`
                      : '未关联'}
              </span>
            </button>
            {!isMobile && (
            <FloatPanel
              open={retirementSettingsOpen}
              anchorRef={retirementSettingsAnchorRef}
              onClose={() => setRetirementSettingsOpen(false)}
              width={360}
              maxHeightVh={72}
              zIndex={Z_INDEX.nestedPanel}
              headerTitle={INCOME_DETAIL_SOCIAL_SETTINGS_PANEL_TITLE}
              density="field"
            >
                    <RetirementSocialEditor
                      retirement={retirement}
                      retirementDate={retirementDate}
                      onChange={onRetirementChange}
                    />
            </FloatPanel>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      五险基数{' '}
                      <strong className="tabular-nums">
                        {money(insuranceBase)}
                      </strong>
                      {insuranceFollowSalary ? (
                        <span className="ml-1 text-xs text-slate-400">
                          按工资
                        </span>
                      ) : (
                        <span className="ml-1 text-xs text-slate-400">
                          自定义
                        </span>
                      )}
                    </span>
                    {!insuranceFollowSalary && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-coral-deep hover:underline"
                        onClick={onInsuranceFollowSalary}
                      >
                        恢复按工资
                      </button>
                    )}
              </div>
              <label className="mt-2 block text-xs text-slate-500">
                指定基数（≠ 税前工资）
                    <SoftNumberInput
                      className="field-input mt-1"
                      min={0}
                      step={1}
                      value={insuranceBase}
                      onCommit={onInsuranceBaseChange}
                    />
              </label>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      公积金基数{' '}
                      <strong className="tabular-nums">
                        {money(housingFundBase)}
                      </strong>
                      {housingFollowSalary ? (
                        <span className="ml-1 text-xs text-slate-400">
                          按工资
                        </span>
                      ) : (
                        <span className="ml-1 text-xs text-slate-400">
                          自定义
                        </span>
                      )}
                    </span>
                    {!housingFollowSalary && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-coral-deep hover:underline"
                        onClick={onHousingFollowSalary}
                      >
                        恢复按工资
                      </button>
                    )}
              </div>
              <label className="mt-2 block text-xs text-slate-500">
                指定基数（可与五险不同）
                    <SoftNumberInput
                      className="field-input mt-1"
                      min={0}
                      step={1}
                      value={housingFundBase}
                      onCommit={onHousingFundBaseChange}
                    />
              </label>
            </div>
          </div>
          <div className="table-wrap">
            <table>
                  <thead>
                    <tr>
                      <th>项目</th>
                      <th>基数</th>
                      <th>个人比例</th>
                      <th>个人金额</th>
                      <th>企业比例</th>
                      <th>企业金额</th>
                      <th>合计</th>
                    </tr>
                  </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                        <td className="tabular-nums text-xs text-slate-500">
                          {money(
                            row.base ??
                              (row.name === HOUSING_FUND_NAME
                                ? housingFundBase
                                : insuranceBase),
                          )}
                        </td>
                        <td>
                          {row.name === HOUSING_FUND_NAME ? (
                            <label className="inline-flex items-center gap-1">
                              <SoftNumberInput
                                className="field-input w-20"
                                min={5}
                                max={12}
                                step={0.1}
                                suffix="%"
                                value={housingPersonal}
                                onCommit={onHousingPersonalChange}
                              />
                              <span className="text-[10px] text-slate-400">
                                5–12
                              </span>
                            </label>
                          ) : (
                            `${row.personal}%`
                          )}
                        </td>
                    <td>{money(row.personalAmount)}</td>
                    <td>{row.company}%</td>
                    <td>{money(row.companyAmount)}</td>
                        <td className="tabular-nums font-medium">
                          {money(row.personalAmount + row.companyAmount)}
                        </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
                <div className="flex justify-between">
                  <span>个人缴纳合计</span>
                  <span className="tabular-nums font-semibold">
                    -{money(total)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>企业缴纳合计</span>
                  <span className="tabular-nums font-semibold">
                    {money(companyTotal)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>双方合计</span>
                  <span className="tabular-nums">{money(bothTotal)}</span>
                </div>
            <div className="flex items-center justify-between gap-2 text-slate-600">
                  <span className="flex items-center gap-1">
                    社保总负担
                    <InfoTip>
                      {
                        '个人和公司缴纳的社保、公积金合计，占工资和公司缴纳总额的比例。\n不包含个税；关闭缴纳时为 0。'
                      }
                    </InfoTip>
                  </span>
                  <span className="tabular-nums font-semibold text-ink">
                    {burdenSharePct == null
                      ? '—'
                      : `${roundPct(burdenSharePct)}%`}
                  </span>
            </div>
          </div>
        </section>
        {/* 一级个税区：仅预估摘要 + 查看明细；专项附加扣除进二级 */}
        <section className="mt-6 space-y-3 border-t border-slate-100 pt-4">
          <h4 className="flex items-center gap-1 text-sm font-semibold text-slate-700">
            个税
                <InfoTip>
                  {
                    '专项附加扣除在「查看明细」中勾选。\n一级仅展示本月预估个税摘要。'
                  }
                </InfoTip>
          </h4>
          <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>应纳税所得额</span>
                  <strong>{money(taxable)}</strong>
                </div>
            <div className="relative flex items-center justify-between gap-2 border-t border-slate-100 pt-2 font-semibold">
              <span>本月预估个税</span>
              <span className="flex items-center gap-2">
                <button
                  ref={taxDetailAnchorRef}
                  type="button"
                  onClick={openTaxSub}
                  className="text-xs font-semibold text-coral-deep hover:underline"
                >
                  {INCOME_DETAIL_TAX_DETAIL_ENTRY}
                </button>
                <strong className="text-red-500">-{money(tax)}</strong>
              </span>
              {/* 二级：抵扣 → 各区间税额 → 税率表；移动同 sheet 子页，PC nestedPanel；勿双标题 */}
              {!isMobile && (
              <FloatPanel
                open={taxDetailOpen}
                anchorRef={taxDetailAnchorRef}
                onClose={() => setTaxDetailOpen(false)}
                width={560}
                maxHeightVh={72}
                zIndex={Z_INDEX.nestedPanel}
                headerTitle={INCOME_DETAIL_TAX_DETAIL_PANEL_TITLE}
              >
                {taxDetailBody}
              </FloatPanel>
              )}
            </div>
                <div className="flex justify-between border-t border-slate-100 pt-2">
                  <span className="flex items-center gap-1">
                    到手收入（主区同步）
                    <InfoTip>税前工资 − 五险一金 − 本月个税</InfoTip>
                  </span>
                  <strong>{money(net)}</strong>
                </div>
          </div>
        </section>
        {/* 底部留白：移动 sheet / 矮屏可滚过最后一行，避免贴底截断 */}
        <div className="h-16 shrink-0" aria-hidden />
        </>
        )}
      </FloatPanel>
    </div>
  );
}
