'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import ReactECharts from 'echarts-for-react';
import InstallToDesktop from './InstallToDesktop';
import PanelHeader from './components/PanelHeader';
import { useRouter } from 'next/navigation';
import AuthBar, { logoutSession, type AuthUser } from './AuthBar';
import { authHref } from '../lib/auth/authHref';
import { restartSite } from '../lib/restartSite';
import { useIsMobile } from '../lib/useIsMobile';
import { ensureFocusedInVisualViewportNow, scrollFocusedFieldIntoView } from '../lib/useVisualViewport';
import { FLOAT_MARGIN, placeCenteredInViewport, placeNearAnchor, placeSheetAtBottom, readSafeAreaInsets, viewportBounds } from '../lib/floatPlace';
import { Z_INDEX } from '../lib/ui/zIndex';
import { acquireSheetBodyLock, blockOverlayEvent } from '../lib/ui/overlayEvents';
import { LIGHT_DEMO_ASSETS, LIGHT_DEMO_EXPENSES } from '../lib/demoDefaults';
import { buildDecisionSummary } from '../lib/decisionSummary';
import { profileSyncAlert } from '../lib/profileSyncAlert';
import { pickActiveSection, stickyAwareScrollY } from '../lib/sectionNav';
import { loadGuestDraft, saveGuestDraft } from '../lib/persistence/guestDraft';
import { explainInstallmentPayment, installmentMonthlyPayment, installmentPaymentAsOf, migrateInstallmentTerms, type PageRepaymentMode as RepaymentMode } from './installmentPayment';
import { cashFlowRatios, remainDisposableSharePct, roundPct } from './cashFlowRatios';
import {
  aggregateMonthlyExpenses,
  nonInstallmentRecurring,
} from './monthlyExpenseAggregate';
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
import { assetAxisBounds, buildMonthlyAssetForecast, yearlyTotalsFromMonthly } from './assetForecast';
import { createProfileSyncQueue, type ProfileSyncStatus } from '../lib/persistence/profileSync';
import {
  clampInstallmentTerm,
  defaultOneTimeDate,
  isActiveInMonth,
  monthKey,
  resolveExpenseSpan,
  todayDateKey,
  todayMonthKey,
} from './expenseSpan';
import { expenseDeleteMessage } from './deleteConfirm';
import { calcSocialBurdenSharePct, resolveContributionBase } from '../domain/social-security/index';
import { CITY_SOCIAL_BASE_PRESETS, defaultSocialBase, resolveCitySocialBase } from '../domain/social-security/city-bases';
import { DEFAULT_INCOME_VIEW_MODE, parseIncomeViewMode, resolveDisposableIncome, seedTakeHomeIncome, type IncomeViewMode } from '../domain/income/index';
import { softNumberCommit, softNumberIsInvalid, softNumberLive } from './softNumber';
import { clampNumberField, formatEditableNumber, type NumberFieldKind } from './numberFieldUi';
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

type Expense = { id: string; name: string; category: string; mode: 'fixed' | 'percentage' | 'installment' | 'one_time'; amount: number; rate?: number; total?: number; downPayment?: number; term?: number; interest?: number; repaymentMode?: RepaymentMode; startDate?: string; endDate?: string; followRetirement?: boolean };
/** max 可选：有则 blur clamp；一律原地 inline（不为 slider 弹窗） */
type EditableProps = { label: string; value: number; min?: number; max?: number; step: number; suffix?: string; kind?: NumberFieldKind; tip?: ReactNode; onChange: (value: number) => void };
type SocialRate = { personal: number; company: number };
type RetirementSetting = {
  enabled: boolean;
  birthDate: string;
  identity: string;
  insuranceStartDate: string;
  contributionYears: number;
  base: number;
};
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const money = (value: number) => `¥${Math.round(value).toLocaleString('zh-CN')}`;
/** 资产走势 Y 轴：元 → 万元（数据仍为元；120000 → 12） */
const moneyWan = (value: number) => {
  const wan = value / 10000;
  return Number.isInteger(wan) ? String(wan) : wan.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
};
/** 相对年偏移 → 日历年标签（0=现在，5→2031年） */
const forecastYearLabel = (offsetYears: number, baseYear = new Date().getFullYear()) => (
  offsetYears === 0 ? '现在' : `${baseYear + offsetYears}年`
);
// 差异色：增加=主题橙红，减少=主题绿
const DELTA_UP = '#f07f62';
const DELTA_DOWN = '#3d8f6e';
const deltaTone = (delta: number) => (delta > 0 ? DELTA_UP : delta < 0 ? DELTA_DOWN : '#94a3b8');
const uid = () => `expense-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
/** 支出草稿深拷贝；补齐缺省 startDate，避免浅拷贝/陈旧 state */
const cloneExpenseDraft = (source: Expense): Expense => {
  const next = structuredClone(source);
  if (!next.startDate) {
    next.startDate = next.mode === 'one_time' ? defaultOneTimeDate() : todayDateKey();
  }
  if (next.mode === 'one_time') next.endDate = next.startDate;
  return next;
};
// P1-2：轻演示（房租+餐饮）；日期运行时补
const initialExpenses: Expense[] = LIGHT_DEMO_EXPENSES.map((row) => ({ ...row, startDate: todayDateKey() }));
const retirementDefaults: RetirementSetting = { enabled: false, birthDate: '1996-01-01', identity: 'male', insuranceStartDate: '2016-01-01', contributionYears: 20, base: defaultSocialBase() };
const addMonths = (date: string, months: number) => { const next = new Date(`${date || new Date().toISOString().slice(0, 10)}T00:00:00`); next.setMonth(next.getMonth() + months); return next.toISOString().slice(0, 10); };
const retirementDateFor = (birthDate: string, identity: string) => { const birth = new Date(`${birthDate}T00:00:00`); if (Number.isNaN(birth.getTime())) return ''; const age = identity === 'female-worker' ? 55 : identity === 'female-cadre' ? 58 : 63; birth.setFullYear(birth.getFullYear() + age); return birth.toISOString().slice(0, 10); };
const defaultSocialRates: Record<string, SocialRate> = { 养老保险: { personal: 8, company: 16 }, 医疗保险: { personal: 2, company: 6 }, 失业保险: { personal: 0.5, company: 0.5 }, 工伤保险: { personal: 0, company: 0.4 }, 生育保险: { personal: 0, company: 0.8 }, 住房公积金: { personal: 5, company: 5 } };
const ADJUSTED_AVAILABLE_ASSETS_TIP = '手里还能动用的钱：流动资产先扣分期未付首付，再扣现金备用金（备用金=现金；扣完不够按 0）。';
const EMERGENCY_CASH_MODE_TIP = '「默认」：一级直接改现金。「应急月数」：点「设置」填往年支出（÷12 得月均）和月数，推算现金并联动理财。';
const EMERGENCY_ANNUAL_SPEND_TIP = '填大概一年花多少。系统自动 ÷12 得到每月支出，用来算备用金。';
const EMERGENCY_MONTHS_FIELD_TIP = '想留几个月生活费。现金 = 每月支出 × 应急月数；改了会同步理财（现金+理财=总资产）。';
/** 消费分析：勾选说明（点开会怎样） */
const ANALYZE_PICK_TIP = '勾一笔或多笔支出，下面图按勾选顺序叠起来看影响。\n哪行点「分析」都是同一面板；默认勾上该行，可随时改。';
/** 消费分析：投资拆层 */
const ANALYZE_INVEST_TIP = '勾选后，把「还剩多少」再拆成：按闲钱投资比例进理财的部分，和可随便花的部分。\n剩≤0 时投资为 0。';
/** 消费分析：占比图 */
const ANALYZE_CHART_TIP = '看各笔支出占到手收入的比重；勾了投资拆层时，剩余再分成投资与可花费。';
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
      const vp = viewportBounds(vv, window.innerWidth, window.innerHeight, FLOAT_MARGIN, readSafeAreaInsets());
      const rect = anchor.getBoundingClientRect();
      const next = placeNearAnchor(rect, tip.offsetWidth || 256, tip.offsetHeight || 80, vp, 8, 'center');
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
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const tipNode = open && (
    <>
      {isMobile && <button type="button" aria-label="关闭说明" className="fixed inset-0 cursor-default bg-transparent" style={{ zIndex: Z_INDEX.tipBackdrop }} onClick={() => setOpen(false)} />}
      {createPortal(
        <span
          ref={tipRef}
          role="tooltip"
          className={`fixed w-64 max-w-[calc(100vw-2rem)] rounded-xl bg-[#17212b] p-3 text-left text-xs font-normal leading-5 text-white shadow-xl whitespace-pre-line ${isMobile ? '' : 'pointer-events-none'}`}
          style={{ top: tipPos.top, left: tipPos.left, zIndex: Z_INDEX.tip }}
        >
          {children}
        </span>,
        document.body,
      )}
    </>
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
        className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-xs font-semibold text-slate-500 hover:border-[#f07f62] hover:text-[#d9654a]"
      >
        ?
      </button>
      {tipNode}
    </span>
  );
};
const SectionTitle = ({ eyebrow, title, tip, compact = false }: { eyebrow?: string; title: string; tip?: ReactNode; compact?: boolean }) => <div className="flex min-w-0 items-center gap-2">{eyebrow && <p className="eyebrow shrink-0">{eyebrow}</p>}<h2 className={`${compact ? 'text-lg' : 'text-lg sm:text-2xl'} min-w-0 font-semibold leading-tight`}>{title}</h2>{tip && <InfoTip>{tip}</InfoTip>}</div>;

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
const repaymentModeLabel = (mode?: RepaymentMode) => (mode === 'equal_principal' ? '等额本金' : '等额本息');
function computeFinanceResult({ salary, contributionBase, housingFundBase, socialEnabled = true, incomeViewMode = DEFAULT_INCOME_VIEW_MODE, takeHomeIncome, cash, invest, returnRate, emergencyMonths, emergency, totalAssets, expenses, rentEnabled, elderlyEnabled, socialRates }: FinanceInput) {
  // 五险 / 公积金各自缺省跟工资；关闭缴纳时金额全 0（个税按无社保扣减）
  const insuranceBase = resolveContributionBase(salary, contributionBase);
  const fundBase = resolveContributionBase(salary, housingFundBase);
  const socialRows = Object.entries(socialRates).map(([name, rates]) => {
    const base = name === HOUSING_FUND_NAME ? fundBase : insuranceBase;
    return {
      name,
      personal: rates.personal,
      company: rates.company,
      personalAmount: socialEnabled ? base * rates.personal / 100 : 0,
      companyAmount: socialEnabled ? base * rates.company / 100 : 0,
      base,
    };
  });
  const social = socialRows.reduce((sum, row) => sum + row.personalAmount, 0);
  const deductions = [
    { name: '基本减除费用', enabled: true, standard: 5000, rate: 100 },
    { name: '住房租金', enabled: rentEnabled, standard: 1500, rate: rentEnabled ? 100 : 0 },
    { name: '赡养老人', enabled: elderlyEnabled, standard: 2000, rate: elderlyEnabled ? 100 : 0 },
  ].map((row) => ({ ...row, actual: row.standard * row.rate / 100 }));
  const taxable = Math.max(0, salary - social - deductions.reduce((sum, row) => sum + row.actual, 0));
  const tax = taxable <= 3000 ? taxable * 0.03 : taxable <= 12000 ? taxable * 0.1 - 210 : taxable <= 25000 ? taxable * 0.2 - 1410 : taxable <= 35000 ? taxable * 0.25 - 2660 : taxable <= 55000 ? taxable * 0.3 - 4410 : taxable <= 80000 ? taxable * 0.35 - 7160 : taxable * 0.45 - 15160;
  // 详细路径净收入；简便模式优先用用户声明的到手（结余/预测收入侧）
  const computedNet = salary - social - Math.max(0, tax);
  const net = resolveDisposableIncome(incomeViewMode, takeHomeIncome, computedNet);
  const investmentIncome = invest * returnRate / 100 / 12;
  // 本月支出与剩余% / 决策摘要同源聚合
  const spend = aggregateMonthlyExpenses(expenses, net, investmentIncome);
  const recurring = spend.recurring;
  const oneTime = spend.oneTime;
  const monthlyExpenses = spend.monthly;
  const debt = spend.debt;
  const committedDownPayments = expenses.filter((expense) => expense.mode === 'installment').reduce((sum, expense) => sum + (expense.downPayment || 0), 0);
  const liquidAssets = cash + invest;
  // 兼容旧调用：未传 emergency 时，也组装成两套分存的完整结构。
  const legacyMonths = Number.isFinite(emergencyMonths) ? Math.max(0, emergencyMonths ?? 0) : 0;
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
  const emergencyReserveAmount = emergencyReserve(emergencySetting, monthlyExpenses, cash);
  const adjustedAvailableAssets = Math.max(0, liquidAssets - committedDownPayments - emergencyReserveAmount);
  const totalLiabilities = expenses.filter((expense) => expense.mode === 'installment').reduce((sum, expense) => sum + Math.max(0, (expense.total || 0) - (expense.downPayment || 0)), 0);
  const netWorth = totalAssets - totalLiabilities;
  const surplus = net + investmentIncome - monthlyExpenses;
  // 分母=可支配收入 net（与占比图一致）；剩余 = 100 − 支出占比，超支可为负
  const { expensePct } = cashFlowRatios({ debt, otherExpenses: Math.max(0, monthlyExpenses - debt), income: net });
  const remainDisposablePct = remainDisposableSharePct(expensePct);
  return { socialRows, social, deductions, tax: Math.max(0, tax), net, detailNet: computedNet, investmentIncome, monthlyExpenses, recurringMonthlyExpenses: recurring, oneTimeTotal: oneTime, surplus, emergency: emergencySetting.monthsPlan.months, emergencyReserve: emergencyReserveAmount, emergencySetting, debt, remainDisposablePct, committedDownPayments, liquidAssets, adjustedAvailableAssets, totalLiabilities, netWorth };
}
// 年度对比复用月度资产内核，避免主图与消费分析使用不同收益/结余口径。
function forecastYearlyTotals(cash: number, invest: number, returnRate: number, reinvest: ReinvestSetting, net: number, recurringMonthly: number, oneTime: number, committedDownPayments: number) {
  return yearlyTotalsFromMonthly({
    cash,
    investment: invest,
    annualReturnRate: returnRate,
    disposableIncomeMonthly: net,
    recurringExpenseMonthly: recurringMonthly,
    oneTimeExpense: oneTime,
    reinvest,
    committedDownPayments,
    years: 30,
  }).map((row) => ({ ...row, label: forecastYearLabel(row.year) }));
}

/** 逐月支出占可支配收入占比（分母=税后净收入 net，与面板「可支配收入」一致） */
function forecastExpenseShareByMonth(
  expenses: Expense[],
  disposableIncome: number,
  investmentIncome: number,
  months = 360,
  retirementDate?: string,
) {
  const anchor = new Date().toISOString().slice(0, 10);
  return Array.from({ length: months }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() + index);
    const dateKey = date.toISOString().slice(0, 10);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    let debt = 0;
    let other = 0;
    for (const expense of expenses) {
      if (expense.mode === 'installment') {
        debt += installmentPaymentAsOf(expense, dateKey, anchor);
        continue;
      }
      if (!isActiveInMonth(expense, yearMonth, { retirementDate })) continue;
      if (expense.mode === 'percentage') {
        other += (disposableIncome + investmentIncome) * (expense.rate || 0) / 100;
      } else {
        other += expense.amount;
      }
    }
    const { expensePct } = cashFlowRatios({ debt, otherExpenses: other, income: disposableIncome });
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
  const [emergencyEnabled, setEmergencyEnabled] = useState(DEFAULT_EMERGENCY.enabled);
  const [emergencyMode, setEmergencyMode] = useState<EmergencyMode>(DEFAULT_EMERGENCY.mode);
  // 与演示现金同起点，避免未 hydrate 时切模式把默认现金写成 0
  const [emergencyCashDirect, setEmergencyCashDirect] = useState<number>(LIGHT_DEMO_ASSETS.cash);
  const [emergencyMonths, setEmergencyMonths] = useState(DEFAULT_EMERGENCY.monthsPlan.months);
  const [emergencyMonthsCash, setEmergencyMonthsCash] = useState(DEFAULT_EMERGENCY.monthsPlan.cash);
  const [emergencyAnnualSpend, setEmergencyAnnualSpend] = useState(DEFAULT_EMERGENCY.monthsPlan.annualSpend);
  const [totalAssets, setTotalAssets] = useState<number>(LIGHT_DEMO_ASSETS.totalAssets);
  const [invest, setInvest] = useState<number>(LIGHT_DEMO_ASSETS.invest);
  const [investRatio, setInvestRatio] = useState<number>(LIGHT_DEMO_ASSETS.investRatio);
  const [returnRate, setReturnRate] = useState<number>(3.2);
  const [reinvestMode, setReinvestMode] = useState<ReinvestMode>(DEFAULT_REINVEST.mode);
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
  const [incomeViewMode, setIncomeViewMode] = useState<IncomeViewMode>(DEFAULT_INCOME_VIEW_MODE);
  // 简便套独立字段；缺省 null，hydrate/切模式后用 detailNet 播种一次（不改详细套）
  const [takeHomeIncome, setTakeHomeIncome] = useState<number | null>(null);
  const takeHomeSeededRef = useRef(false);
  const [showAssetDetails, setShowAssetDetails] = useState(false);
  const assetDetailBtnRef = useRef<HTMLButtonElement>(null);
  const [visibleAssetLines, setVisibleAssetLines] = useState({ cash: true, investment: true, total: true });
  const [visibleCashFlowLines, setVisibleCashFlowLines] = useState({ dti: true, expense: true, savings: true });
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [rentEnabled, setRentEnabled] = useState(true);
  const [elderlyEnabled, setElderlyEnabled] = useState(false);
  const elderlyShare = 100;
  const setElderlyShare = (_value: number) => undefined;
  const [savedAt, setSavedAt] = useState('');
  const [profileSyncStatus, setProfileSyncStatus] = useState<ProfileSyncStatus>({ phase: 'idle' });
  const [hydrated, setHydrated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [retirement, setRetirement] = useState(retirementDefaults);
  const isNarrow = useIsMobile();
  const router = useRouter();
  const profileSyncRef = useRef<ReturnType<typeof createProfileSyncQueue> | null>(null);
  if (!profileSyncRef.current) {
    profileSyncRef.current = createProfileSyncQueue({ onStatus: setProfileSyncStatus });
  }
  // 顶栏下拉菜单（原「更多」文案）：收纳安装 / 已保存 / 登出·登录
  const [headerMoreOpen, setHeaderMoreOpen] = useState(false);
  // portal 到 body：避开 sticky 顶栏 stacking / overflow 裁切
  const headerMoreBtnRef = useRef<HTMLButtonElement>(null);
  const headerMoreMenuRef = useRef<HTMLDivElement>(null);
  const [headerMorePos, setHeaderMorePos] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    if (!headerMoreOpen) return;
    const MENU_W = 208; // w-52
    const place = () => {
      const btn = headerMoreBtnRef.current;
      const menu = headerMoreMenuRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const vv = window.visualViewport;
      const vp = viewportBounds(vv, window.innerWidth, window.innerHeight, FLOAT_MARGIN, readSafeAreaInsets());
      const h = menu?.offsetHeight || 220;
      // 右对齐触发钮：伪锚点宽度 = 菜单宽
      const next = placeNearAnchor(
        { top: rect.top, left: rect.right - MENU_W, right: rect.right, bottom: rect.bottom, width: MENU_W, height: rect.height },
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
  }, [headerMoreOpen]);
  // 分区 chips scroll spy：滚动高亮 + 点击立即切（P1-4）
  const SECTION_IDS = ['sec-params', 'sec-expenses', 'sec-charts'] as const;
  const [activeSection, setActiveSection] = useState('sec-params');
  const stickyTopRef = useRef<HTMLDivElement | null>(null);
  const spyLockUntilRef = useRef(0);
  const scrollToSection = (id: string) => {
    setActiveSection(id);
    spyLockUntilRef.current = Date.now() + 1200;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const stickyPx = stickyTopRef.current?.getBoundingClientRect().height
      ?? (isNarrow ? 168 : 72);
    window.requestAnimationFrame(() => {
      const top = el.getBoundingClientRect().top;
      if (Math.abs(top - stickyPx) > 24) {
        window.scrollTo({
          top: stickyAwareScrollY(top, window.scrollY, stickyPx),
          behavior: 'smooth',
        });
      }
    });
  };
  useEffect(() => {
    if (!hydrated) return;
    const ids = [...SECTION_IDS];
    const ratios: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
    const readDistances = () => {
      const mid = window.innerHeight / 2;
      const distances: Record<string, number> = {};
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        distances[id] = Math.abs(rect.top + rect.height / 2 - mid);
      }
      return distances;
    };
    const applySpy = () => {
      if (Date.now() < spyLockUntilRef.current) return;
      setActiveSection(pickActiveSection(ids, ratios, readDistances()));
    };
    const rootMargin = isNarrow ? '-22% 0px -48% 0px' : '-10% 0px -55% 0px';
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        ratios[entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0;
      }
      applySpy();
    }, { rootMargin, threshold: [0, 0.1, 0.25, 0.4, 0.55, 0.75] });
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    window.addEventListener('scroll', applySpy, { passive: true });
    applySpy();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', applySpy);
    };
  }, [isNarrow, hydrated]);
  // 列表删除二次确认（支出桌面/移动）；复用 FloatPanel field 矮卡
  const [pendingDelete, setPendingDelete] = useState<null | { kind: 'expense'; id: string; title: string; message: string }>(null);
  const deleteAnchorRef = useRef<HTMLElement | null>(null);
  const askDelete = (anchor: HTMLElement | null, payload: { kind: 'expense'; id: string; title: string; message: string }) => {
    deleteAnchorRef.current = anchor;
    setPendingDelete(payload);
  };

  const applyProfileData = (data: Record<string, unknown>) => {
      if (data.salary) setSalary(Number(data.salary)); if (data.cash !== undefined) setCash(Number(data.cash));
      {
        const parsed = parseEmergencySetting(data);
        setEmergencyEnabled(parsed.enabled);
        setEmergencyMode(parsed.mode);
        setEmergencyCashDirect(parsed.cashDirect);
        setEmergencyMonths(parsed.monthsPlan.months);
        setEmergencyMonthsCash(parsed.monthsPlan.cash);
        setEmergencyAnnualSpend(parsed.monthsPlan.annualSpend);
      }
      if (data.totalAssets !== undefined) setTotalAssets(Number(data.totalAssets));
      if (data.invest !== undefined) setInvest(Number(data.invest));
      // 现金由总资产与理财推导，保证三者一致
      if (data.totalAssets !== undefined && data.invest !== undefined) {
        const total = Math.max(0, Number(data.totalAssets));
        const investAmount = clamp(Number(data.invest), 0, total);
        setCash(total - investAmount);
        setInvestRatio(total ? investAmount / total * 100 : 0);
      } else if (data.investRatio !== undefined) setInvestRatio(Number(data.investRatio)); if (data.returnRate !== undefined) setReturnRate(Number(data.returnRate));
      // 旧画像仅 reinvestRate → percent；新字段 reinvestMode / reinvestAmount
      {
        const parsed = parseReinvestSetting(data);
        setReinvestMode(parsed.mode);
        setReinvestRate(parsed.rate);
        setReinvestAmount(parsed.amount);
      }
      if (data.socialRates) setSocialRates({ ...defaultSocialRates, ...(data.socialRates as typeof defaultSocialRates) });
      // 旧 contributionBase → 五险基数；缺省字段 → 跟工资
      if (data.contributionBase !== undefined && data.contributionBase !== null && Number.isFinite(Number(data.contributionBase))) {
        setContributionBase(Math.max(0, Number(data.contributionBase)));
      } else {
        setContributionBase(null);
      }
      // 公积金独立；旧画像无此字段 → 跟工资（非跟五险）
      if (data.housingFundBase !== undefined && data.housingFundBase !== null && Number.isFinite(Number(data.housingFundBase))) {
        setHousingFundBase(Math.max(0, Number(data.housingFundBase)));
      } else {
        setHousingFundBase(null);
      }
      setSocialEnabled(data.socialEnabled !== false);
      setIncomeViewMode(parseIncomeViewMode(data.incomeViewMode));
      if (data.takeHomeIncome !== undefined && data.takeHomeIncome !== null && Number.isFinite(Number(data.takeHomeIncome))) {
        setTakeHomeIncome(Math.max(0, Number(data.takeHomeIncome)));
        takeHomeSeededRef.current = true; // 已有简便套，勿再播种覆盖
      } else {
        setTakeHomeIncome(null);
        takeHomeSeededRef.current = false; // 缺字段 → hydrate 后按 detailNet 播种
      }
      if (data.expenses) {
        // 年误存为月（如房贷 term=30）→ 写回真正月数 360，autosave 会落盘
        setExpenses(migrateInstallmentTerms((data.expenses as Expense[]).map((item: Expense) => {
          if (item.mode === 'one_time' && !item.startDate) {
            const start = defaultOneTimeDate();
            return { ...item, startDate: start, endDate: start };
          }
          return item;
        })));
      }
      if (data.rentEnabled !== undefined) setRentEnabled(Boolean(data.rentEnabled));
      if (data.elderlyEnabled !== undefined) setElderlyEnabled(Boolean(data.elderlyEnabled));
      // ponytail: 旧 profile.snapshots 忽略，不再 hydrate
      if (data.retirement) setRetirement({ ...retirementDefaults, ...(data.retirement as typeof retirementDefaults) });
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
      } catch { /* 无会话 → 访客 */ }
      if (!cancelled) setAuthReady(true);

      // 访客：本机草稿或内存 LIGHT_DEMO；不打云端
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
          if (!cancelled) profileSyncRef.current?.setRevision(Number(state?.revision) || 0);
          if (!cancelled && state?.profile && Object.keys(state.profile).length > 0) {
            applyProfileData(state.profile as Record<string, unknown>);
          } else {
            const saved = loadGuestDraft();
            if (!cancelled && saved) applyProfileData(saved);
          }
        }
      } catch {
        const saved = loadGuestDraft();
        if (!cancelled && saved) applyProfileData(saved);
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
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
    [emergencyEnabled, emergencyMode, emergencyCashDirect, emergencyMonths, emergencyMonthsCash, emergencyAnnualSpend],
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
  };
  const save = () => {
    // 访客与登录均写本机；云端仅登录后 enqueue
    saveGuestDraft(profile);
    setSavedAt(new Date().toLocaleTimeString('zh-CN'));
  };

  // 登出 → 访客：保留当前内存作本机草稿，不再打云端
  const handleLogout = () => {
    setAuthUser(null);
    profileSyncRef.current?.setRevision(0);
    setProfileSyncStatus({ phase: 'idle' });
    setSavedAt('');
    setHeaderMoreOpen(false);
    setHydrated(true);
    try {
      saveGuestDraft(profile);
    } catch { /* ignore */ }
  };

  // 访客只写 localStorage；登录后再防抖同步云端
  useEffect(() => {
    if (!hydrated) return;
    if (authUser) setProfileSyncStatus({ phase: 'syncing' });
    const timer = window.setTimeout(() => {
      save();
      if (!authUser) return;
      // ponytail: 云端 schema 仍带 snapshots:[]，不再写入业务快照
      void profileSyncRef.current?.enqueue({ profile, snapshots: [], scenarios: [] });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [hydrated, authUser, salary, contributionBase, housingFundBase, socialEnabled, incomeViewMode, takeHomeIncome, cash, emergencyEnabled, emergencyMode, emergencyCashDirect, emergencyMonths, emergencyMonthsCash, emergencyAnnualSpend, totalAssets, invest, investRatio, returnRate, reinvestMode, reinvestRate, reinvestAmount, socialRates, expenses, rentEnabled, elderlyEnabled, retirement]);
  const retirementDate = retirementDateFor(retirement.birthDate, retirement.identity);
  const updateRetirement = (patch: Partial<typeof retirement>) => setRetirement((current) => ({ ...current, ...patch }));
  // 现金 = 总资产 - 理财；改任一端同步另外两端
  const syncAssets = (nextTotal: number, nextInvest: number) => {
    const total = Math.max(0, nextTotal);
    const investAmount = clamp(nextInvest, 0, total);
    const nextCash = total - investAmount;
    setTotalAssets(total);
    setInvest(investAmount);
    setCash(nextCash);
    setInvestRatio(total ? investAmount / total * 100 : 0);
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
  const committedDownPayments = expenses.filter((expense) => expense.mode === 'installment').reduce((sum, expense) => sum + (expense.downPayment || 0), 0);

  const effectiveInsuranceBase = resolveContributionBase(salary, contributionBase);
  const effectiveHousingFundBase = resolveContributionBase(salary, housingFundBase);
  const financeInput = useMemo(
    () => ({ salary, contributionBase, housingFundBase, socialEnabled, incomeViewMode, takeHomeIncome, cash, invest, returnRate, emergency: emergencySetting, totalAssets, expenses, rentEnabled, elderlyEnabled, socialRates }),
    [salary, contributionBase, housingFundBase, socialEnabled, incomeViewMode, takeHomeIncome, cash, invest, returnRate, emergencySetting, totalAssets, expenses, rentEnabled, elderlyEnabled, socialRates],
  );
  const result = useMemo(() => computeFinanceResult(financeInput), [financeInput]);

  // 规划月均：往年÷12，缺省回退账本本月支出
  const planMonthly = resolvePlanMonthly(emergencySetting.monthsPlan.annualSpend, result.monthlyExpenses);
  const syncEmergencyWithCash = (nextCash: number) => {
    applyEmergencySetting(syncSettingFromCash(emergencySetting, nextCash, result.monthlyExpenses));
  };
  const updateTotalAssets = (value: number) => {
    const nextCash = syncAssets(value, Math.min(invest, Math.max(0, value)));
    syncEmergencyWithCash(nextCash);
  };
  const updateCash = (value: number) => {
    const nextCash = clamp(value, 0, totalAssets);
    syncAssets(totalAssets, totalAssets - nextCash);
    // 直接填现金：强制 amount 模式，只写 cashDirect
    applyEmergencySetting(syncSettingFromCash(
      { ...emergencySetting, mode: 'amount' },
      nextCash,
      result.monthlyExpenses,
    ));
  };
  const updateInvestByAmount = (value: number) => {
    const availableCap = Math.max(0, totalAssets - committedDownPayments);
    const nextCash = syncAssets(totalAssets, clamp(value, 0, availableCap));
    syncEmergencyWithCash(nextCash);
  };
  const updateInvestByRatio = (value: number) => {
    const ratio = clamp(value, 0, 100);
    const availableCap = Math.max(0, totalAssets - committedDownPayments);
    const nextCash = syncAssets(totalAssets, Math.min(availableCap, totalAssets * ratio / 100));
    syncEmergencyWithCash(nextCash);
  };
  /** 应急月数 → 现金 = 月均×月数，联动理财；只写 monthsPlan */
  const updateCashByMonths = (months: number) => {
    const monthly = resolvePlanMonthly(emergencySetting.monthsPlan.annualSpend, result.monthlyExpenses);
    const { cash: nextCash, setting } = applyMonthsPlan(emergencySetting, months, monthly, totalAssets);
    applyEmergencySetting(setting);
    syncAssets(totalAssets, totalAssets - nextCash);
  };
  /** 往年支出 → ÷12 月均 × 当前月数 → 现金 */
  const updateAnnualSpend = (annual: number) => {
    const { cash: nextCash, setting } = applyAnnualSpendPlan(emergencySetting, annual, totalAssets);
    applyEmergencySetting(setting);
    syncAssets(totalAssets, totalAssets - nextCash);
  };
  /** select「默认」/「应急月数」→ 只切 mode，恢复对应套现金，另一套保留 */
  const setMonthsPlanChecked = (checked: boolean) => {
    const next = checked
      ? enableMonthsPlan(emergencySetting, result.monthlyExpenses)
      : switchEmergencyMode(emergencySetting, 'amount', result.monthlyExpenses);
    const nextCash = clamp(activeCash(next), 0, totalAssets);
    applyEmergencySetting(syncSettingFromCash(next, nextCash, result.monthlyExpenses));
    syncAssets(totalAssets, totalAssets - nextCash);
  };

  // 切到简便：若尚未声明到手，用详细套 detailNet 播种（不碰详细字段）
  const setIncomeViewModeSafe = (mode: IncomeViewMode) => {
    if (mode === 'takehome') {
      setTakeHomeIncome((current) => seedTakeHomeIncome(current, result.detailNet));
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
      const nodes = document.querySelectorAll<HTMLElement>(`[data-expense-anchor="${id}"]`);
      const el = Array.from(nodes).find((n) => n.getClientRects().length > 0) || nodes[0];
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };
  const updateExpense = (id: string, patch: Partial<Expense>) => setExpenses((items) => items.map((item) => {
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
      next.term = clampInstallmentTerm(start, next.term || 1, Boolean(next.followRetirement), retirement.enabled ? retirementDate : undefined);
      if (next.followRetirement && retirement.enabled && retirementDate) {
        const span = resolveExpenseSpan(next, { retirementDate });
        next.endDate = span.end;
      }
    }
    return next;
  }));
  const removeExpense = (id: string) => setExpenses((items) => items.filter((item) => item.id !== id));
  const requestRemoveExpense = (expense: Expense, anchor: HTMLElement | null) => {
    askDelete(anchor, {
      kind: 'expense',
      id: expense.id,
      title: '删除支出',
      message: expenseDeleteMessage(expense.name, formatExpenseMode(expense.mode), formatExpensePayment(expense)),
    });
  };
  const today = new Date().toISOString().slice(0, 10);
  // 剩余可支配占比曲线：与占比图同口径（分母=可支配收入）；逐月真实分期月供
  const remainForecast = useMemo(() => {
    const rows = forecastExpenseShareByMonth(
      expenses,
      result.net,
      result.investmentIncome,
      360,
      retirement.enabled ? retirementDate : undefined,
    );
    return rows.map((row) => ({
      label: row.label,
      value: remainDisposableSharePct(row.pct),
    }));
  }, [expenses, result.net, result.investmentIncome, retirement.enabled, retirementDate]);
  // 现金流比率：逐月 DTI% / 支出率% / 储蓄率%；分期按当月真实月供
  const cashFlowForecast = useMemo(() => {
    const anchor = new Date().toISOString().slice(0, 10);
    const income = result.net + result.investmentIncome;
    const otherBase = nonInstallmentRecurring(expenses, result.net, result.investmentIncome);
    const oneTime = result.oneTimeTotal;
    return Array.from({ length: 360 }, (_, index) => {
      const date = new Date(); date.setMonth(date.getMonth() + index);
      const dateKey = date.toISOString().slice(0, 10);
      const debt = expenses
        .filter((expense) => expense.mode === 'installment')
        .reduce((sum, expense) => sum + installmentPaymentAsOf(expense, dateKey, anchor), 0);
      // ponytail: 第 0 月含一次性；之后仅持续非分期 + 当月分期
      const other = otherBase + (index === 0 ? oneTime : 0);
      const ratios = cashFlowRatios({ debt, otherExpenses: other, income });
      return {
        dateKey,
        label: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        dtiPct: roundPct(ratios.dtiPct),
        expensePct: roundPct(ratios.expensePct),
        savingsPct: roundPct(ratios.savingsPct),
      };
    });
  }, [expenses, result.net, result.investmentIncome, result.oneTimeTotal]);
  const monthlyAssetForecast = useMemo(() => {
    return buildMonthlyAssetForecast({
      cash,
      investment: invest,
      annualReturnRate: returnRate,
      disposableIncomeMonthly: result.net,
      recurringExpenseMonthly: result.recurringMonthlyExpenses,
      oneTimeExpense: result.oneTimeTotal,
      reinvest: reinvestSetting,
      months: 360,
      committedDownPayments: result.committedDownPayments,
      emergencyReserve: result.emergencyReserve,
    }).map((row) => ({
      ...row,
      label: row.month === 0 ? '现在' : `${Math.floor(row.month / 12)}年${row.month % 12}个月`,
    }));
  }, [cash, invest, returnRate, reinvestSetting, result.net, result.recurringMonthlyExpenses, result.oneTimeTotal, result.committedDownPayments, result.emergencyReserve]);
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
        name: '闲置资金', type: 'line', smooth: true, symbol: 'none', data: idle,
        lineStyle: { color: '#94a3b8', width: 2.5 },
        areaStyle: { color: 'rgba(148,163,184,0.12)' },
        z: 1,
      });
    }
    if (visibleAssetLines.investment) {
      series.push({
        name: '理财资产', type: 'line', smooth: true, symbol: 'none', data: investment,
        lineStyle: { color: '#f07f62', width: 3 },
        areaStyle: { color: 'rgba(240,127,98,0.10)' },
        z: 2,
      });
    }
    if (visibleAssetLines.total) {
      series.push({
        name: '最终资产', type: 'line', smooth: true, symbol: 'none', data: finalAssets,
        lineStyle: { color: '#17212b', width: 3.5 },
        z: 3,
      });
    }
    return {
      animation: false,
      grid: { left: isNarrow ? 40 : 64, right: isNarrow ? 12 : 28, top: 40, bottom: isNarrow ? 72 : 96 },
      tooltip: {
        trigger: 'axis',
        textStyle: { fontSize: 14 },
        valueFormatter: (value: number) => money(Number(value)),
      },
      xAxis: {
        type: 'category', boundaryGap: false, data: labels,
        axisLabel: { color: '#334155', fontSize: 14, fontWeight: 600, interval: 11, rotate: isNarrow ? 50 : 40, hideOverlap: true, margin: 14 },
        axisTick: { show: true, length: 8, lineStyle: { color: '#64748b', width: 2 } },
        axisLine: { lineStyle: { color: '#64748b', width: 2 } },
        name: '未来月份', nameLocation: 'middle', nameGap: isNarrow ? 36 : 56,
        nameTextStyle: { color: '#334155', fontSize: isNarrow ? 11 : 16, fontWeight: 600 },
      },
      yAxis: {
        type: 'value', min: yMin, max: yMax, splitNumber: 5,
        name: '万元', nameTextStyle: { color: '#334155', fontSize: isNarrow ? 11 : 16, fontWeight: 600 },
        axisLabel: { color: '#334155', fontSize: 14, fontWeight: 600, formatter: (value: number) => moneyWan(value) },
        axisTick: { show: true, length: 8, lineStyle: { color: '#64748b', width: 2 } },
        axisLine: { show: true, lineStyle: { color: '#64748b', width: 2 } },
        splitLine: { lineStyle: { color: '#cbd5e1', type: 'dashed', width: 1.5 } },
      },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', height: 18, bottom: 8, start: 0, end: 100 }],
      series,
    };
  }, [monthlyAssetForecast, visibleAssetLines, isNarrow]);
  const remainShareChartOption = useMemo(() => {
    const values = remainForecast.map((point) => point.value);
    const current = values[0] ?? 0;
    const yMin = Math.min(0, ...values, -50);
    const yMax = Math.max(100, ...values);
    return {
    animation: false,
    // 右侧留白给 markLine；375 下 10%≈32px 仍裁字，窄屏用 68px
    grid: { left: isNarrow ? 40 : 72, right: isNarrow ? 68 : '10%', top: 40, bottom: isNarrow ? 72 : 96 },
    tooltip: { trigger: 'axis', textStyle: { fontSize: isNarrow ? 11 : 16 }, valueFormatter: (value: number) => `${Number(value).toFixed(1)}%` },
    xAxis: { type: 'category', boundaryGap: false, data: remainForecast.map((point) => point.label), axisLabel: { color: '#334155', fontSize: isNarrow ? 11 : 16, fontWeight: 600, interval: 11, rotate: isNarrow ? 50 : 40, hideOverlap: true, margin: 14 }, axisTick: { show: true, length: 8, lineStyle: { color: '#64748b', width: 2 } }, axisLine: { lineStyle: { color: '#64748b', width: 2 } }, name: '未来月份', nameLocation: 'middle', nameGap: isNarrow ? 36 : 56, nameTextStyle: { color: '#334155', fontSize: isNarrow ? 12 : 18, fontWeight: 600 } },
    yAxis: { type: 'value', min: Math.floor(yMin / 10) * 10, max: Math.ceil(yMax / 10) * 10, interval: 20, name: '剩余可支配 %', nameTextStyle: { color: '#334155', fontSize: isNarrow ? 12 : 18, fontWeight: 600 }, axisLabel: { color: '#334155', fontSize: isNarrow ? 12 : 18, fontWeight: 600, formatter: '{value}%' }, axisTick: { show: true, length: 8, lineStyle: { color: '#64748b', width: 2 } }, axisLine: { show: true, lineStyle: { color: '#64748b', width: 2 } }, splitLine: { lineStyle: { color: '#cbd5e1', type: 'dashed', width: 1.5 } } },
    dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', height: 18, bottom: 8, start: 0, end: 100 }],
    series: [{
      name: '剩余可支配占比',
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: values,
      lineStyle: { color: '#f07f62', width: 3 },
      areaStyle: { color: 'rgba(240,127,98,0.12)' },
      markPoint: {
        symbol: 'pin',
        symbolSize: 52,
        data: [{ name: '当前', coord: [remainForecast[0]?.label, current], value: current }],
        label: { show: true, formatter: (p: { value?: number }) => `${Number(p.value ?? 0).toFixed(1)}%`, color: '#fff', fontSize: 12, fontWeight: 700 },
        itemStyle: { color: '#f07f62', borderColor: '#fff', borderWidth: 1 },
      },
      // 对应占比图支出 100/110/120/150 → 剩余 0/−10/−20/−50；另标满额 100%
      markLine: {
        silent: true,
        symbol: 'none',
        data: [
          { yAxis: 100, name: '满额 100%', lineStyle: { color: '#17212b', type: 'solid', width: 1.5 }, label: { formatter: '满额 100%', color: '#17212b', fontSize: isNarrow ? 10 : 12, fontWeight: 600 } },
          { yAxis: 0, name: '打满 0%', lineStyle: { color: '#64748b', type: 'dashed', width: 2 }, label: { formatter: '打满 0%', color: '#334155', fontSize: isNarrow ? 10 : 12, fontWeight: 600 } },
          { yAxis: -10, name: '警告 −10%', lineStyle: { color: '#f59e0b', type: 'dashed', width: 1 }, label: { formatter: '警告 −10%', color: '#b45309', fontSize: isNarrow ? 10 : 11 } },
          { yAxis: -20, name: '警告 −20%', lineStyle: { color: '#f97316', type: 'dashed', width: 1 }, label: { formatter: '警告 −20%', color: '#c2410c', fontSize: isNarrow ? 10 : 11 } },
          { yAxis: -50, name: '警告 −50%', lineStyle: { color: '#dc2626', type: 'dashed', width: 1 }, label: { formatter: '警告 −50%', color: '#b91c1c', fontSize: isNarrow ? 10 : 11 } },
        ],
      },
    }],
  };
  }, [remainForecast, isNarrow]);
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
    const yMin = visibleValues.length ? Math.min(0, ...visibleValues) : 0;
    const yMax = visibleValues.length ? Math.max(100, ...visibleValues) : 100;
    const series: Array<{
      name: string;
      type: string;
      smooth: boolean;
      symbol: string;
      data: number[];
      lineStyle: { color: string; width: number };
      markLine?: { silent: boolean; data: Array<{ yAxis: number; name: string }>; lineStyle: { color: string; type: string; width: number }; label: { color: string; fontSize: number } };
    }> = [];
    if (visibleCashFlowLines.dti) {
      series.push({
        name: '偿债比 DTI', type: 'line', smooth: true, symbol: 'none', data: dti,
        lineStyle: { color: '#f07f62', width: 3 },
        markLine: { silent: true, data: [{ yAxis: 35, name: '建议≤35%' }], lineStyle: { color: '#f07f62', type: 'dashed', width: 1.5 }, label: { color: '#d9654a', fontSize: isNarrow ? 10 : 12 } },
      });
    }
    if (visibleCashFlowLines.expense) {
      series.push({
        name: '支出率', type: 'line', smooth: true, symbol: 'none', data: expense,
        lineStyle: { color: '#64748b', width: 2.5 },
      });
    }
    if (visibleCashFlowLines.savings) {
      series.push({
        name: '储蓄率', type: 'line', smooth: true, symbol: 'none', data: savings,
        lineStyle: { color: '#3d8f6e', width: 3 },
        markLine: { silent: true, data: [{ yAxis: 20, name: '建议≥20%' }], lineStyle: { color: '#3d8f6e', type: 'dashed', width: 1.5 }, label: { color: '#2f6f56', fontSize: isNarrow ? 10 : 12 } },
      });
    }
    return {
      animation: false,
      // 右侧留白给 markLine；窄屏 68px 避免「建议≤35%」裁切
      grid: { left: isNarrow ? 40 : 72, right: isNarrow ? 68 : '10%', top: 40, bottom: isNarrow ? 72 : 96 },
      tooltip: {
        trigger: 'axis',
        textStyle: { fontSize: 14 },
        valueFormatter: (value: number) => `${Number(value).toFixed(1)}%`,
      },
      xAxis: {
        type: 'category', boundaryGap: false, data: labels,
        axisLabel: { color: '#334155', fontSize: 14, fontWeight: 600, interval: 11, rotate: isNarrow ? 50 : 40, hideOverlap: true, margin: 14 },
        axisTick: { show: true, length: 8, lineStyle: { color: '#64748b', width: 2 } },
        axisLine: { lineStyle: { color: '#64748b', width: 2 } },
        name: '未来月份', nameLocation: 'middle', nameGap: isNarrow ? 36 : 56,
        nameTextStyle: { color: '#334155', fontSize: isNarrow ? 11 : 16, fontWeight: 600 },
      },
      yAxis: {
        type: 'value', min: Math.floor(yMin / 10) * 10, max: Math.ceil(yMax / 10) * 10, interval: 20,
        name: '占比 %', nameTextStyle: { color: '#334155', fontSize: isNarrow ? 11 : 16, fontWeight: 600 },
        axisLabel: { color: '#334155', fontSize: 14, fontWeight: 600, formatter: '{value}%' },
        axisTick: { show: true, length: 8, lineStyle: { color: '#64748b', width: 2 } },
        axisLine: { show: true, lineStyle: { color: '#64748b', width: 2 } },
        splitLine: { lineStyle: { color: '#cbd5e1', type: 'dashed', width: 1.5 } },
      },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', height: 18, bottom: 8, start: 0, end: 100 }],
      series,
    };
  }, [cashFlowForecast, visibleCashFlowLines, isNarrow]);

  const saveStatusText = !authUser
    ? (savedAt ? `已保存到本机 ${savedAt}` : '访客数据仅保存在本机')
    : profileSyncStatus.phase === 'syncing'
      ? '正在同步到云端…'
      : profileSyncStatus.phase === 'synced'
        ? `已同步到云端${profileSyncStatus.at ? ` ${profileSyncStatus.at}` : ''}`
        : profileSyncStatus.phase === 'conflict'
          ? '云端数据有更新，本机草稿未丢失；继续将覆盖云端版本'
          : profileSyncStatus.phase === 'failed'
            ? '已保存到本机，云端同步失败'
            : '改参后自动同步到云端';
  const syncAlert = authUser ? profileSyncAlert(profileSyncStatus.phase) : null;
  const canResolveProfileSync = Boolean(authUser)
    && (profileSyncStatus.phase === 'failed' || profileSyncStatus.phase === 'conflict');
  const retryProfileSync = () => {
    if (!authUser) return;
    const state = { profile, snapshots: [], scenarios: [] };
    if (profileSyncStatus.phase === 'conflict') {
      void profileSyncRef.current?.resolveConflictWithLocal(state);
      return;
    }
    void profileSyncRef.current?.enqueue(state);
  };
  // 首屏决策摘要：与 result 同源（月支出=聚合口径）
  const decisionSummary = buildDecisionSummary({
    monthlySpendable: result.net,
    monthlyExpense: result.monthlyExpenses,
    monthlySurplus: result.surplus,
    totalAssets,
  });

  // 会话未就绪：简短占位，避免闪一下主界面
  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8f5] text-[#17212b]">
        <p className="text-sm text-slate-400">加载中…</p>
      </main>
    );
  }
  // 访客与登录均可进主应用；未登录用示例/本机草稿
  return <main className="min-h-screen bg-[#f6f8f5] text-[#17212b] pb-[env(safe-area-inset-bottom,0px)]">
    <div className="mobile-sticky-top" ref={stickyTopRef}>
    <header className="app-header page-pad mx-auto flex max-w-[1920px] items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#17212b] text-sm font-bold text-white">M</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">财务管理</p>
          <p className="hidden truncate text-[11px] leading-tight text-slate-400 sm:block">访客可体验 · 注册认领数据</p>
        </div>
      </div>
      <div className="relative flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
        <span className="sr-only" aria-live="polite">{saveStatusText}</span>
        <button
          type="button"
          className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#17212b] px-2.5 py-1.5 text-left text-white sm:gap-2 sm:px-3"
          title="剩余可支配占比 = 100% − 本月支出占可支配收入比例（与走势图同口径）"
          aria-label={`剩余可支配 ${result.remainDisposablePct}%`}
        >
          <span className="max-w-[4.5rem] text-[10px] leading-tight text-slate-300 sm:max-w-none sm:text-[11px]">剩余可支配</span>
          <strong className="text-base tabular-nums leading-none sm:text-lg">{result.remainDisposablePct}<span className="text-[11px] font-normal text-slate-400">%</span></strong>
        </button>
        {!authUser && (
          <AuthBar
            user={null}
            registerOnly={isNarrow}
            onBeforeNavigate={save}
            onLogout={handleLogout}
          />
        )}
        <div className="relative">
          {/* 用户名/访客 + 箭头 = 原「更多」同一入口，整块可点 */}
          <button
            ref={headerMoreBtnRef}
            type="button"
            aria-expanded={headerMoreOpen}
            aria-haspopup="menu"
            aria-label={headerMoreOpen ? '收起菜单' : (authUser ? `${authUser.username}，打开菜单` : '访客，打开菜单')}
            title={authUser ? authUser.username : '示例数据仅本机临时，注册后可认领到账号'}
            onClick={() => setHeaderMoreOpen((v) => !v)}
            className="touch-btn flex min-h-9 max-w-[9rem] items-center gap-1 rounded-full border border-slate-200 bg-white py-1 pl-2.5 pr-1.5 text-[#17212b] hover:border-[#f07f62] hover:text-[#d9654a] sm:max-w-[12rem]"
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
          {headerMoreOpen && createPortal(
            <>
              <button type="button" className="fixed inset-0 cursor-default" style={{ zIndex: Z_INDEX.mask }} aria-label="关闭菜单" onClick={() => setHeaderMoreOpen(false)} />
              <div
                ref={headerMoreMenuRef}
                className="header-more-menu fixed w-52 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-lg"
                role="menu"
                style={{ top: headerMorePos.top, left: headerMorePos.left, zIndex: Z_INDEX.topbarMenu }}
              >
                <p className={`px-2.5 py-1.5 text-[10px] ${canResolveProfileSync ? 'text-amber-700' : 'text-slate-400'}`}>
                  {saveStatusText}
                </p>
                {canResolveProfileSync && (
                  <button
                    type="button"
                    role="menuitem"
                    className="header-more-item font-semibold text-amber-700"
                    onClick={retryProfileSync}
                  >
                    {profileSyncStatus.phase === 'conflict' ? '以本机数据覆盖云端' : '重试同步'}
                  </button>
                )}
                <div className="header-more-item-wrap"><InstallToDesktop /></div>
                {/* 纯客户端：清 SW/Cache 后刷新，不碰草稿与登录 */}
                <button
                  type="button"
                  role="menuitem"
                  className="header-more-item"
                  onClick={() => { setHeaderMoreOpen(false); void restartSite(); }}
                >
                  重启网站
                </button>
                {!authUser && isNarrow && (
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
                )}
                {authUser && (
                  <button
                    type="button"
                    role="menuitem"
                    className="header-more-item text-red-600"
                    onClick={() => { setHeaderMoreOpen(false); void logoutSession().then(handleLogout); }}
                  >
                    登出
                  </button>
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
        <p className="guest-demo-banner">访客 / 示例数据，仅本机临时 · 点数字改成你的 · 注册后可认领</p>
      </div>
    )}
    {syncAlert && (
      <div
        className={`sync-alert-banner page-pad mx-auto flex max-w-[1920px] flex-wrap items-center gap-2 px-3 py-1.5 sm:px-6 lg:px-10 ${syncAlert.tone === 'conflict' ? 'is-conflict' : 'is-failed'}`}
        role="alert"
      >
        <p className="min-w-0 flex-1 text-[11px] font-medium leading-snug sm:text-xs">{syncAlert.message}</p>
        <button
          type="button"
          className="touch-btn shrink-0 rounded-full bg-[#17212b] px-3 py-1.5 text-[11px] font-semibold text-white"
          onClick={retryProfileSync}
        >
          {syncAlert.actionLabel}
        </button>
      </div>
    )}
    <nav className="mobile-section-nav page-pad mx-auto flex max-w-[1920px] gap-2 px-3 pb-1 pt-2 sm:max-w-md sm:justify-start lg:max-w-[1920px]" aria-label="页面分区">
      <button type="button" className={`mobile-nav-chip${activeSection === 'sec-params' ? ' is-active' : ''}`} aria-current={activeSection === 'sec-params' ? 'true' : undefined} onClick={() => scrollToSection('sec-params')}>参数</button>
      <button type="button" className={`mobile-nav-chip${activeSection === 'sec-expenses' ? ' is-active' : ''}`} aria-current={activeSection === 'sec-expenses' ? 'true' : undefined} onClick={() => scrollToSection('sec-expenses')}>支出</button>
      <button type="button" className={`mobile-nav-chip${activeSection === 'sec-charts' ? ' is-active' : ''}`} aria-current={activeSection === 'sec-charts' ? 'true' : undefined} onClick={() => scrollToSection('sec-charts')}>走势</button>
    </nav>
    </div>
    <section className="page-pad mx-auto grid max-w-[1920px] grid-cols-1 gap-2 px-3 pb-12 pt-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_720px] lg:px-10">
      <div className="min-w-0 space-y-2">
        <section className="decision-summary section-card rounded-3xl bg-white p-3 shadow-lg sm:p-4" aria-label="本月决策摘要">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="min-w-0 rounded-2xl bg-[#f8faf9] px-2.5 py-2">
              <p className="text-[10px] font-semibold text-slate-400 sm:text-[11px]">月可花</p>
              <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-[#17212b] sm:text-base">{money(decisionSummary.monthlySpendable)}</p>
            </div>
            <div className="min-w-0 rounded-2xl bg-[#f8faf9] px-2.5 py-2">
              <p className="text-[10px] font-semibold text-slate-400 sm:text-[11px]">月支出</p>
              <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-[#17212b] sm:text-base">{money(decisionSummary.monthlyExpense)}</p>
            </div>
            <div className="min-w-0 rounded-2xl bg-[#f8faf9] px-2.5 py-2">
              <p className="text-[10px] font-semibold text-slate-400 sm:text-[11px]">月结余</p>
              <p className={`mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base ${decisionSummary.monthlySurplus < 0 ? 'text-red-600' : 'text-[#17212b]'}`}>{money(decisionSummary.monthlySurplus)}</p>
            </div>
            <div className="min-w-0 rounded-2xl bg-[#f8faf9] px-2.5 py-2">
              <p className="text-[10px] font-semibold text-slate-400 sm:text-[11px]">总资产</p>
              <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-[#17212b] sm:text-base">{money(decisionSummary.totalAssets)}</p>
            </div>
          </div>
          {decisionSummary.riskLine && (
            <p className="mt-2 text-[11px] font-medium leading-snug text-amber-800 sm:text-xs" role="status">{decisionSummary.riskLine}</p>
          )}
        </section>
        <section id="sec-params" className="section-card scroll-mt-24 rounded-3xl bg-white p-4 shadow-lg sm:p-6">
          <div><SectionTitle title="财务参数" tip={"收入与资产配置。\n退休规划已整合到「五险一金和个税 → 退休与社保」；点字段改数即生效并自动保存。"} /></div>
          <div className="section-label flex flex-wrap items-center gap-2">
            收入信息
            <select aria-label="收入录入方式" className="field-input !mt-0 !w-auto max-w-full py-1 text-xs font-medium text-slate-700" value={incomeViewMode} onChange={(event) => setIncomeViewModeSafe(event.target.value as IncomeViewMode)}>
              <option value="detail">关心五险一金</option>
              <option value="takehome">只看到手</option>
            </select>
          </div>
          {incomeViewMode === 'takehome' ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Editable label="到手收入" tip={"银行卡到账 / 月可支配收入，用于结余与资产预测。\n退休规划可切到「关心五险一金」后设置。"} value={takeHomeIncome ?? result.net} min={0} step={1} onChange={(value) => { setTakeHomeIncome(value); }} />
              {retirement.enabled && (
                <button
                  type="button"
                  className="field-row-mobile flex items-center justify-between gap-3 text-left text-sm text-slate-600"
                  onClick={() => setIncomeViewModeSafe('detail')}
                >
                  <span>
                    <span className="block font-medium text-slate-700">退休规划已关联</span>
                    <span className="mt-0.5 block text-xs text-slate-400">预计退休 {retirementDate || '待完善'}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-[#d9654a]">前往管理</span>
                </button>
              )}
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Editable label="税前工资" value={salary} min={0} step={1} onChange={setSalary} />
              <SocialTaxBreakdown
                salary={salary}
                rows={result.socialRows}
                total={result.social}
                tax={result.tax}
                net={result.net}
                deductions={result.deductions}
                socialEnabled={socialEnabled}
                onSocialEnabledChange={(value) => { setSocialEnabled(value); window.dispatchEvent(new Event('money-manage-save')); }}
                insuranceBase={effectiveInsuranceBase}
                housingFundBase={effectiveHousingFundBase}
                insuranceFollowSalary={contributionBase == null}
                housingFollowSalary={housingFundBase == null}
                onInsuranceFollowSalary={() => { setContributionBase(null); window.dispatchEvent(new Event('money-manage-save')); }}
                onHousingFollowSalary={() => { setHousingFundBase(null); window.dispatchEvent(new Event('money-manage-save')); }}
                onInsuranceBaseChange={(value) => { setContributionBase(value); window.dispatchEvent(new Event('money-manage-save')); }}
                onHousingFundBaseChange={(value) => { setHousingFundBase(value); window.dispatchEvent(new Event('money-manage-save')); }}
                onHousingPersonalChange={(value) => { setSocialRates((current) => ({ ...current, 住房公积金: { ...current['住房公积金'], personal: clamp(value, 5, 12) } })); window.dispatchEvent(new Event('money-manage-save')); }}
                onRentChange={setRentEnabled}
                onElderlyChange={setElderlyEnabled}
                retirement={retirement}
                retirementDate={retirementDate}
                onRetirementChange={updateRetirement}
              />
              <Metric label="到手收入" value={money(result.net)} detail={"税前工资 − 五险一金 − 本月个税。\n退休规划在「五险一金和个税 → 退休与社保」二级弹层设置，不改变到账口径。"} />
            </div>
          )}
          <div className="section-label">资产配置</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AssetLinkedEditor totalAssets={totalAssets} cash={cash} invest={invest} investRatio={investRatio} onTotal={updateTotalAssets} onCash={updateCash} onCashByMonths={updateCashByMonths} onAnnualSpend={updateAnnualSpend} onInvestAmount={updateInvestByAmount} onInvestRatio={updateInvestByRatio} emergency={emergencySetting} planMonthly={planMonthly} adjustedAvailableAssets={result.adjustedAvailableAssets} monthlyExpenses={result.monthlyExpenses} onMonthsPlanChecked={setMonthsPlanChecked} />
            <Editable label="年化收益率" value={returnRate} min={0} max={100} step={0.1} suffix="%" kind="rangedPercent" onChange={setReturnRate} />
            <ReinvestEditor setting={reinvestSetting} monthlySurplus={Math.max(0, result.surplus)} onChange={(next) => { setReinvestMode(next.mode); setReinvestRate(next.rate); setReinvestAmount(next.amount); }} />
          </div>
        </section>
      <section id="sec-expenses" className="section-card scroll-mt-24 rounded-3xl bg-white p-4 shadow-lg sm:p-6"><div><SectionTitle title="支出管理" tip={"表格上只改名称、分类；类型和金额点「编辑」。\n点「分析」打开对比面板，勾选任意支出看叠在一起的影响。"} /></div><div className="table-wrap mt-5 hidden md:block"><table><thead><tr><th>名称</th><th>分类</th><th>类型</th><th>金额 / 月付</th><th className="cell-wrap">分期信息</th><th>操作</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id} data-expense-anchor={expense.id}><td><TextEditable value={expense.name} emptyLabel="未命名" allowEmpty ariaLabel="名称" onChange={(name) => { updateExpense(expense.id, { name }); saveEvent(); }} /></td><td><TextEditable value={expense.category} emptyLabel="未分类" allowEmpty ariaLabel="分类" onChange={(category) => { updateExpense(expense.id, { category }); saveEvent(); }} /></td><td><span className="text-sm text-slate-600">{formatExpenseMode(expense.mode)}</span></td><td><span className="font-mono text-sm tabular-nums text-slate-700">{formatExpensePayment(expense)}</span></td><td className="cell-wrap"><span className="text-sm text-slate-500">{expense.mode === 'installment' ? formatExpenseInstallment(expense) : '—'}</span></td><td className="whitespace-nowrap"><div className="flex items-center gap-2"><ExpenseEditButton expense={expense} onChange={(patch) => { updateExpense(expense.id, patch); saveEvent(); }} retirementDate={retirement.enabled ? retirementDate : undefined} /><ExpenseAnalyzeButton expense={expense} financeInput={financeInput} reinvest={reinvestSetting} retirementDate={retirement.enabled ? retirementDate : undefined} /><button type="button" onClick={(event) => requestRemoveExpense(expense, event.currentTarget)} className="text-xs text-red-500 hover:underline">删除</button></div></td></tr>)}</tbody></table></div>
<div className="mt-4 space-y-3 md:hidden">{expenses.map((expense) => (
          <div key={expense.id} data-expense-anchor={expense.id} className="expense-card space-y-2">
            <div className="expense-card-head">
              <div className="expense-card-title min-w-0 flex-1">
                <TextEditable value={expense.name} emptyLabel="未命名" allowEmpty ariaLabel="名称" onChange={(name) => { updateExpense(expense.id, { name }); saveEvent(); }} />
              </div>
              <div className="expense-card-amount min-w-0 shrink">
                <div className="text-right">
                  <p className="text-[11px] text-slate-400">金额 / 月付</p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-slate-700">{formatExpensePayment(expense)}</p>
                </div>
              </div>
            </div>
            <div className="expense-card-meta">
              <span className="expense-meta-chip text-xs text-slate-600">{formatExpenseMode(expense.mode)}</span>
              <TextEditable value={expense.category} emptyLabel="未分类" allowEmpty ariaLabel="分类" className="expense-meta-chip" onChange={(category) => { updateExpense(expense.id, { category }); saveEvent(); }} />
            </div>
            {expense.mode === 'installment' && (
              <div className="field-row-mobile">
                <span>分期信息</span>
                <span className="text-sm text-slate-500">{formatExpenseInstallment(expense)}</span>
              </div>
            )}
            <div className="expense-card-actions">
              <div className="flex flex-1 gap-2">
                <ExpenseEditButton expense={expense} onChange={(patch) => { updateExpense(expense.id, patch); saveEvent(); }} retirementDate={retirement.enabled ? retirementDate : undefined} />
                <div className="flex-1"><ExpenseAnalyzeButton expense={expense} financeInput={financeInput} reinvest={reinvestSetting} retirementDate={retirement.enabled ? retirementDate : undefined} /></div>
              </div>
              <button type="button" onClick={(event) => requestRemoveExpense(expense, event.currentTarget)} className="touch-btn rounded-xl border border-red-100 px-3 text-xs font-semibold text-red-500">删除</button>
            </div>
          </div>
        ))}</div>
        <div className="mt-4"><ExpenseAddButton onConfirm={confirmAddExpense} retirementDate={retirement.enabled ? retirementDate : undefined} /></div>
      </section></div>
      <div id="sec-charts" className="min-w-0 w-full scroll-mt-24 lg:sticky lg:top-4 lg:self-start"><section className="section-card mb-2 rounded-3xl bg-white p-4 shadow-lg sm:p-6"><div className="relative flex flex-wrap items-start justify-between gap-4"><SectionTitle title="资产走势" tip={"最终资产 = 理财 + 闲置资金。\n闲置 = 现金 + 结余中未投入闲钱投资的部分。\n理财含复利与闲钱投入；自当前起点按月预测。"} /><button ref={assetDetailBtnRef} type="button" onClick={() => setShowAssetDetails((current) => !current)} className="text-sm font-semibold text-[#d9654a]">查看明细</button>{showAssetDetails && <FloatPanel open={showAssetDetails} anchorRef={assetDetailBtnRef} onClose={() => setShowAssetDetails(false)} width={620} headerTitle="月度资产明细"><div className="table-wrap table-scroll"><table><thead><tr><th>月份</th><th>闲置资金</th><th>理财资产</th><th>最终资产</th><th><span className="inline-flex items-center gap-1">调整后可用资产<InfoTip>{ADJUSTED_AVAILABLE_ASSETS_TIP}</InfoTip></span></th></tr></thead><tbody>{monthlyAssetForecast.map((row) => <tr key={row.month}><td>{row.label}</td><td>{money(row.cash)}</td><td>{money(row.investment)}</td><td>{money(row.total)}</td><td>{money(row.available)}</td></tr>)}</tbody></table></div></FloatPanel>}</div><ChartHost className="mt-5" option={assetChartOption} /><div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500"><button type="button" onClick={() => setVisibleAssetLines((current) => ({ ...current, cash: !current.cash }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleAssetLines.cash ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}><i className="h-2 w-2 rounded-full bg-slate-400" />闲置资金</button><button type="button" onClick={() => setVisibleAssetLines((current) => ({ ...current, investment: !current.investment }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleAssetLines.investment ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}><i className="h-2 w-2 rounded-full bg-[#f07f62]" />理财资产</button><button type="button" onClick={() => setVisibleAssetLines((current) => ({ ...current, total: !current.total }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleAssetLines.total ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}><i className="h-2 w-2 rounded-full bg-[#17212b]" />最终资产</button></div></section><section className="section-card rounded-3xl bg-white p-4 shadow-lg sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><SectionTitle title="剩余可支配收入走势" tip={"自今日起模拟 30 年。\n剩余占比 = 100% − 当月总支出/可支配收入（分期按真实月供，可为负）。"} /><span className="hidden text-sm text-slate-500 sm:inline">当前方案 · 360 个月</span></div><ChartHost className="mx-auto mt-4 sm:mt-8" option={remainShareChartOption} /><div className="chart-year-labels mt-3 flex justify-between font-semibold text-slate-600 sm:mt-4 sm:text-base"><span>{forecastYearLabel(0)}</span><span>{forecastYearLabel(5)}</span><span>{forecastYearLabel(15)}</span><span>{forecastYearLabel(30)}</span></div></section>
        <section className="section-card mt-2 rounded-3xl bg-white p-4 shadow-lg sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><SectionTitle title="逐月现金流比率" tip={"三条线：房贷/分期占收入、总支出占收入、结余占收入。分期按当月真实月供算。"} /><span className="hidden text-sm text-slate-500 sm:inline">DTI · 支出 · 储蓄</span></div><ChartHost className="mt-4 sm:mt-8" option={cashFlowChartOption} /><div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500"><button type="button" onClick={() => setVisibleCashFlowLines((current) => ({ ...current, dti: !current.dti }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleCashFlowLines.dti ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}><i className="h-2 w-2 rounded-full bg-[#f07f62]" />偿债比 DTI</button><button type="button" onClick={() => setVisibleCashFlowLines((current) => ({ ...current, expense: !current.expense }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleCashFlowLines.expense ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}><i className="h-2 w-2 rounded-full bg-slate-400" />支出率</button><button type="button" onClick={() => setVisibleCashFlowLines((current) => ({ ...current, savings: !current.savings }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleCashFlowLines.savings ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}><i className="h-2 w-2 rounded-full bg-[#3d8f6e]" />储蓄率</button></div><div className="chart-year-labels mt-3 flex justify-between font-semibold text-slate-600 sm:mt-4 sm:text-base"><span>{forecastYearLabel(0)}</span><span>{forecastYearLabel(5)}</span><span>{forecastYearLabel(15)}</span><span>{forecastYearLabel(30)}</span></div></section></div>    </section><footer className="page-pad mx-auto max-w-[1920px] px-3 pb-8 text-xs text-slate-400 sm:px-6 lg:px-10">原型版 · 个税和五险一金为月度估算，结果仅用于个人财务规划参考</footer>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        anchorRef={deleteAnchorRef}
        title={pendingDelete?.title ?? '确认删除'}
        message={pendingDelete?.message ?? ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          removeExpense(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </main>;
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
    // 等 FloatPanel portal / sheet 落位后再 focus，并选中默认「新支出」便于直接改名
    const timer = window.setTimeout(() => {
      const el = nameRef.current;
      if (!el) return;
      el.focus();
      el.select();
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-500">名称<input ref={nameRef} autoFocus={autoFocusName} className="field-input mt-1" value={value.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
        <label className="block text-xs text-slate-500">分类<input className="field-input mt-1" value={value.category} onChange={(event) => onChange({ category: event.target.value })} /></label>
      </div>
      <div>
        <p className="text-xs text-slate-500">类型</p>
        {/* 移动：大触控分段；桌面：下拉 */}
        <div className="mt-1 grid grid-cols-2 gap-2 sm:hidden">
          {modes.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange({ mode: item.value })}
              className={`touch-btn rounded-xl border px-2 text-xs font-semibold ${value.mode === item.value ? 'border-[#17212b] bg-[#17212b] text-white' : 'border-slate-200 bg-white text-slate-600'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <select className="field-input mt-1 hidden sm:block" value={value.mode} onChange={(event) => onChange({ mode: event.target.value as Expense['mode'] })}>
          {modes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>
      <div className="settings-summary rounded-xl border border-[#f07f62]/20 bg-[#fff7f4] px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs text-slate-500">当前月付</p>
          <p className="font-mono text-base font-semibold tabular-nums text-[#c4533a]">{formatExpensePayment(value)}</p>
        </div>
      </div>
      {(value.mode === 'fixed' || value.mode === 'one_time') && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-500">{value.mode === 'one_time' ? '发生时间（默认当月）' : '开始时间'}<input className="field-input mt-1" type="date" value={(value.startDate || (value.mode === 'one_time' ? defaultOneTimeDate() : todayDateKey())).slice(0, 10)} onChange={(event) => onChange({ startDate: event.target.value || (value.mode === 'one_time' ? defaultOneTimeDate() : todayDateKey()), endDate: value.mode === 'one_time' ? (event.target.value || defaultOneTimeDate()) : value.endDate })} /></label>
          <label className="block text-xs text-slate-500">{value.mode === 'one_time' ? '金额' : '每月金额'}<SoftNumberInput min={0} step={100} value={value.amount} onCommit={(n) => onChange({ amount: n })} /></label>
        </div>
      )}
      {value.mode === 'percentage' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-500">开始时间<input className="field-input mt-1" type="date" value={(value.startDate || todayDateKey()).slice(0, 10)} onChange={(event) => onChange({ startDate: event.target.value })} /></label>
          <label className="block text-xs text-slate-500">收入比例<SoftNumberInput min={0} max={100} step={1} suffix="%" value={value.rate || 0} onCommit={(n) => onChange({ rate: n })} /></label>
        </div>
      )}
      {value.mode === 'installment' && (
        <InstallmentSettingsPanel expense={value} onChange={onChange} retirementDate={retirementDate} />
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
    setDraft(null);
  };
  const patchDraft = (patch: Partial<Expense>) => setDraft((current) => {
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
      next.term = clampInstallmentTerm(start, next.term || 1, Boolean(next.followRetirement), retirementDate);
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
        className="touch-btn shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#17212b] hover:border-[#f07f62] hover:text-[#d9654a] sm:border-0 sm:bg-transparent sm:px-1 sm:text-[#d9654a] sm:hover:underline"
        title="打开支出设置面板"
      >
        编辑
      </button>
      {open && draft && (
        <FloatPanel
          open={open}
          anchorRef={anchorRef}
          onClose={closePanel}
          width={420}
          maxHeightVh={85}
          center
          headerTitle="编辑支出"
          mode="auto"
          density="panel"
          footer={(
            <div className="flex gap-2">
              <button type="button" onClick={closePanel} className="touch-btn flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">取消</button>
              <button type="button" onClick={save} className="touch-btn flex-1 rounded-xl bg-[#17212b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2a3644]">保存</button>
            </div>
          )}
        >
          <p className="text-xs text-slate-400">类型、金额、分期等在此修改；点「保存」写回列表。名称/分类也可在表格直接改。</p>
          <div className="mt-3">
            <ExpenseSettingsFields value={draft} onChange={patchDraft} retirementDate={retirementDate} />
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
      category: '其他',
      mode: 'fixed',
      amount: 0,
      startDate: todayDateKey(),
    });
    setOpen(true);
  };
  const closePanel = () => {
    setOpen(false);
    setDraft(null);
  };
  const patchDraft = (patch: Partial<Expense>) => setDraft((current) => {
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
      next.term = clampInstallmentTerm(start, next.term || 36, Boolean(next.followRetirement), retirementDate);
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
      category: (draft.category || '').trim() || '其他',
    });
    closePanel();
  };
  return (
    <div className="relative inline-block w-full sm:w-auto">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        className="touch-btn w-full rounded-xl bg-[#f07f62] px-4 text-sm font-semibold text-white hover:bg-[#df6e51] sm:w-auto"
      >
        + 新增支出
      </button>
      {open && draft && (
        <FloatPanel
          open={open}
          anchorRef={anchorRef}
          onClose={closePanel}
          width={420}
          maxHeightVh={85}
          center
          headerTitle="新增支出"
          mode="auto"
          density="panel"
          footer={(
            <div className="flex gap-2">
              <button type="button" onClick={closePanel} className="touch-btn flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">取消</button>
              <button type="button" onClick={confirm} className="touch-btn flex-1 rounded-xl bg-[#f07f62] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#df6e51]">确认添加</button>
            </div>
          )}
        >
          <p className="text-xs text-slate-400">填写后点「确认添加」才会写入列表；关闭或取消不保存。</p>
          <div className="mt-3">
            <ExpenseSettingsFields value={draft} onChange={patchDraft} retirementDate={retirementDate} autoFocusName />
          </div>
        </FloatPanel>
      )}
    </div>
  );
}

function ExpenseAnalyzeButton({ expense, financeInput, reinvest, retirementDate }: { expense: Expense; financeInput: FinanceInput; reinvest: ReinvestSetting; retirementDate?: string }) {
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
  const allExpenseIds = useMemo(() => financeInput.expenses.map((item) => item.id), [financeInput.expenses]);

  // 始终 isolated：消费前=无支出，测算=仅勾选集合
  const before = useMemo(() => computeFinanceResult({ ...financeInput, expenses: [] }), [financeInput]);
  const after = useMemo(() => computeFinanceResult({ ...financeInput, expenses: selectedExpenses }), [financeInput, selectedExpenses]);

  // KPI「30 年资产差额」仍用消费前/测算两端资产
  const assetBefore = useMemo(() => forecastYearlyTotals(financeInput.cash, financeInput.invest, financeInput.returnRate, reinvest, before.net, before.recurringMonthlyExpenses, before.oneTimeTotal, before.committedDownPayments), [financeInput, reinvest, before]);
  const assetAfter = useMemo(() => forecastYearlyTotals(financeInput.cash, financeInput.invest, financeInput.returnRate, reinvest, after.net, after.recurringMonthlyExpenses, after.oneTimeTotal, after.committedDownPayments), [financeInput, reinvest, after]);
  // ponytail: 分析图拆层仍吃 %；金额模式用「典型月结余」换算等效比例
  const chartInvestRate = useMemo(() => {
    const typicalSurplus = Math.max(0, before.net + before.investmentIncome - before.recurringMonthlyExpenses);
    return effectiveInvestRate(typicalSurplus, reinvest);
  }, [before.net, before.investmentIncome, before.recurringMonthlyExpenses, reinvest]);
  const expenseShareOption = useMemo(() => {
    // 前缀绝对占比 → 支出堆叠；勾选投资时把剩余可支配拆成 投资 + 可花费剩余
    const items = selectedExpenses.map((item) => ({ id: item.id, name: item.name || '未命名' }));
    const cumulatives: number[][] = [];
    let labels: string[] = [];
    for (let prefix = 0; prefix <= selectedExpenses.length; prefix += 1) {
      const list = buildPrefixExpenses(financeInput.expenses, selectedExpenses, prefix, 'isolated');
      const computed = computeFinanceResult({ ...financeInput, expenses: list });
      const rows = forecastExpenseShareByMonth(
        list,
        computed.net,
        computed.investmentIncome,
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
      ? remainInvestSpendableSeries(topExpense, chartInvestRate, { disposableIncome: before.net })
      : savingsFillTo100Series(topExpense, { name: savingsName });
    const series = [
      ...impactTemporalStackedSeries(layers, windows),
      ...remainSeries,
    ];
    const seriesValues = series.flatMap((row) =>
      (Array.isArray(row.data) ? row.data : []).filter((value): value is number => value !== null && Number.isFinite(Number(value))).map(Number),
    );
    // ponytail: y 至少盖到重度警告线 150%；数据更高时仍跟 series
    const yMax = Math.max(150, seriesValues.length ? Math.max(100, ...seriesValues) : 100);
    const yMin = seriesValues.length ? Math.min(0, ...seriesValues) : 0;
    const legendNames = [
      ...layers.map((layer) => layer.name),
      ...(includeInvestShare ? [INVEST_SHARE_NAME, SPENDABLE_REMAIN_NAME] : [savingsName]),
    ];
    // 可支配 100% + 超支警告线；挂最后一条 series，避免挡堆叠/投资层逻辑
    const shareWarnMarkLine = {
      silent: true,
      symbol: 'none' as const,
      label: { position: 'insideEndTop' as const, fontSize: 10, distance: 2 },
      data: [
        { yAxis: 100, name: '可支配 100%', lineStyle: { type: 'solid' as const, color: '#17212b', width: 1.5 }, label: { formatter: '可支配 100%', color: '#17212b' } },
        { yAxis: 110, name: '警告 110%', lineStyle: { type: 'dashed' as const, color: '#f59e0b', width: 1 }, label: { formatter: '警告 110%', color: '#b45309' } },
        { yAxis: 120, name: '警告 120%', lineStyle: { type: 'dashed' as const, color: '#f97316', width: 1 }, label: { formatter: '警告 120%', color: '#c2410c' } },
        { yAxis: 150, name: '警告 150%', lineStyle: { type: 'dashed' as const, color: '#dc2626', width: 1 }, label: { formatter: '警告 150%', color: '#b91c1c' } },
      ],
    };
    const seriesWithMark = series.length
      ? [...series.slice(0, -1), { ...series[series.length - 1], markLine: shareWarnMarkLine }]
      : series;
    return {
      animation: false,
      color: [
        ...layers.map((layer) => layer.color),
        ...(includeInvestShare ? [INVEST_SHARE_COLOR, SAVINGS_COLOR] : [SAVINGS_COLOR]),
      ],
      // 自下而上：dataZoom → legend → 旋转日期；grid.bottom 留足三者间距，避免挡绘图区
      legend: { type: 'scroll', bottom: 36, data: legendNames, textStyle: { fontSize: 11 } },
      grid: { left: (typeof window !== 'undefined' && window.innerWidth < 640) ? 40 : 48, right: (typeof window !== 'undefined' && window.innerWidth < 640) ? 8 : 16, top: 28, bottom: (typeof window !== 'undefined' && window.innerWidth < 640) ? 100 : 118 },
      tooltip: {
        trigger: 'axis',
        formatter: (params: Array<{ seriesName: string; value: number | null; marker: string; axisValue: string; seriesType?: string }>) => {
          const rows = params.filter((row) => row.value !== null && row.value !== undefined && Number.isFinite(Number(row.value)));
          if (!rows.length) return '';
          const remainNames = new Set([savingsName, INVEST_SHARE_NAME, SPENDABLE_REMAIN_NAME]);
          const expenseRows = rows.filter((row) => !remainNames.has(row.seriesName) && !String(row.seriesName).endsWith('·垫'));
          const remainRows = rows.filter((row) => row.seriesName === INVEST_SHARE_NAME || row.seriesName === savingsName || row.seriesName === SPENDABLE_REMAIN_NAME);
          const stackedRows = expenseRows.filter((row) => row.seriesType !== 'scatter');
          const scatterRows = expenseRows.filter((row) => row.seriesType === 'scatter');
          let expenseTotal = stackedRows.reduce((sum, row) => sum + Number(row.value), 0);
          if (scatterRows.length) {
            expenseTotal = Math.max(expenseTotal, ...scatterRows.map((row) => Number(row.value)));
          }
          const remainTotal = remainRows.reduce((sum, row) => sum + Number(row.value), 0);
          const head = rows[0]?.axisValue ?? '';
          const body = rows
            .filter((row) => !String(row.seriesName).endsWith('·垫'))
            .map((row) => `${row.marker}${row.seriesName}：${Number(row.value).toFixed(1)}%`)
            .join('<br/>');
          return `${head}<br/>${body}<br/>支出合计：${expenseTotal.toFixed(1)}%<br/>剩余可支配：${remainTotal.toFixed(1)}%`;
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLabel: { fontSize: 10, color: '#64748b', interval: 11, rotate: 40, hideOverlap: true, margin: 12 },
      },
      yAxis: {
        type: 'value',
        min: yMin < 0 ? Math.floor(yMin / 10) * 10 : 0,
        max: Math.ceil(yMax / 10) * 10,
        axisLabel: { fontSize: 10, color: '#64748b', formatter: '{value}%' },
        splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } },
      },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', height: 18, bottom: 8, start: 0, end: 100 }],
      series: seriesWithMark,
    };
  }, [selectedExpenses, financeInput, allExpenseIds, retirementDate, includeInvestShare, chartInvestRate, before.net]);
  const deltaTotal30 = (assetAfter.at(-1)?.total ?? 0) - (assetBefore.at(-1)?.total ?? 0);
  const kpiCards = [
    { label: '剩余可支配占比变化', value: `${after.remainDisposablePct - before.remainDisposablePct >= 0 ? '+' : ''}${roundPct(after.remainDisposablePct - before.remainDisposablePct)}pp`, sub: `${before.remainDisposablePct}% → ${after.remainDisposablePct}%`, delta: after.remainDisposablePct - before.remainDisposablePct },
    { label: '月度剩余变化', value: `${after.surplus - before.surplus >= 0 ? '+' : ''}${money(after.surplus - before.surplus)}`, sub: `${money(before.surplus)} → ${money(after.surplus)}`, delta: after.surplus - before.surplus },
    { label: '月度支出变化', value: `${after.monthlyExpenses - before.monthlyExpenses >= 0 ? '+' : ''}${money(after.monthlyExpenses - before.monthlyExpenses)}`, sub: `${money(before.monthlyExpenses)} → ${money(after.monthlyExpenses)}`, delta: after.monthlyExpenses - before.monthlyExpenses },
    { label: '30 年资产差额', value: `${deltaTotal30 >= 0 ? '+' : ''}${money(deltaTotal30)}`, sub: '测算 − 消费前', delta: deltaTotal30 },
  ];
  return (
    <div className="relative inline-block">
      <button ref={anchorRef} type="button" onClick={() => (open ? closeAnalyze() : openAnalyze())} className="touch-btn w-full rounded-xl bg-[#17212b] px-3 text-xs font-semibold text-white hover:bg-[#2a3644] sm:w-auto sm:bg-transparent sm:px-0 sm:text-[#d9654a] sm:hover:bg-transparent sm:hover:underline">分析</button>
      {open && (
        <FloatPanel open={open} anchorRef={anchorRef} onClose={closeAnalyze} width={920} maxHeightVh={90} center draggable headerTitle="消费影响分析" mode="auto" density="panel">
          <div className="rounded-2xl border border-slate-200 bg-[#f8faf9] px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                选择要分析的支出
                <InfoTip>{ANALYZE_PICK_TIP}</InfoTip>
              </p>
              <button
                type="button"
                onClick={() => setCompareIds(financeInput.expenses.map((item) => item.id))}
                className="text-[11px] font-semibold text-[#d9654a] hover:underline"
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
                    <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: swatch, opacity: checked ? 1 : 0.35 }} />
                    <span>{item.name || '未命名'}</span>
                  </label>
                );
              })}
              <label
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${includeInvestShare ? 'bg-white font-semibold text-slate-700 shadow-sm' : 'border-slate-200 bg-white/60 text-slate-400'}`}
                style={includeInvestShare ? { borderColor: INVEST_SHARE_COLOR } : undefined}
              >
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  style={{ accentColor: INVEST_SHARE_COLOR }}
                  checked={includeInvestShare}
                  onChange={() => setIncludeInvestShare((current) => !current)}
                />
                <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: INVEST_SHARE_COLOR, opacity: includeInvestShare ? 1 : 0.35 }} />
                <span className="inline-flex items-center gap-1">
                  在图中拆出{INVEST_SHARE_NAME}（剩余×{Number.isInteger(chartInvestRate) ? chartInvestRate : chartInvestRate.toFixed(1)}%）
                  <InfoTip>{ANALYZE_INVEST_TIP}</InfoTip>
                </span>
              </label>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              已选 {selectedExpenses.length} 项
              {includeInvestShare ? ` · ${INVEST_SHARE_NAME}已勾选` : ''}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-[11px] font-semibold text-slate-500">{card.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: deltaTone(card.delta) }}>{card.value}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-400">{card.sub}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-3">
            <p className="flex items-center gap-1 text-sm font-semibold">
              逐月支出占可支配收入
              <InfoTip>{ANALYZE_CHART_TIP}</InfoTip>
            </p>
            <ChartHost className="mt-2 !rounded-xl !bg-white" option={expenseShareOption} />
          </div>
        </FloatPanel>
      )}
    </div>
  );
}

/** 图表宿主：仅客户端挂载 ECharts + 固定高度 + 可见/尺寸变化时 resize，避免 SSR/hydration 后 0×0 */
function ChartHost({ option, className = '' }: { option: Record<string, unknown>; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<InstanceType<typeof ReactECharts>>(null);
  // ponytail: SSR 与首屏一致留空盒，挂载后再画，躲开 echarts DOM 水合不一致
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const el = wrapRef.current;
    if (!el) return;
    const resize = () => {
      try { chartRef.current?.getEchartsInstance()?.resize(); } catch { /* chart may unmount */ }
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
    ro?.observe(el);
    // 走势分区跳转后图进视口再 resize
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) requestAnimationFrame(resize);
    }, { threshold: 0.05 });
    io.observe(el);
    const timer = window.setTimeout(resize, 80);
    return () => {
      ro?.disconnect();
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [mounted]);
  return (
    <div ref={wrapRef} className={`chart-box overflow-hidden rounded-2xl bg-slate-50 p-2 sm:p-3 ${className}`}>
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

/** 列表删除确认：复用 FloatPanel field 矮卡（居中），勿用裸 window.confirm */
function ConfirmDialog({
  open,
  anchorRef,
  title,
  message,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <FloatPanel
      open={open}
      anchorRef={anchorRef}
      onClose={onCancel}
      width={340}
      maxHeightVh={42}
      center
      density="field"
      zIndex={Z_INDEX.toast}
      headerTitle={title}
    >
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{message}</p>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onCancel} className="touch-btn flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">取消</button>
        <button type="button" onClick={onConfirm} className="touch-btn flex-1 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100">确认删除</button>
      </div>
    </FloatPanel>
  );
}

function FloatPanel({
  open,
  anchorRef,
  onClose,
  width = 256,
  maxHeightVh = 70,
  center = false,
  zIndex = Z_INDEX.panel,
  draggable = false,
  headerTitle,
  mode = 'auto',
  density = 'panel',
  footer,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  width?: number;
  maxHeightVh?: number;
  center?: boolean;
  zIndex?: number;
  /** PC 大面板可拖；移动 sheet 模式忽略 */
  draggable?: boolean;
  headerTitle?: string;
  /** auto=按断点；popover=PC 锚点浮层；sheet=移动底部抽屉 */
  mode?: 'auto' | 'popover' | 'sheet';
  /** tip/field 轻量；panel 全套 sheet（仅 panel 抬升 maxHeight） */
  density?: 'tip' | 'field' | 'panel';
  /** 固定底栏（不随内容滚动），如保存/取消 */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  // tip：永不 sheet；field/panel：移动 auto→底卡；仅 panel 用全套抬升
  const asSheet = density !== 'tip' && (mode === 'sheet' || (mode === 'auto' && isMobile));
  const liftFloor = asSheet && density === 'panel';
  const lockBody = asSheet && density === 'panel';
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const userDraggedRef = useRef(false);
  const dragRef = useRef<{ startX: number; startY: number; origTop: number; origLeft: number } | null>(null);

  useEffect(() => {
    if (!open) {
      userDraggedRef.current = false;
      return;
    }
    const safe = readSafeAreaInsets();
    const place = () => {
      if (userDraggedRef.current) return;
      const anchor = anchorRef.current;
      const vv = window.visualViewport;
      const viewLeft = vv?.offsetLeft ?? 0;
      const viewW = vv?.width ?? window.innerWidth;
      const viewH = vv?.height ?? window.innerHeight;
      const vp = viewportBounds(vv, window.innerWidth, window.innerHeight, FLOAT_MARGIN, safe);
      const maxH = viewH * ((liftFloor ? Math.max(maxHeightVh, 72) : maxHeightVh) / 100);
      const panelH = Math.min(panelRef.current?.offsetHeight ?? 240, maxH);
      const panelW = asSheet && density === 'panel'
        ? viewW
        : Math.min(width, Math.max(0, vp.right - vp.left));
      let left: number;
      let top: number;
      let nextW = panelW;
      if (asSheet && density === 'panel') {
        // panel sheet：贴底全宽，仅防左右溢出
        const sheet = placeSheetAtBottom(panelH, vp, viewLeft, viewW, true);
        top = sheet.top;
        left = sheet.left;
        nextW = sheet.width;
      } else if (density === 'field' || center) {
        // field 小编辑：默认视口居中；被键盘挡住则上移夹紧
        const c = placeCenteredInViewport(panelW, panelH, vp);
        top = c.top;
        left = c.left;
      } else if (anchor) {
        const rect = anchor.getBoundingClientRect();
        const near = placeNearAnchor(rect, panelW, panelH, vp, 8, 'start');
        top = near.top;
        left = near.left;
      } else {
        const c = placeCenteredInViewport(panelW, panelH, vp);
        top = c.top;
        left = c.left;
      }
      setPos({ top, left, width: nextW });
      // 键盘改 VV 后浮层已上移/贴底；若焦点在面板内再校正一次内部滚动
      const active = document.activeElement;
      if (active && panelRef.current?.contains(active)) {
        ensureFocusedInVisualViewportNow(active);
      }
    };
    // 仅 panel sheet 锁滚动；field 矮卡 / tip / PC 不锁
    const releaseBodyLock = lockBody ? acquireSheetBodyLock(document.body) : undefined;
    place();
    const raf = window.requestAnimationFrame(() => {
      place();
      window.requestAnimationFrame(place);
    });
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
      releaseBodyLock?.();
    };
  }, [open, anchorRef, width, maxHeightVh, center, asSheet, density, liftFloor, lockBody]);

  useEffect(() => {
    if (!open) return;
    const trigger = anchorRef.current;
    const raf = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(raf);
      trigger?.focus({ preventScroll: true });
    };
  }, [open, anchorRef]);

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onHeaderMouseDown = (event: ReactMouseEvent) => {
    if (!draggable || asSheet || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea, label')) return;
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startY: event.clientY, origTop: pos.top, origLeft: pos.left };
    const onMove = (moveEvent: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const panelW = Math.min(width, window.innerWidth - 32);
      const panelH = Math.min(panelRef.current?.offsetHeight ?? 240, window.innerHeight * (maxHeightVh / 100));
      const nextLeft = clamp(drag.origLeft + (moveEvent.clientX - drag.startX), 8, Math.max(8, window.innerWidth - panelW - 8));
      const nextTop = clamp(drag.origTop + (moveEvent.clientY - drag.startY), 8, Math.max(8, window.innerHeight - Math.min(panelH, 80) - 8));
      userDraggedRef.current = true;
      setPos((current) => ({ top: nextTop, left: nextLeft, width: current.width }));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (!open) return null;
  const sheetMaxVh = liftFloor ? Math.max(maxHeightVh, 78) : maxHeightVh;
  const isPanelSheet = asSheet && density === 'panel';
  const isFieldCard = asSheet && density === 'field';
  const panelWidth = pos.width
    || (isPanelSheet
      ? (typeof window !== 'undefined' ? window.innerWidth : width)
      : Math.min(width, typeof window !== 'undefined' ? window.innerWidth - 16 : width));
  // PC：仅显式标题/可拖时出标题栏；移动 panel/field：标题+关闭
  const showHeader = asSheet || Boolean(headerTitle) || draggable;
  return createPortal(
    <>
      {asSheet && (
        <div
          data-sheet-backdrop
          className="sheet-backdrop"
          style={{ zIndex: zIndex - 1 }}
          aria-hidden
          onPointerDown={blockOverlayEvent}
          onPointerUp={blockOverlayEvent}
          onClick={blockOverlayEvent}
        />
      )}
      <div
        ref={panelRef}
        data-float-panel
        data-ux={isPanelSheet ? 'sheet' : isFieldCard ? 'field-card' : 'popover'}
        data-density={density}
        role="dialog"
        aria-modal={asSheet ? 'true' : undefined}
        aria-label={headerTitle || '编辑'}
        tabIndex={-1}
        onKeyDown={onPanelKeyDown}
        onFocusCapture={(event) => { scrollFocusedFieldIntoView(event.target); }}
        className={`fixed flex flex-col overscroll-contain border border-slate-200 bg-white ${isPanelSheet ? 'rounded-t-3xl rounded-b-none border-b-0 shadow-2xl' : 'rounded-2xl shadow-xl'} overflow-hidden`}
        style={{
          top: pos.top,
          left: pos.left,
          zIndex,
          width: panelWidth,
          maxHeight: asSheet || density === 'field' || center
            ? `min(${sheetMaxVh}dvh, var(--vv-height, ${sheetMaxVh}vh))`
            : `${sheetMaxVh}vh`,
          // place() 已按 visualViewport 贴底/居中夹紧，勿再叠 --kb-inset
          paddingBottom: asSheet ? 'env(safe-area-inset-bottom, 0px)' : undefined,
        }}
      >
        {isPanelSheet && <div className="sheet-handle" aria-hidden />}
        {showHeader && (
          <PanelHeader
            title={headerTitle || '编辑'}
            onClose={onClose}
            density={isFieldCard ? 'field' : 'panel'}
            touchClose={asSheet}
            draggable={draggable && !asSheet}
            onMouseDown={onHeaderMouseDown}
          />
        )}
        <div data-float-scroll className={`min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain ${isFieldCard ? 'p-3' : 'p-4'}`}>
          {children}
        </div>
        {footer && (
          <div className={`shrink-0 border-t border-slate-100 bg-white ${isFieldCard ? 'px-3 py-2.5' : 'px-4 py-3'}`}>
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
/** 闲钱投资：百分比 / 固定金额，风格对齐 Editable + SoftNumberInput */
function ReinvestEditor({
  setting,
  monthlySurplus,
  onChange,
}: {
  setting: ReinvestSetting;
  monthlySurplus: number;
  onChange: (next: ReinvestSetting) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const isPercent = setting.mode === 'percent';
  // 单位外置：展示框只含数值；% / /月 旁侧（与 Editable 一致）
  const displayNum = isPercent
    ? (Number.isInteger(setting.rate) ? String(setting.rate) : setting.rate.toFixed(1))
    : formatEditableNumber(setting.amount);
  const unit = isPercent ? '%' : '/月';
  const commit = (next: ReinvestSetting) => {
    onChange(next);
    window.dispatchEvent(new Event('money-manage-save'));
  };
  const switchMode = (mode: ReinvestMode) => {
    commit(switchReinvestMode(setting, mode, monthlySurplus));
  };
  return (
    <div className="relative block">
      <span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600 sm:flex-row sm:items-center">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1">
            月结余再投入
            <InfoTip>{'每月结余里再投入理财的部分。\n百分比 = 结余的 x% 进理财；也可改固定月额（不超过当月结余）。'}</InfoTip>
          </span>
          <span className="text-[11px] font-normal leading-snug text-slate-400">
            {isPercent ? `结余的 ${displayNum}% 进理财` : '每月固定额进理财'}
          </span>
        </span>
        <span className="field-value-with-unit self-start sm:self-auto">
          <button
            ref={anchorRef}
            type="button"
            onClick={() => setOpen((current) => !current)}
            onDoubleClick={() => setOpen(true)}
            title="点击打开编辑"
            className="field-click"
          >
            {displayNum}
          </button>
          <span className="field-unit">{unit}</span>
        </span>
      </span>
      <FloatPanel open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} width={300} maxHeightVh={52} headerTitle="月结余再投入" density="field">
        <label className="block text-xs text-slate-500">
          模式
          <select
            className="field-input mt-1"
            value={setting.mode}
            onChange={(event) => switchMode(event.target.value as ReinvestMode)}
          >
            <option value="percent">月结余再投入 · 百分比</option>
            <option value="amount">月结余再投入 · 固定金额</option>
          </select>
        </label>
        {isPercent ? (
          <label className="mt-3 block text-xs text-slate-500">
            结余百分比
            <SoftNumberInput
              min={0}
              max={100}
              step={1}
              suffix="%"
              value={Number.isInteger(setting.rate) ? setting.rate : Number(setting.rate.toFixed(1))}
              onCommit={(n) => commit({ ...setting, rate: n })}
            />
          </label>
        ) : (
          <label className="mt-3 block text-xs text-slate-500">
            每月金额
            <SoftNumberInput
              min={0}
              step={100}
              suffix="/月"
              value={setting.amount}
              onCommit={(n) => commit({ ...setting, amount: n })}
            />
          </label>
        )}
        <p className="mt-2 text-[11px] leading-snug text-slate-400">
          {isPercent
            ? `当前约投入 ${money(Math.round(monthlySurplus * clamp(setting.rate, 0, 100) / 100))}/月（按月度剩余估算）`
            : `不超过当月结余；当前结余约 ${money(Math.round(monthlySurplus))}`}
        </p>
      </FloatPanel>
    </div>
  );
}
/** 只改一个数：点击原地 input，blur/Enter 保存；非法恢复编辑前原值。kind 保留兼容，一律 inline。 */
function Editable({ label, value, min = 0, max, step, suffix = '', tip, onChange }: EditableProps) {
  const [editing, setEditing] = useState(false);
  const [editBox, setEditBox] = useState<{ w: number; h: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(String(value));
  // ponytail: 空视同 0；非法不 live 改父、blur 恢复 value（勿落 0）
  const formatValue = (n: number) => String(Number.isInteger(n) ? n : Number(n.toFixed(1)));
  useEffect(() => {
    if (!editing) setDraft(formatValue(value));
  }, [value, editing]);
  useEffect(() => {
    if (!editing || !inputRef.current) return;
    inputRef.current.focus();
    inputRef.current.select();
  }, [editing]);
  const commit = (nextValue: number, syncDraft = true) => {
    const next = clampNumberField(nextValue, { min, max });
    if (syncDraft) setDraft(formatValue(next));
    onChange(next);
    window.dispatchEvent(new Event('money-manage-save'));
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
  const onDraftChange = (raw: string) => {
    setDraft(raw);
    const live = softNumberLive(raw);
    if (live == null) return;
    // 空串保持 draft=''，勿 syncDraft 把 0 挡回输入框
    commit(live, raw.trim() !== '');
  };
  const onDraftBlur = () => {
    if (softNumberIsInvalid(draft)) {
      setDraft(formatValue(value));
      endInline();
      return;
    }
    commit(softNumberCommit(draft, value));
    endInline();
  };
  // 单位外置：展示/编辑框只含数值；suffix（%、个月、年等）旁侧展示，不进 input
  const displayNum = formatEditableNumber(value);
  const unit = suffix.trim();
  return (
    <div className="relative block">
      <span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600 sm:flex-row sm:items-center">
        <span className="flex items-center gap-1">{label}{tip ? <InfoTip>{tip}</InfoTip> : null}</span>
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
              onChange={(event) => onDraftChange(event.target.value)}
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
              style={editBox ? { width: editBox.w, height: editBox.h, minWidth: editBox.w, minHeight: editBox.h } : undefined}
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
function SocialBaseEditor({ value, onChange }: { value: number; onChange: (value: number) => void }) {
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
            commit(n);
          }}
        />
      </label>
      <p className="text-[11px] leading-snug text-slate-400">选城市只填入规划基数，仍可手改；不改变当前工资的五险缴费基数。</p>
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
          className="mt-0.5 h-3.5 w-3.5 accent-[#f07f62]"
          checked={retirement.enabled}
          onChange={(event) => commit({ enabled: event.target.checked })}
          aria-label="关联退休计算"
        />
        <span>
          <span className="block font-medium">关联退休计算</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">用于“退休前还清”和支出走势；关闭后仍保留下面的规划参数。</span>
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-500">
          出生日期
          <input type="date" className="field-input mt-1" value={retirement.birthDate} onChange={(event) => commit({ birthDate: event.target.value })} />
        </label>
        <label className="block text-xs text-slate-500">
          身份
          <select className="field-input mt-1" value={retirement.identity} onChange={(event) => commit({ identity: event.target.value })}>
            <option value="male">男性</option>
            <option value="female-worker">女性职工</option>
            <option value="female-cadre">女性干部</option>
          </select>
        </label>
        <label className="block text-xs text-slate-500">
          参保开始日期
          <input type="date" className="field-input mt-1" value={retirement.insuranceStartDate} onChange={(event) => commit({ insuranceStartDate: event.target.value })} />
        </label>
        <label className="block text-xs text-slate-500">
          计划缴费年限
          <SoftNumberInput min={0} max={20} step={1} suffix="年" value={retirement.contributionYears} onCommit={(value) => commit({ contributionYears: value })} />
        </label>
      </div>
      <SocialBaseEditor value={retirement.base} onChange={(value) => onChange({ base: value })} />
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
        <span>预计退休</span>
        <strong className="tabular-nums text-slate-700">{retirementDate || '未设置'}</strong>
      </div>
    </div>
  );
}
function DateEditable({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return <div className="relative block"><span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600 sm:flex-row"><span>{label}</span><button ref={anchorRef} type="button" onClick={() => setOpen((current) => !current)} onDoubleClick={() => setOpen(true)} title="点击打开编辑" className="field-click self-start sm:self-auto">{value || '未设置'}</button></span><FloatPanel open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} width={280} maxHeightVh={40} headerTitle={label} density="field"><label className="block text-xs text-slate-500">选择日期<input autoFocus type="date" min={min} value={value} onChange={(event) => { onChange(event.target.value); window.dispatchEvent(new Event('money-manage-save')); }} className="field-input mt-2" /></label></FloatPanel></div>;
}
function SelectEditable({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const display = options.find((item) => item.value === value)?.label ?? value;
  return <div className="relative block"><span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600 sm:flex-row"><span>{label}</span><button ref={anchorRef} type="button" onClick={() => setOpen((current) => !current)} onDoubleClick={() => setOpen(true)} title="点击打开编辑" className="field-click self-start sm:self-auto">{display}</button></span><FloatPanel open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} width={280} maxHeightVh={40} headerTitle={label} density="field"><label className="block text-xs text-slate-500">选择<select autoFocus value={value} onChange={(event) => { onChange(event.target.value); window.dispatchEvent(new Event('money-manage-save')); }} className="field-input mt-1">{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></FloatPanel></div>;
}
const saveEvent = () => window.dispatchEvent(new Event('money-manage-save'));

/** 数值输入：聚焦可空；空视同 0；blur 空/非法 → 0（再 clamp）；suffix 外置不进 input */
function SoftNumberInput({
  value,
  min,
  max,
  step,
  className = 'field-input mt-1',
  suffix = '',
  onCommit,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number | string;
  className?: string;
  suffix?: string;
  onCommit: (n: number) => void;
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
  const inputClass = unit
    ? `${className.replace(/\bmt-1\b/g, '').trim()} min-w-0 flex-1`.trim()
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
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        const live = softNumberLive(raw);
        if (live == null) return;
        onCommit(clamp(live, lo, hi));
      }}
      onBlur={() => {
        focusedRef.current = false;
        finish(draft);
      }}
    />
  );
  if (!unit) return input;
  return (
    <span className="field-value-with-unit mt-1 w-full justify-start">
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
  return mode === 'equal_principal' ? `${money(payment)} / 月（首月）·${start}起` : `${money(payment)} / 月·${start}起`;
}
function formatExpenseMode(mode: Expense['mode']) {
  return mode === 'installment' ? '分期' : mode === 'percentage' ? '按比例' : mode === 'one_time' ? '一次性' : '固定金额';
}
function formatExpenseInstallment(expense: Expense) {
  if (expense.mode !== 'installment') return '—';
  const total = expense.total || 0;
  const down = expense.downPayment || 0;
  const term = expense.term || 36;
  const pct = total > 0 ? (down / total * 100) : 0;
  const years = term / 12;
  const yearLabel = Number.isInteger(years) ? `${years}` : years.toFixed(1);
  return `${repaymentModeLabel(expense.repaymentMode)} · ${money(total)} · 首付 ${money(down)}（${pct.toFixed(1)}%）· ${term} 期 / ${yearLabel} 年 · ${expense.interest || 0}%`;
}
/** PS 锁比风格链标：表示等价联动（不可解锁） */
function LinkLockIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

/**
 * 等价联动字段组：左右并排，中间链标；hint 只读说明（不提供解锁）。
 * alwaysRow：窄弹层内也强制一行（如资产配置）；分期等宽表单仍默认可竖排。
 * ponytail: 仅布局/信息架构，不改联动公式本身
 */
function LinkedFieldGroup({ hint, children, alwaysRow = false }: { hint?: string; children: [ReactNode, ReactNode]; alwaysRow?: boolean }) {
  return (
    <div className="linked-field-group rounded-xl border border-slate-200/90 bg-slate-50/70 px-2.5 py-2">
      <div className={alwaysRow ? 'flex flex-row items-stretch gap-1' : 'flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-1'}>
        <div className="min-w-0 flex-1">{children[0]}</div>
        <div
          className={alwaysRow
            ? 'flex w-7 shrink-0 flex-col items-center justify-center text-[#f07f62]'
            : 'flex h-6 shrink-0 flex-row items-center justify-center gap-1 text-[#f07f62] sm:h-auto sm:w-7 sm:flex-col sm:gap-0'}
          title="联动"
          aria-label="联动"
        >
          {alwaysRow ? (
            <>
              <span className="mb-0.5 h-2 w-px bg-[#f07f62]/30" />
              <LinkLockIcon className="h-3.5 w-3.5" />
              <span className="mt-0.5 h-2 w-px bg-[#f07f62]/30" />
            </>
          ) : (
            <>
              <span className="hidden h-2 w-px bg-[#f07f62]/30 sm:mb-0.5 sm:block" />
              <span className="h-px w-6 bg-[#f07f62]/30 sm:hidden" />
              <LinkLockIcon className="h-3.5 w-3.5" />
              <span className="h-px w-6 bg-[#f07f62]/30 sm:hidden" />
              <span className="hidden h-2 w-px bg-[#f07f62]/30 sm:mt-0.5 sm:block" />
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">{children[1]}</div>
      </div>
      {hint ? <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

/** 默认：总资产 / 理财 / 现金 直接填；现金行右侧 select 切「默认/应急月数」，细节进二级「应急设置」 */
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
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const emergencyBtnRef = useRef<HTMLButtonElement>(null);
  const monthsPlan = emergency.mode === 'months';
  const plan = emergency.monthsPlan;
  const cashSummary = monthsPlan
    ? (plan.months > 0 ? `应急月数 · ${plan.months} 月` : '应急月数 · 去设置')
    : '默认';
  const closeAsset = () => {
    setEmergencyOpen(false);
    setOpen(false);
  };
  const setCashMode = (mode: 'amount' | 'months') => {
    onMonthsPlanChecked(mode === 'months');
    if (mode !== 'months') setEmergencyOpen(false);
  };
  const autoMonthly = monthlyFromAnnual(plan.annualSpend) || planMonthly;
  return (
    <div className="relative block min-w-0 sm:col-span-2">
      <span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600 sm:flex-row sm:items-center">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            资产配置
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[#f07f62]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#d9654a]" title="现金+理财=总资产">
              <LinkLockIcon className="h-3 w-3" />联动
            </span>
            <InfoTip>{`默认直接填：总资产、理财、现金（备用金=现金）。\n现金行选「应急月数」后，点「设置」用往年支出÷12×月数推算现金。`}</InfoTip>
          </span>
          <span className="text-[11px] font-normal leading-snug text-slate-400">
            总资产 / 理财 / 现金 · {cashSummary}
          </span>
        </span>
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          onDoubleClick={() => setOpen(true)}
          title="点击打开编辑（资产联动）"
          className="field-click min-w-0 max-w-full self-start truncate sm:self-auto"
        >
          {money(totalAssets)}
        </button>
      </span>
      <FloatPanel open={open} anchorRef={anchorRef} onClose={closeAsset} width={340} maxHeightVh={72} headerTitle="资产配置" density="field">
        <label className="mb-2 block text-xs text-slate-500">总资产
          <SoftNumberInput min={0} step={1000} value={totalAssets} onCommit={onTotal} />
        </label>
        {/* 理财金额 ↔ 占比同行；改一端同步总资产恒等式内的现金/理财 */}
        <div className="mb-3">
          <LinkedFieldGroup alwaysRow hint="理财金额 ↔ 占比（相对总资产）">
            <label className="block text-xs text-slate-500">理财资产
              <SoftNumberInput min={0} max={totalAssets} step={1000} value={invest} onCommit={onInvestAmount} />
            </label>
            <label className="block text-xs text-slate-500">理财占比
              <SoftNumberInput min={0} max={100} step={1} suffix="%" value={Number.isInteger(investRatio) ? investRatio : Number(investRatio.toFixed(1))} onCommit={onInvestRatio} />
            </label>
          </LinkedFieldGroup>
        </div>
        <div className="mb-3">
          {/* 现金行：左侧标签，右侧 native select 切默认 / 应急月数 */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              现金（备用金）
              <InfoTip>{EMERGENCY_CASH_MODE_TIP}</InfoTip>
            </span>
            <select
              aria-label="现金备用金方式"
              className="field-input !mt-0 !w-auto max-w-full py-1 text-xs font-medium text-slate-700"
              value={monthsPlan ? 'months' : 'amount'}
              onChange={(event) => setCashMode(event.target.value === 'months' ? 'months' : 'amount')}
            >
              <option value="amount">默认</option>
              <option value="months">应急月数</option>
            </select>
          </div>
          {!monthsPlan && (
            <SoftNumberInput min={0} max={totalAssets} step={1000} value={cash} onCommit={onCash} />
          )}
          <p className="mt-1 text-[11px] leading-snug text-slate-500">现金 + 理财 = 总资产（改一端同步其它）</p>
          {monthsPlan && (
            <div className="relative mt-2">
              <button
                ref={emergencyBtnRef}
                type="button"
                onClick={() => setEmergencyOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-slate-300"
              >
                <span className="font-medium text-slate-700">设置</span>
                <span className="tabular-nums text-slate-500">
                  {plan.months > 0 ? `${plan.months} 月 · ${money(cash)}` : '往年支出 / 月数'}
                </span>
              </button>
              <FloatPanel
                open={emergencyOpen}
                anchorRef={emergencyBtnRef}
                onClose={() => setEmergencyOpen(false)}
                width={320}
                maxHeightVh={64}
                zIndex={Z_INDEX.nestedPanel}
                headerTitle="应急设置"
                density="field"
              >
                <div className="space-y-3">
                  <label className="block text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">往年支出额度<InfoTip>{EMERGENCY_ANNUAL_SPEND_TIP}</InfoTip></span>
                    <SoftNumberInput min={0} step={1000} value={plan.annualSpend} onCommit={onAnnualSpend} />
                  </label>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>每月支出（自动）</span>
                    <span className="font-mono font-semibold tabular-nums text-[#17212b]">
                      {money(autoMonthly)}
                      <span className="ml-1 font-sans font-normal text-slate-400">= 往年÷12</span>
                    </span>
                  </div>
                  {plan.annualSpend <= 0 && monthlyExpenses > 0 && (
                    <p className="text-[11px] leading-snug text-slate-400">尚未填往年时，暂用账本本月支出 {money(monthlyExpenses)} 作月均</p>
                  )}
                  <label className="block text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">应急月数<InfoTip>{EMERGENCY_MONTHS_FIELD_TIP}</InfoTip></span>
                    <SoftNumberInput
                      min={0}
                      max={36}
                      step={0.5}
                      suffix="个月"
                      value={plan.months}
                      onCommit={onCashByMonths}
                    />
                  </label>
                  <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    <div className="flex items-center justify-between gap-2">
                      <span>推算现金（备用金）</span>
                      <span className="font-mono font-semibold tabular-nums text-[#17212b]">{money(cash)}</span>
                    </div>
                    <p className="leading-snug text-slate-400">现金 = 每月支出 × 应急月数；理财 = 总资产 − 现金</p>
                  </div>
                </div>
              </FloatPanel>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">调整后可用资产<InfoTip>{ADJUSTED_AVAILABLE_ASSETS_TIP}</InfoTip></span>
            <span className="font-mono tabular-nums text-[#17212b]">{money(adjustedAvailableAssets)}</span>
          </div>
        </div>
      </FloatPanel>
    </div>
  );
}

function InstallmentSettingsPanel({ expense, onChange, retirementDate }: { expense: Expense; onChange: (patch: Partial<Expense>) => void; retirementDate?: string }) {
  const startDate = expense.startDate || todayDateKey();
  const total = expense.total || 0;
  const down = Math.min(expense.downPayment || 0, total);
  const followRetirement = Boolean(expense.followRetirement);
  const term = clampInstallmentTerm(startDate, Math.max(1, expense.term || 36), followRetirement, retirementDate);
  const downPercent = total > 0 ? Math.round(down / total * 1000) / 10 : 0;
  const years = Math.round(term / 12 * 10) / 10;
  const mode = expense.repaymentMode || 'equal_principal_interest';
  const loanInput = { ...expense, term, downPayment: down, total, startDate };
  const monthly = installmentMonthlyPayment(loanInput);
  const explanation = explainInstallmentPayment(loanInput);
  const span = resolveExpenseSpan({ ...expense, startDate, term, followRetirement }, { retirementDate });
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
    onChange({ downPayment: clamp(Math.round(total * pct / 100), 0, total) });
  };
  const patchTermMonths = (months: number) => {
    const next = clampInstallmentTerm(startDate, months, followRetirement, retirementDate);
    onChange({ term: next, endDate: resolveExpenseSpan({ ...expense, startDate, term: next, followRetirement }, { retirementDate }).end });
  };
  const patchTermYears = (value: number) => {
    const safeYears = clamp(value, 1 / 12, 30);
    patchTermMonths(Math.round(safeYears * 12));
  };
  const patchStart = (value: string) => {
    const start = value || todayDateKey();
    const nextTerm = clampInstallmentTerm(start, term, followRetirement, retirementDate);
    onChange({
      startDate: start,
      term: nextTerm,
      endDate: resolveExpenseSpan({ ...expense, startDate: start, term: nextTerm, followRetirement }, { retirementDate }).end,
    });
  };
  const patchFollowRetirement = (checked: boolean) => {
    const nextTerm = clampInstallmentTerm(startDate, term, checked, retirementDate);
    onChange({
      followRetirement: checked,
      term: nextTerm,
      endDate: resolveExpenseSpan({ ...expense, startDate, term: nextTerm, followRetirement: checked }, { retirementDate }).end,
    });
  };
  const isNarrow = useIsMobile();
  const [formulaOpen, setFormulaOpen] = useState(false);
  return <div className="installment-settings space-y-3">
    <label className="block text-xs text-slate-500">还款方式<select className="field-input mt-1" value={mode} onChange={(event) => onChange({ repaymentMode: event.target.value as RepaymentMode })}><option value="equal_principal_interest">等额本息（每月固定）</option><option value="equal_principal">等额本金（首月最高，逐月递减）</option></select></label>
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <span className="text-xs text-slate-500">{mode === 'equal_principal' ? '预估首月月供' : '预估月供'}</span>
        <strong className="font-mono text-base tabular-nums text-[#17212b]">{money(monthly)}</strong>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-400">计入分期月供 / 剩余可支配占比</p>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="block text-xs text-slate-500">开始时间（默认当月）<input className="field-input mt-1" type="date" value={startDate.slice(0, 10)} onChange={(event) => patchStart(event.target.value)} /></label>
      <label className="block text-xs text-slate-500">总价<SoftNumberInput min={0} step={1000} value={total} onCommit={patchTotal} /></label>
    </div>
    <label className="flex items-start gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-xs leading-snug text-slate-600">
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#f07f62]" checked={followRetirement} onChange={(event) => patchFollowRetirement(event.target.checked)} />
      <span>勾选后须在退休前还清（自动截断最长还款期）</span>
    </label>
    {followRetirement && (
      <p className="text-[11px] leading-snug text-slate-500">
        退休日 {retirementDate || '未设置'} · 有效期数 {term} · 预计还清 {span.end}
      </p>
    )}
    <LinkedFieldGroup hint="首付金额 ↔ 比例（相对总价）；改一边另一边跟">
      <label className="block text-xs text-slate-500">首付金额<SoftNumberInput min={0} step={1000} value={down} onCommit={patchDownAmount} /></label>
      <label className="block text-xs text-slate-500">首付比例<SoftNumberInput min={0} max={100} step={0.1} suffix="%" value={downPercent} onCommit={patchDownPercent} /></label>
    </LinkedFieldGroup>
    <LinkedFieldGroup hint="年数 ↔ 期数：1 年 = 12 期；贷款计算一律用月数">
      <label className="block text-xs text-slate-500">年数<SoftNumberInput min={0.1} max={30} step={0.1} suffix="年" value={years} onCommit={patchTermYears} /></label>
      <label className="block text-xs text-slate-500">期数<SoftNumberInput min={1} max={360} step={1} suffix="月" value={term} onCommit={patchTermMonths} /></label>
    </LinkedFieldGroup>
    <label className="block text-xs text-slate-500">年化利率<SoftNumberInput min={0} max={100} step={0.1} suffix="%" value={expense.interest || 0} onCommit={(n) => onChange({ interest: n })} /></label>
    {isNarrow ? (
      <div className="rounded-xl border border-slate-100 bg-slate-50">
        <button type="button" onClick={() => setFormulaOpen((current) => !current)} className="touch-btn flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-semibold text-slate-700">
          <span>计算说明</span>
          <span className="text-slate-400">{formulaOpen ? '收起' : '展开'}</span>
        </button>
        {formulaOpen && (
          <div className="space-y-1.5 border-t border-slate-100 px-3 py-2.5 text-xs text-slate-600">
            <div className="font-medium text-slate-700">计算公式</div>
            <p className="leading-relaxed break-words">{explanation.formula}</p>
            <div className="pt-1 font-medium text-slate-700">计算过程</div>
            <ol className="list-decimal space-y-0.5 pl-4 leading-relaxed tabular-nums">
              {explanation.steps.map((step) => <li key={step} className="break-words">{step}</li>)}
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
          {explanation.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>
    )}
  </div>;
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
    inputRef.current.select();
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
    if (next !== value) onChange(next);
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
          style={editBox ? { width: Math.max(editBox.w, 96), height: editBox.h, minWidth: Math.max(editBox.w, 96), minHeight: editBox.h } : undefined}
        />
      ) : (
        <button
          ref={anchorRef}
          type="button"
          onClick={startInline}
          onDoubleClick={startInline}
          title="点击直接编辑"
          className={btnClass.includes('field-click') ? btnClass : `field-click max-w-full truncate text-left ${btnClass}`}
        >
          {display}
        </button>
      )}
    </div>
  );
}

function Metric({ label, value, detail, negative = false }: { label: string; value: string; detail: string; negative?: boolean }) { return <div className="relative block"><span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600"><span className="flex items-center gap-1">{label}<InfoTip>{detail}</InfoTip></span><span className={`field-readonly ${negative ? 'text-red-500' : ''}`}>{value}</span></span></div>; }
function Breakdown({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="relative block"><span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600"><span className="flex items-center gap-1">{label}<InfoTip>{detail}</InfoTip></span><span className="field-readonly">{value}</span></span></div>; }
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
  rows: Array<{ name: string; personal: number; personalAmount: number; company: number; companyAmount: number; base?: number }>;
  total: number;
  tax: number;
  net: number;
  deductions: Array<{ name: string; standard: number; actual: number; enabled: boolean }>;
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
  const housingPersonal = rows.find((row) => row.name === HOUSING_FUND_NAME)?.personal ?? 5;
  // 企业合计 = 各险种企业部分之和（不含个税）；合计列 = 个人 + 企业
  const companyTotal = rows.reduce((sum, row) => sum + row.companyAmount, 0);
  const bothTotal = total + companyTotal;
  const burdenSharePct = calcSocialBurdenSharePct({ salary, personalTotal: total, companyTotal });
  const deductionTotal = total + tax;
  const taxable = Math.max(0, salary - total - deductions.reduce((sum, row) => sum + row.actual, 0));
  const bracket = findTaxMonthlyBracket(taxable);
  const bracketSliceRows = buildTaxBracketSliceRows(taxable);
  const closeMain = () => {
    setRetirementSettingsOpen(false);
    setTaxDetailOpen(false);
    setOpen(false);
  };
  return (
    <div className="relative block">
      <span className="field-row-mobile flex items-center justify-between gap-2 text-sm text-slate-600 sm:flex-row">
        <span className="flex items-center gap-1">
          五险一金和个税
          <InfoTip>{'个人五险一金 + 本月预估个税。\n点金额打开明细；「退休与社保」在二级弹层设置。'}</InfoTip>
        </span>
        <button ref={anchorRef} type="button" onClick={() => setOpen((current) => !current)} onDoubleClick={() => setOpen(true)} title="点击查看明细" className="field-click self-start sm:self-auto">-{money(deductionTotal)}</button>
      </span>
      <FloatPanel open={open} anchorRef={anchorRef} onClose={closeMain} width={620} headerTitle={INCOME_DETAIL_DEDUCTION_PANEL_TITLE}>
        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">五险一金</h4>
          <label className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
            <input type="checkbox" className="h-3.5 w-3.5 accent-[#f07f62]" checked={socialEnabled} onChange={(event) => onSocialEnabledChange(event.target.checked)} />
            <span className="font-medium">缴纳五险一金</span>
            <span className="text-xs text-slate-400">{socialEnabled ? '勾选后按费率扣个人/企业社保，并抵减个税' : '未勾选：个人/企业均为 0，个税无社保扣减'}</span>
          </label>
          {/* 入口行 → 二级 FloatPanel（nestedPanel）；勿在一级内折叠展开 */}
          <div className="relative">
            <button
              ref={retirementSettingsAnchorRef}
              type="button"
              onClick={() => setRetirementSettingsOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left text-sm hover:border-slate-200"
            >
              <span className="font-medium text-slate-700">{INCOME_DETAIL_SOCIAL_SETTINGS_ENTRY}</span>
              <span className="tabular-nums text-xs text-slate-500">
                {retirement.enabled ? `已关联 · ${retirementDate || '待完善'}` : '未关联'}
              </span>
            </button>
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
              <RetirementSocialEditor retirement={retirement} retirementDate={retirementDate} onChange={onRetirementChange} />
            </FloatPanel>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>五险基数 <strong className="tabular-nums">{money(insuranceBase)}</strong>{insuranceFollowSalary ? <span className="ml-1 text-xs text-slate-400">按工资</span> : <span className="ml-1 text-xs text-slate-400">自定义</span>}</span>
                {!insuranceFollowSalary && <button type="button" className="text-xs font-semibold text-[#d9654a] hover:underline" onClick={onInsuranceFollowSalary}>恢复按工资</button>}
              </div>
              <label className="mt-2 block text-xs text-slate-500">
                指定基数（≠ 税前工资）
                <SoftNumberInput className="field-input mt-1" min={0} step={1} value={insuranceBase} onCommit={onInsuranceBaseChange} />
              </label>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>公积金基数 <strong className="tabular-nums">{money(housingFundBase)}</strong>{housingFollowSalary ? <span className="ml-1 text-xs text-slate-400">按工资</span> : <span className="ml-1 text-xs text-slate-400">自定义</span>}</span>
                {!housingFollowSalary && <button type="button" className="text-xs font-semibold text-[#d9654a] hover:underline" onClick={onHousingFollowSalary}>恢复按工资</button>}
              </div>
              <label className="mt-2 block text-xs text-slate-500">
                指定基数（可与五险不同）
                <SoftNumberInput className="field-input mt-1" min={0} step={1} value={housingFundBase} onCommit={onHousingFundBaseChange} />
              </label>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>项目</th><th>基数</th><th>个人比例</th><th>个人金额</th><th>企业比例</th><th>企业金额</th><th>合计</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td className="tabular-nums text-xs text-slate-500">{money(row.base ?? (row.name === HOUSING_FUND_NAME ? housingFundBase : insuranceBase))}</td>
                    <td>{row.name === HOUSING_FUND_NAME ? <label className="inline-flex items-center gap-1"><SoftNumberInput className="field-input w-20" min={5} max={12} step={0.1} suffix="%" value={housingPersonal} onCommit={onHousingPersonalChange} /><span className="text-[10px] text-slate-400">5–12</span></label> : `${row.personal}%`}</td>
                    <td>{money(row.personalAmount)}</td>
                    <td>{row.company}%</td>
                    <td>{money(row.companyAmount)}</td>
                    <td className="tabular-nums font-medium">{money(row.personalAmount + row.companyAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between"><span>个人缴纳合计</span><span className="tabular-nums font-semibold">-{money(total)}</span></div>
            <div className="flex justify-between"><span>企业缴纳合计</span><span className="tabular-nums font-semibold">{money(companyTotal)}</span></div>
            <div className="flex justify-between font-semibold"><span>双方合计</span><span className="tabular-nums">{money(bothTotal)}</span></div>
            <div className="flex items-center justify-between gap-2 text-slate-600">
              <span className="flex items-center gap-1">整体占比<InfoTip>{'占比 =（个人+企业）/（税前工资+企业缴纳）。\n企业缴纳不含个税；关闭缴纳时分子为 0。'}</InfoTip></span>
              <span className="tabular-nums font-semibold text-[#17212b]">{burdenSharePct == null ? '—' : `${roundPct(burdenSharePct)}%`}</span>
            </div>
          </div>
        </section>
        {/* 一级个税区：仅预估摘要 + 查看明细；专项附加扣除进二级 */}
        <section className="mt-6 space-y-3 border-t border-slate-100 pt-4">
          <h4 className="flex items-center gap-1 text-sm font-semibold text-slate-700">
            个税
            <InfoTip>{'专项附加扣除在「查看明细」中勾选。\n一级仅展示本月预估个税摘要。'}</InfoTip>
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>应纳税所得额</span><strong>{money(taxable)}</strong></div>
            <div className="relative flex items-center justify-between gap-2 border-t border-slate-100 pt-2 font-semibold">
              <span>本月预估个税</span>
              <span className="flex items-center gap-2">
                <button
                  ref={taxDetailAnchorRef}
                  type="button"
                  onClick={() => setTaxDetailOpen((current) => !current)}
                  className="text-xs font-semibold text-[#d9654a] hover:underline"
                >
                  {INCOME_DETAIL_TAX_DETAIL_ENTRY}
                </button>
                <strong className="text-red-500">-{money(tax)}</strong>
              </span>
              {/* 二级：抵扣 → 各区间税额 → 税率表；勿双标题 */}
              <FloatPanel
                open={taxDetailOpen}
                anchorRef={taxDetailAnchorRef}
                onClose={() => setTaxDetailOpen(false)}
                width={560}
                maxHeightVh={72}
                zIndex={Z_INDEX.nestedPanel}
                headerTitle={INCOME_DETAIL_TAX_DETAIL_PANEL_TITLE}
              >
                <section className="space-y-3 text-sm">
                  <p className="text-xs font-medium text-slate-600">专项附加扣除</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm"><span className="flex items-center gap-2"><input type="checkbox" className="accent-[#f07f62]" checked={deductions.find((row) => row.name === "住房租金")?.enabled ?? false} onChange={(event) => onRentChange(event.target.checked)} /><span>住房租金<span className="ml-1 font-normal text-slate-400">（勾选计入专项附加扣除）</span></span></span><span className="mt-2 block text-xs text-slate-500">政策标准 {money(deductions.find((row) => row.name === "住房租金")?.standard ?? 0)} / 月</span></label>
                    <label className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm"><span className="flex items-center gap-2"><input type="checkbox" className="accent-[#f07f62]" checked={deductions.find((row) => row.name === "赡养老人")?.enabled ?? false} onChange={(event) => onElderlyChange(event.target.checked)} /><span>赡养老人<span className="ml-1 font-normal text-slate-400">（勾选计入专项附加扣除）</span></span></span><span className="mt-2 block text-xs text-slate-500">政策标准 {money(deductions.find((row) => row.name === "赡养老人")?.standard ?? 0)} / 月</span></label>
                  </div>
                  <div className="space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
                    <div className="flex justify-between"><span>税前工资</span><span className="tabular-nums text-slate-700">{money(salary)}</span></div>
                    <div className="flex justify-between"><span>个人五险一金</span><span className="tabular-nums text-slate-700">-{money(total)}</span></div>
                    {deductions.map((row) => <div key={row.name} className="flex justify-between"><span>{row.name}</span><span className="tabular-nums text-slate-700">-{money(row.actual)}</span></div>)}
                    <div className="flex justify-between border-t border-slate-100 pt-1 font-medium text-slate-700"><span>应纳税所得额</span><span className="tabular-nums">{money(taxable)}</span></div>
                    <div className="flex justify-between"><span>当前区间：税率 / 速算扣除数</span><span className="tabular-nums">{bracket.rate}% / {money(bracket.quick)}</span></div>
                  </div>
                </section>
                <section className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
                  <p className="text-xs text-slate-500">按当前应纳税所得额 {money(taxable)} 分档累进；高亮为命中档。各档税额之和 = 本月预估个税。</p>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>月应纳税所得额</th><th>税率</th><th>本区间税额</th><th>状态</th></tr></thead>
                      <tbody>
                        {bracketSliceRows.map((item) => (
                          <tr key={item.range} className={item.isCurrent ? 'bg-emerald-50 font-semibold' : ''}>
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
                  <p className="text-xs font-medium text-slate-600">纳税区间表（税率 / 速算扣除数）</p>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>月应纳税所得额</th><th>税率</th><th>速算扣除数</th><th>当前状态</th></tr></thead>
                      <tbody>
                        {TAX_MONTHLY_BRACKETS.map((item) => (
                          <tr key={item.range} className={item.range === bracket.range ? 'bg-emerald-50 font-semibold' : ''}>
                            <td>{item.range}</td>
                            <td>{item.rate}%</td>
                            <td>{money(item.quick)}</td>
                            <td>{item.range === bracket.range ? '当前区间' : '可选区间'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </FloatPanel>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2"><span className="flex items-center gap-1">到手收入（主区同步）<InfoTip>税前工资 − 五险一金 − 本月个税</InfoTip></span><strong>{money(net)}</strong></div>
          </div>
        </section>
      </FloatPanel>
    </div>
  );
}
