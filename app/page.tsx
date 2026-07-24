'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import ReactECharts from 'echarts-for-react';
import { explainInstallmentPayment, installmentMonthlyPayment, installmentPaymentAsOf, migrateInstallmentTerms, type PageRepaymentMode as RepaymentMode } from './installmentPayment';
import { cashFlowRatios, remainDisposableSharePct, roundPct } from './cashFlowRatios';
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
  clampInstallmentTerm,
  defaultOneTimeDate,
  isActiveInMonth,
  monthKey,
  resolveExpenseSpan,
  todayDateKey,
  todayMonthKey,
} from './expenseSpan';

type Expense = { id: string; name: string; category: string; mode: 'fixed' | 'percentage' | 'installment' | 'one_time'; amount: number; rate?: number; total?: number; downPayment?: number; term?: number; interest?: number; repaymentMode?: RepaymentMode; startDate?: string; endDate?: string; followRetirement?: boolean };
type SnapshotChange = { id: string; label: string; path: 'salary' | 'cash' | 'returnRate'; value: number };
type Snapshot = { id: string; name: string; effectiveDate: string; changes: SnapshotChange[]; allowNegative: boolean };
type EditableProps = { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void };
type SocialRate = { personal: number; company: number };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const money = (value: number) => `¥${Math.round(value).toLocaleString('zh-CN')}`;
/** 相对年偏移 → 日历年标签（0=现在，5→2031年） */
const forecastYearLabel = (offsetYears: number, baseYear = new Date().getFullYear()) => (
  offsetYears === 0 ? '现在' : `${baseYear + offsetYears}年`
);
// 差异色：增加=主题橙红，减少=主题绿
const DELTA_UP = '#f07f62';
const DELTA_DOWN = '#3d8f6e';
const deltaTone = (delta: number) => (delta > 0 ? DELTA_UP : delta < 0 ? DELTA_DOWN : '#94a3b8');
const uid = () => `expense-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const initialExpenses: Expense[] = [
  { id: 'parent-support', name: '上交父母', category: '家庭支持', mode: 'fixed', amount: 3000, startDate: todayDateKey() },
  { id: 'daily-life', name: '日常生活', category: '生活', mode: 'fixed', amount: 4200, startDate: todayDateKey() },
  { id: 'car-installment', name: '车辆分期', category: '交通', mode: 'installment', amount: 0, total: 150000, downPayment: 45000, term: 36, interest: 4.2, repaymentMode: 'equal_principal_interest', startDate: todayDateKey(), followRetirement: false },
];
const retirementDefaults = { enabled: false, birthDate: '1996-01-01', identity: 'male', insuranceStartDate: '2016-01-01', contributionYears: 20, base: 7380 };
const addMonths = (date: string, months: number) => { const next = new Date(`${date || new Date().toISOString().slice(0, 10)}T00:00:00`); next.setMonth(next.getMonth() + months); return next.toISOString().slice(0, 10); };
const retirementDateFor = (birthDate: string, identity: string) => { const birth = new Date(`${birthDate}T00:00:00`); if (Number.isNaN(birth.getTime())) return ''; const age = identity === 'female-worker' ? 55 : identity === 'female-cadre' ? 58 : 63; birth.setFullYear(birth.getFullYear() + age); return birth.toISOString().slice(0, 10); };
const defaultSocialRates: Record<string, SocialRate> = { 养老保险: { personal: 8, company: 16 }, 医疗保险: { personal: 2, company: 6 }, 失业保险: { personal: 0.5, company: 0.5 }, 工伤保险: { personal: 0, company: 0.4 }, 生育保险: { personal: 0, company: 0.8 }, 住房公积金: { personal: 5, company: 5 } };
const taxBrackets = [{ range: '不超过 3,000', rate: 3, quick: 0 }, { range: '3,000 - 12,000', rate: 10, quick: 210 }, { range: '12,000 - 25,000', rate: 20, quick: 1410 }, { range: '25,000 - 35,000', rate: 25, quick: 2660 }, { range: '35,000 - 55,000', rate: 30, quick: 4410 }, { range: '55,000 - 80,000', rate: 35, quick: 7160 }, { range: '超过 80,000', rate: 45, quick: 15160 }];
const InfoTip = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label="查看说明"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-xs font-semibold text-slate-500 hover:border-[#f07f62] hover:text-[#d9654a]"
      >
        i
      </button>
      <span
        role="tooltip"
        className={`absolute left-1/2 top-full z-[60] mt-2 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl bg-[#17212b] p-3 text-left text-xs font-normal leading-5 text-white shadow-xl transition ${open ? 'visible opacity-100' : 'pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100'}`}
      >
        {children}
      </span>
    </span>
  );
};
const SectionTitle = ({ eyebrow, title, tip, compact = false }: { eyebrow?: string; title: string; tip?: ReactNode; compact?: boolean }) => <div className="flex min-w-0 items-center gap-2">{eyebrow && <p className="eyebrow shrink-0">{eyebrow}</p>}<h2 className={`${compact ? 'text-lg' : 'text-xl sm:text-2xl'} min-w-0 font-semibold`}>{title}</h2>{tip && <InfoTip>{tip}</InfoTip>}</div>;

type FinanceInput = { salary: number; cash: number; invest: number; returnRate: number; emergencyMonths: number; totalAssets: number; expenses: Expense[]; rentEnabled: boolean; elderlyEnabled: boolean; socialRates: Record<string, SocialRate> };
type FinanceResult = ReturnType<typeof computeFinanceResult>;
const repaymentModeLabel = (mode?: RepaymentMode) => (mode === 'equal_principal' ? '等额本金' : '等额本息');
// 非分期的持续月支出（固定 + 比例）；分期按月另算
function nonInstallmentRecurring(expenses: Expense[], net: number, investmentIncome: number) {
  return expenses.reduce((sum, expense) => {
    if (expense.mode === 'one_time' || expense.mode === 'installment') return sum;
    if (expense.mode === 'fixed') return sum + expense.amount;
    if (expense.mode === 'percentage') return sum + (net + investmentIncome) * (expense.rate || 0) / 100;
    return sum;
  }, 0);
}
// 持续月支出：不含 one_time（预测 month>=1 / year>=2 只用这笔）
function recurringMonthlyExpenses(expenses: Expense[], net: number, investmentIncome: number) {
  return expenses.reduce((sum, expense) => {
    if (expense.mode === 'one_time') return sum;
    if (expense.mode === 'fixed') return sum + expense.amount;
    if (expense.mode === 'percentage') return sum + (net + investmentIncome) * (expense.rate || 0) / 100;
    return sum + installmentMonthlyPayment(expense);
  }, 0);
}
// 一次性合计：默认计入 startDate 所在月（缺省=当前月）
function oneTimeTotal(expenses: Expense[], asOfMonth = todayMonthKey()) {
  const month = asOfMonth.slice(0, 7);
  return expenses.reduce((sum, expense) => {
    if (expense.mode !== 'one_time') return sum;
    const startMonth = monthKey(expense.startDate || defaultOneTimeDate());
    return startMonth === month ? sum + expense.amount : sum;
  }, 0);
}
function computeFinanceResult({ salary, cash, invest, returnRate, emergencyMonths, totalAssets, expenses, rentEnabled, elderlyEnabled, socialRates }: FinanceInput) {
  const base = Math.min(salary, 31000);
  const socialRows = Object.entries(socialRates).map(([name, rates]) => ({ name, personal: rates.personal, company: rates.company, personalAmount: base * rates.personal / 100, companyAmount: base * rates.company / 100 }));
  const social = socialRows.reduce((sum, row) => sum + row.personalAmount, 0);
  const deductions = [
    { name: '基本减除费用', enabled: true, standard: 5000, rate: 100 },
    { name: '住房租金', enabled: rentEnabled, standard: 1500, rate: rentEnabled ? 100 : 0 },
    { name: '赡养老人', enabled: elderlyEnabled, standard: 2000, rate: elderlyEnabled ? 100 : 0 },
  ].map((row) => ({ ...row, actual: row.standard * row.rate / 100 }));
  const taxable = Math.max(0, salary - social - deductions.reduce((sum, row) => sum + row.actual, 0));
  const tax = taxable <= 3000 ? taxable * 0.03 : taxable <= 12000 ? taxable * 0.1 - 210 : taxable <= 25000 ? taxable * 0.2 - 1410 : taxable <= 35000 ? taxable * 0.25 - 2660 : taxable <= 55000 ? taxable * 0.3 - 4410 : taxable <= 80000 ? taxable * 0.35 - 7160 : taxable * 0.45 - 15160;
  const net = salary - social - Math.max(0, tax);
  const investmentIncome = invest * returnRate / 100 / 12;
  const recurring = recurringMonthlyExpenses(expenses, net, investmentIncome);
  const oneTime = oneTimeTotal(expenses);
  // 当期月度指标：一次性像 fixed 一样计入「本月」支出
  const monthlyExpenses = recurring + oneTime;
  const committedDownPayments = expenses.filter((expense) => expense.mode === 'installment').reduce((sum, expense) => sum + (expense.downPayment || 0), 0);
  const liquidAssets = cash + invest;
  const adjustedAvailableAssets = Math.max(0, liquidAssets - committedDownPayments);
  const totalLiabilities = expenses.filter((expense) => expense.mode === 'installment').reduce((sum, expense) => sum + Math.max(0, (expense.total || 0) - (expense.downPayment || 0)), 0);
  const netWorth = totalAssets - totalLiabilities;
  const surplus = net + investmentIncome - monthlyExpenses;
  const emergency = emergencyMonths;
  const debt = expenses.filter((expense) => expense.mode === 'installment').reduce((sum, expense) => sum + installmentMonthlyPayment(expense), 0);
  // 分母=可支配收入 net（与占比图一致）；剩余 = 100 − 支出占比，超支可为负
  const { expensePct } = cashFlowRatios({ debt, otherExpenses: Math.max(0, monthlyExpenses - debt), income: net });
  const remainDisposablePct = remainDisposableSharePct(expensePct);
  return { socialRows, social, deductions, tax: Math.max(0, tax), net, investmentIncome, monthlyExpenses, recurringMonthlyExpenses: recurring, oneTimeTotal: oneTime, surplus, emergency, debt, remainDisposablePct, committedDownPayments, liquidAssets, adjustedAvailableAssets, totalLiabilities, netWorth };
}
// 年度预测：year1 结余扣一次性一次，year>=2 仅 recurring（与月度 month1 / month>=2 一致）
function forecastYearlyTotals(cash: number, invest: number, returnRate: number, reinvestRate: number, net: number, investmentIncome: number, recurringMonthly: number, oneTime: number, committedDownPayments: number) {
  const rows: Array<{ year: number; label: string; total: number }> = [];
  let cashAsset = cash;
  let investmentAsset = invest;
  for (let year = 0; year <= 30; year += 1) {
    const annualReturn = year === 0 ? 0 : investmentAsset * returnRate / 100;
    const annualSurplus = Math.max(0, (net + investmentIncome - recurringMonthly) * 12 - (year === 1 ? oneTime : 0));
    const salaryReinvestment = year === 0 ? 0 : annualSurplus * reinvestRate / 100;
    if (year > 0) {
      investmentAsset += annualReturn + salaryReinvestment;
      cashAsset += annualSurplus - salaryReinvestment;
    }
    rows.push({ year, label: forecastYearLabel(year), total: cashAsset + investmentAsset });
  }
  return rows;
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
  const [salary, setSalary] = useState(16667);
  const [cash, setCash] = useState(100000);
  const [emergencyMonths, setEmergencyMonths] = useState(0);
  const [totalAssets, setTotalAssets] = useState(500000);
  const [invest, setInvest] = useState(120000);
  const [investRatio, setInvestRatio] = useState(24);
  const [returnRate, setReturnRate] = useState(3.2);
  const [reinvestRate, setReinvestRate] = useState(30);
  const [socialRates, setSocialRates] = useState(defaultSocialRates);
  const [showAssetDetails, setShowAssetDetails] = useState(false);
  const [showSnapshotPanel, setShowSnapshotPanel] = useState(false);
  const snapshotBtnRef = useRef<HTMLButtonElement>(null);
  const assetDetailBtnRef = useRef<HTMLButtonElement>(null);
  const [visibleAssetLines, setVisibleAssetLines] = useState({ cash: true, investment: true, total: true });
  const [visibleCashFlowLines, setVisibleCashFlowLines] = useState({ dti: true, expense: true, savings: true });
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [rentEnabled, setRentEnabled] = useState(true);
  const [elderlyEnabled, setElderlyEnabled] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDate, setSnapshotDate] = useState('');
  const [snapshotSalary, setSnapshotSalary] = useState(5000);
  const [snapshotMessage, setSnapshotMessage] = useState('');
  const elderlyShare = 100;
  const setElderlyShare = (_value: number) => undefined;
  const [savedAt, setSavedAt] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [serverRevision, setServerRevision] = useState(0);
  const [retirement, setRetirement] = useState(retirementDefaults);

  const applyProfileData = (data: Record<string, unknown>) => {
      if (data.salary) setSalary(Number(data.salary)); if (data.cash !== undefined) setCash(Number(data.cash));
      if (data.emergencyMonths !== undefined) setEmergencyMonths(Number(data.emergencyMonths));
      if (data.totalAssets !== undefined) setTotalAssets(Number(data.totalAssets));
      if (data.invest !== undefined) setInvest(Number(data.invest));
      // 现金由总资产与理财推导，保证三者一致
      if (data.totalAssets !== undefined && data.invest !== undefined) {
        const total = clamp(Number(data.totalAssets), 0, 2000000);
        const investAmount = clamp(Number(data.invest), 0, total);
        setCash(total - investAmount);
        setInvestRatio(total ? investAmount / total * 100 : 0);
      } else if (data.investRatio !== undefined) setInvestRatio(Number(data.investRatio)); if (data.returnRate !== undefined) setReturnRate(Number(data.returnRate)); if (data.reinvestRate !== undefined) setReinvestRate(Number(data.reinvestRate));
      if (data.socialRates) setSocialRates({ ...defaultSocialRates, ...(data.socialRates as typeof defaultSocialRates) });
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
      if (data.snapshots) setSnapshots(data.snapshots as Snapshot[]);
      if (data.retirement) setRetirement({ ...retirementDefaults, ...(data.retirement as typeof retirementDefaults) });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 优先服务端（R2 / 本地 data/*.json），再回退 localStorage
        const response = await fetch('/api/profile');
        if (response.ok) {
          const state = await response.json();
          if (!cancelled && state?.profile && Object.keys(state.profile).length > 0) {
            applyProfileData({ ...state.profile, snapshots: state.snapshots ?? state.profile.snapshots });
            setServerRevision(Number(state.revision) || 0);
            return;
          }
        }
      } catch { /* 离线 / 首启无服务端数据 */ }
      try {
        const saved = localStorage.getItem('money-manage-profile');
        if (!cancelled && saved) applyProfileData(JSON.parse(saved));
      } catch { /* retain defaults for invalid local data */ }
      finally { if (!cancelled) setHydrated(true); }
    })().finally(() => { if (!cancelled) setHydrated(true); });
    return () => { cancelled = true; };
  }, []);

  const profile = { schemaVersion: 4, salary, cash, emergencyMonths, totalAssets, invest, investRatio, returnRate, reinvestRate, socialRates, expenses, rentEnabled, elderlyEnabled, snapshots, retirement };
  const save = () => {
    localStorage.setItem('money-manage-profile', JSON.stringify(profile));
    setSavedAt(new Date().toLocaleTimeString('zh-CN'));
  };
  // 本地即时缓存 + 防抖同步到服务端文本库（R2 / data/*.json）
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      save();
      const { snapshots: snap, ...rest } = profile;
      void fetch('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          revision: serverRevision,
          state: { profile: rest, snapshots: snap, scenarios: [] },
        }),
        keepalive: true,
      }).then(async (response) => {
        if (!response.ok) return;
        const next = await response.json();
        if (typeof next?.revision === 'number') setServerRevision(next.revision);
      }).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [hydrated, salary, cash, emergencyMonths, totalAssets, invest, investRatio, returnRate, reinvestRate, socialRates, expenses, rentEnabled, elderlyEnabled, snapshots, retirement]);
  const retirementDate = retirementDateFor(retirement.birthDate, retirement.identity);
  const updateRetirement = (patch: Partial<typeof retirement>) => setRetirement((current) => ({ ...current, ...patch }));
  // 现金 = 总资产 - 理财；改任一端同步另外两端
  const syncAssets = (nextTotal: number, nextInvest: number) => {
    const total = clamp(nextTotal, 0, 2000000);
    const investAmount = clamp(nextInvest, 0, total);
    setTotalAssets(total);
    setInvest(investAmount);
    setCash(total - investAmount);
    setInvestRatio(total ? investAmount / total * 100 : 0);
  };
  const updateTotalAssets = (value: number) => { syncAssets(value, Math.min(invest, clamp(value, 0, 2000000))); };
  const updateCash = (value: number) => { const nextCash = clamp(value, 0, totalAssets); syncAssets(totalAssets, totalAssets - nextCash); };
  const committedDownPayments = expenses.filter((expense) => expense.mode === 'installment').reduce((sum, expense) => sum + (expense.downPayment || 0), 0);
  const updateInvestByAmount = (value: number) => { const availableCap = Math.max(0, totalAssets - committedDownPayments); syncAssets(totalAssets, clamp(value, 0, availableCap)); };
  const updateInvestByRatio = (value: number) => { const ratio = clamp(value, 0, 100); const availableCap = Math.max(0, totalAssets - committedDownPayments); syncAssets(totalAssets, Math.min(availableCap, totalAssets * ratio / 100)); };

  const financeInput = useMemo(() => ({ salary, cash, invest, returnRate, emergencyMonths, totalAssets, expenses, rentEnabled, elderlyEnabled, socialRates }), [salary, cash, invest, returnRate, emergencyMonths, totalAssets, expenses, rentEnabled, elderlyEnabled, socialRates]);
  const result = useMemo(() => computeFinanceResult(financeInput), [financeInput]);

  const addExpense = () => setExpenses((items) => [...items, { id: uid(), name: '新支出', category: '其他', mode: 'fixed', amount: 1000, startDate: todayDateKey() }]);
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
  const assetForecast = useMemo(() => {
    const rows = [];
    let cashAsset = cash;
    let investmentAsset = invest;
    const recurring = result.recurringMonthlyExpenses;
    const oneTime = result.oneTimeTotal;
    for (let year = 0; year <= 30; year += 1) {
      const annualReturn = year === 0 ? 0 : investmentAsset * returnRate / 100;
      // year1 扣一次性；之后仅 recurring
      const annualSurplus = Math.max(0, (result.net + result.investmentIncome - recurring) * 12 - (year === 1 ? oneTime : 0));
      const salaryReinvestment = year === 0 ? 0 : annualSurplus * reinvestRate / 100;
      if (year > 0) {
        investmentAsset += annualReturn + salaryReinvestment;
        cashAsset += annualSurplus - salaryReinvestment;
      }
      const total = cashAsset + investmentAsset;
      const available = Math.max(0, total - result.committedDownPayments);
      rows.push({ year, label: forecastYearLabel(year), cash: cashAsset, investment: investmentAsset, annualReturn, salaryReinvestment, total, available });
    }
    return rows;
  }, [cash, invest, returnRate, reinvestRate, result.net, result.investmentIncome, result.recurringMonthlyExpenses, result.oneTimeTotal, result.committedDownPayments]);
  const monthlyAssetForecast = useMemo(() => {
    // 最终资产 = 理财资产 + 闲置资金
    // 闲置资金 = 起点现金 + Σ(剩余可支配 × (1 − 投资比例))；理财含月复利与再投资部分
    const rows = [];
    let idleFunds = cash;
    let investmentAsset = invest;
    const monthlyReturn = (1 + returnRate / 100) ** (1 / 12) - 1;
    const investRatioPct = clamp(reinvestRate, 0, 100) / 100;
    const recurring = result.recurringMonthlyExpenses;
    const oneTime = result.oneTimeTotal;
    // month1（现在→下月）含一次性；month>=2 仅 recurring
    const surplusFirst = Math.max(0, result.net + result.investmentIncome - recurring - oneTime);
    const surplusRest = Math.max(0, result.net + result.investmentIncome - recurring);
    for (let month = 0; month <= 360; month += 1) {
      if (month > 0) {
        const monthlySurplus = month === 1 ? surplusFirst : surplusRest;
        const monthlyReinvestment = monthlySurplus * investRatioPct;
        const monthlyIdle = monthlySurplus * (1 - investRatioPct);
        investmentAsset += investmentAsset * monthlyReturn + monthlyReinvestment;
        idleFunds += monthlyIdle;
      }
      const finalAssets = idleFunds + investmentAsset;
      rows.push({
        month,
        label: month === 0 ? '现在' : `${Math.floor(month / 12)}年${month % 12}个月`,
        cash: idleFunds,
        investment: investmentAsset,
        total: finalAssets,
        available: Math.max(0, finalAssets - result.committedDownPayments),
      });
    }
    return rows;
  }, [cash, invest, returnRate, reinvestRate, result.net, result.investmentIncome, result.recurringMonthlyExpenses, result.oneTimeTotal, result.committedDownPayments]);
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
    const yMaxRaw = visibleValues.length ? Math.max(...visibleValues, 0) : 0;
    const yMax = Math.max(100_000, Math.ceil(yMaxRaw / 100_000) * 100_000);
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
      grid: { left: 88, right: 28, top: 40, bottom: 96 },
      tooltip: {
        trigger: 'axis',
        textStyle: { fontSize: 14 },
        valueFormatter: (value: number) => money(Number(value)),
      },
      xAxis: {
        type: 'category', boundaryGap: false, data: labels,
        axisLabel: { color: '#334155', fontSize: 14, fontWeight: 600, interval: 11, rotate: 40, hideOverlap: true, margin: 14 },
        axisTick: { show: true, length: 8, lineStyle: { color: '#64748b', width: 2 } },
        axisLine: { lineStyle: { color: '#64748b', width: 2 } },
        name: '未来月份', nameLocation: 'middle', nameGap: 56,
        nameTextStyle: { color: '#334155', fontSize: 16, fontWeight: 600 },
      },
      yAxis: {
        type: 'value', min: 0, max: yMax, splitNumber: 5,
        name: '金额', nameTextStyle: { color: '#334155', fontSize: 16, fontWeight: 600 },
        axisLabel: { color: '#334155', fontSize: 14, fontWeight: 600, formatter: (value: number) => money(value) },
        axisTick: { show: true, length: 8, lineStyle: { color: '#64748b', width: 2 } },
        axisLine: { show: true, lineStyle: { color: '#64748b', width: 2 } },
        splitLine: { lineStyle: { color: '#cbd5e1', type: 'dashed', width: 1.5 } },
      },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', height: 18, bottom: 8, start: 0, end: 100 }],
      series,
    };
  }, [monthlyAssetForecast, visibleAssetLines]);
  const addSnapshot = () => {
    const effectiveDate = snapshotDate || today;
    const previous = [...snapshots].filter((item) => item.effectiveDate <= effectiveDate).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)).at(-1);
    const previousSalary = previous?.changes.find((change) => change.path === 'salary')?.value ?? salary;
    const risk = snapshotSalary < 10000 && result.surplus < 0;
    if (risk && !window.confirm(`该节点可能造成财务击穿（当前月度剩余 ${money(result.surplus)}）。确认后才会保存并允许击穿。`)) return;
    const id = `snapshot-${Date.now()}`;
    const change: SnapshotChange = { id: `${id}-salary`, label: '税前工资', path: 'salary', value: clamp(snapshotSalary, 0, 2000000) };
    setSnapshots((items) => [...items, { id, name: snapshotName || `${effectiveDate} 收入节点`, effectiveDate, allowNegative: risk, changes: [change] }].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)));
    setSnapshotMessage(`已对比最近节点：${money(previousSalary)} → ${money(snapshotSalary)}`);
    setSnapshotName(''); setSnapshotDate('');
  };
  const removeSnapshot = (id: string) => setSnapshots((items) => items.filter((item) => item.id !== id));
  const remainShareChartOption = useMemo(() => {
    const values = remainForecast.map((point) => point.value);
    const current = values[0] ?? 0;
    const yMin = Math.min(0, ...values, -50);
    const yMax = Math.max(100, ...values);
    return {
    animation: false,
    grid: { left: 72, right: 28, top: 40, bottom: 96 },
    tooltip: { trigger: 'axis', textStyle: { fontSize: 16 }, valueFormatter: (value: number) => `${Number(value).toFixed(1)}%` },
    xAxis: { type: 'category', boundaryGap: false, data: remainForecast.map((point) => point.label), axisLabel: { color: '#334155', fontSize: 16, fontWeight: 600, interval: 11, rotate: 40, hideOverlap: true, margin: 14 }, axisTick: { show: true, length: 8, lineStyle: { color: '#64748b', width: 2 } }, axisLine: { lineStyle: { color: '#64748b', width: 2 } }, name: '未来月份', nameLocation: 'middle', nameGap: 56, nameTextStyle: { color: '#334155', fontSize: 18, fontWeight: 600 } },
    yAxis: { type: 'value', min: Math.floor(yMin / 10) * 10, max: Math.ceil(yMax / 10) * 10, interval: 20, name: '剩余可支配 %', nameTextStyle: { color: '#334155', fontSize: 18, fontWeight: 600 }, axisLabel: { color: '#334155', fontSize: 18, fontWeight: 600, formatter: '{value}%' }, axisTick: { show: true, length: 8, lineStyle: { color: '#64748b', width: 2 } }, axisLine: { show: true, lineStyle: { color: '#64748b', width: 2 } }, splitLine: { lineStyle: { color: '#cbd5e1', type: 'dashed', width: 1.5 } } },
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
          { yAxis: 100, name: '满额 100%', lineStyle: { color: '#17212b', type: 'solid', width: 1.5 }, label: { formatter: '满额 100%', color: '#17212b', fontSize: 12, fontWeight: 600 } },
          { yAxis: 0, name: '打满 0%', lineStyle: { color: '#64748b', type: 'dashed', width: 2 }, label: { formatter: '打满 0%', color: '#334155', fontSize: 12, fontWeight: 600 } },
          { yAxis: -10, name: '警告 −10%', lineStyle: { color: '#f59e0b', type: 'dashed', width: 1 }, label: { formatter: '警告 −10%', color: '#b45309', fontSize: 11 } },
          { yAxis: -20, name: '警告 −20%', lineStyle: { color: '#f97316', type: 'dashed', width: 1 }, label: { formatter: '警告 −20%', color: '#c2410c', fontSize: 11 } },
          { yAxis: -50, name: '警告 −50%', lineStyle: { color: '#dc2626', type: 'dashed', width: 1 }, label: { formatter: '警告 −50%', color: '#b91c1c', fontSize: 11 } },
        ],
      },
    }],
  };
  }, [remainForecast]);
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
        markLine: { silent: true, data: [{ yAxis: 35, name: '建议≤35%' }], lineStyle: { color: '#f07f62', type: 'dashed', width: 1.5 }, label: { color: '#d9654a', fontSize: 12 } },
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
        markLine: { silent: true, data: [{ yAxis: 20, name: '建议≥20%' }], lineStyle: { color: '#3d8f6e', type: 'dashed', width: 1.5 }, label: { color: '#2f6f56', fontSize: 12 } },
      });
    }
    return {
      animation: false,
      grid: { left: 72, right: 28, top: 40, bottom: 96 },
      tooltip: {
        trigger: 'axis',
        textStyle: { fontSize: 14 },
        valueFormatter: (value: number) => `${Number(value).toFixed(1)}%`,
      },
      xAxis: {
        type: 'category', boundaryGap: false, data: labels,
        axisLabel: { color: '#334155', fontSize: 14, fontWeight: 600, interval: 11, rotate: 40, hideOverlap: true, margin: 14 },
        axisTick: { show: true, length: 8, lineStyle: { color: '#64748b', width: 2 } },
        axisLine: { lineStyle: { color: '#64748b', width: 2 } },
        name: '未来月份', nameLocation: 'middle', nameGap: 56,
        nameTextStyle: { color: '#334155', fontSize: 16, fontWeight: 600 },
      },
      yAxis: {
        type: 'value', min: Math.floor(yMin / 10) * 10, max: Math.ceil(yMax / 10) * 10, interval: 20,
        name: '占比 %', nameTextStyle: { color: '#334155', fontSize: 16, fontWeight: 600 },
        axisLabel: { color: '#334155', fontSize: 14, fontWeight: 600, formatter: '{value}%' },
        axisTick: { show: true, length: 8, lineStyle: { color: '#64748b', width: 2 } },
        axisLine: { show: true, lineStyle: { color: '#64748b', width: 2 } },
        splitLine: { lineStyle: { color: '#cbd5e1', type: 'dashed', width: 1.5 } },
      },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', height: 18, bottom: 8, start: 0, end: 100 }],
      series,
    };
  }, [cashFlowForecast, visibleCashFlowLines]);

  return <main className="min-h-screen bg-[#f6f8f5] text-[#17212b]">
    <header className="page-pad mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 sm:px-6 lg:px-10"><div className="flex min-w-0 items-center gap-2.5"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#17212b] text-sm font-bold text-white">M</div><div className="min-w-0"><p className="text-sm font-semibold leading-tight">财务管理</p><p className="truncate text-[11px] leading-tight text-slate-400">单人模型 · 改参即时重算</p></div></div><div className="relative flex flex-wrap items-center gap-2"><div className="flex items-center gap-2 rounded-full bg-[#17212b] px-3 py-1 text-white"><span className="text-[11px] text-slate-300">剩余可支配</span><strong className="text-base tabular-nums leading-none">{result.remainDisposablePct}<span className="text-[11px] font-normal text-slate-400">%</span></strong></div><span className="hidden rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500 sm:inline">{savedAt ? `已保存 ${savedAt}` : '双击编辑 · 自动保存'}</span><button ref={snapshotBtnRef} type="button" onClick={() => setShowSnapshotPanel((current) => !current)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#17212b] hover:border-[#f07f62] hover:text-[#d9654a]">快照设置{snapshots.length > 0 ? ` · ${snapshots.length}` : ''}</button>{showSnapshotPanel && <FloatPanel open={showSnapshotPanel} anchorRef={snapshotBtnRef} onClose={() => setShowSnapshotPanel(false)} width={720}><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">未来快照</h3><p className="mt-1 text-xs text-slate-400">保存前会确认负资产击穿</p></div><button type="button" onClick={() => setShowSnapshotPanel(false)} className="text-xs text-slate-400">关闭</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"><label className="field"><span>快照名称</span><input value={snapshotName} onChange={(event) => setSnapshotName(event.target.value)} onBlur={saveEvent} /></label><DateEditable label="生效日期" value={snapshotDate} min={today} onChange={setSnapshotDate} /><label className="field"><span>变化后税前工资</span><input type="number" min="0" max="2000000" value={snapshotSalary} onChange={(event) => setSnapshotSalary(Number(event.target.value))} /></label><button type="button" onClick={addSnapshot} className="rounded-xl bg-[#17212b] px-4 py-2.5 text-sm font-semibold text-white">保存快照</button></div>{snapshotMessage && <p className="mt-3 text-sm text-emerald-700">{snapshotMessage}</p>}{snapshots.length > 0 ? <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto">{snapshots.map((snapshot, index) => { const previous = snapshots[index - 1]; const before = previous?.changes[0]?.value ?? salary; return <div key={snapshot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm"><div><strong>{snapshot.name}</strong><span className="ml-3 text-slate-500">{snapshot.effectiveDate}</span><span className="ml-3 text-slate-600">税前工资 {money(before)} → {money(snapshot.changes[0].value)}</span>{snapshot.allowNegative && <span className="ml-3 text-amber-700">已确认允许击穿</span>}</div><button type="button" onClick={() => removeSnapshot(snapshot.id)} className="text-xs text-red-500">删除</button></div>; })}</div> : <p className="mt-4 text-sm text-slate-400">暂无快照，填写上方信息后保存。</p>}</FloatPanel>}</div></header>
    <section className="mx-auto grid max-w-[1920px] gap-2 px-6 pb-12 pt-3 lg:grid-cols-[minmax(0,1fr)_720px] lg:px-10">
      <div className="space-y-2"><section className="rounded-3xl bg-white p-6 shadow-lg"><div><SectionTitle title="财务参数" tip="按收入到卡、资产配置、结余安全垫、退休规划四组查看与调整。点击可编辑字段打开浮层；修改立即生效并自动保存。" /></div><div className="section-label">收入与到卡</div><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Editable label="税前工资" value={salary} min={0} max={100000000} step={1} onChange={setSalary} /><SocialBreakdown rows={result.socialRows} total={result.social} onHousingPersonalChange={(value) => { setSocialRates((current) => ({ ...current, 住房公积金: { ...current['住房公积金'], personal: clamp(value, 5, 12) } })); window.dispatchEvent(new Event('money-manage-save')); }} /><TaxBreakdown salary={salary} social={result.social} tax={result.tax} deductions={result.deductions} onRentChange={setRentEnabled} onElderlyChange={setElderlyEnabled} /><Breakdown label="可支配收入" value={money(result.net)} detail="税前工资 - 五险一金 - 本月预估个税" /></div><div className="section-label">资产与理财</div><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Editable label="总资产" value={totalAssets} min={0} max={2000000} step={1000} onChange={updateTotalAssets} /><Editable label="现金资产" value={cash} min={0} max={totalAssets} step={1000} onChange={updateCash} /><Editable label="理财资产" value={invest} min={0} max={totalAssets} step={1000} onChange={updateInvestByAmount} /><Editable label="理财资金占比" value={investRatio} min={0} max={100} step={1} suffix="%" onChange={updateInvestByRatio} /><Editable label="年化收益率" value={returnRate} min={0} max={100} step={0.1} suffix="%" onChange={setReturnRate} /><Editable label="工资结余再投资比例" value={reinvestRate} min={0} max={100} step={1} suffix="%" onChange={setReinvestRate} /></div><div className="section-label">结余与安全垫</div><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Editable label="应急资金月数" value={emergencyMonths} min={0} max={36} step={0.5} suffix=" 个月" onChange={setEmergencyMonths} /><Metric label="月度剩余" value={money(result.surplus)} detail="可支配收入扣除本月全部支出后的剩余金额" negative={result.surplus < 0} /><Metric label="调整后可用资产" value={money(result.adjustedAvailableAssets)} detail="已承诺首付金额已从可用资产中扣除" /></div><div className="section-label flex items-center gap-2">退休与社保<input type="checkbox" className="h-3.5 w-3.5 accent-[#f07f62]" checked={retirement.enabled} onChange={(event) => updateRetirement({ enabled: event.target.checked })} title="启用退休与社保规划" aria-label="启用退休与社保规划" /></div><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><DateEditable label="出生日期" value={retirement.birthDate} onChange={(value) => updateRetirement({ birthDate: value })} /><SelectEditable label="身份" value={retirement.identity} options={[{ value: 'male', label: '男性' }, { value: 'female-worker', label: '女性职工' }, { value: 'female-cadre', label: '女性干部' }]} onChange={(value) => updateRetirement({ identity: value })} /><DateEditable label="参保开始日期" value={retirement.insuranceStartDate} onChange={(value) => updateRetirement({ insuranceStartDate: value })} /><Editable label="计划缴费年限" value={retirement.contributionYears} min={0} max={20} step={1} suffix=" 年" onChange={(value) => updateRetirement({ contributionYears: value })} /><div className="relative block"><span className="flex items-center justify-between text-sm text-slate-600"><span>广州 2026 基数</span><span className="field-readonly">{money(retirement.base)} / 月</span></span></div><div className="relative block"><span className="flex items-center justify-between text-sm text-slate-600"><span>预计退休</span><span className="field-readonly">{retirementDate || '未设置'}</span></span></div></div></section>
      <section className="rounded-3xl bg-white p-6 shadow-lg"><div className="flex flex-wrap items-center justify-between gap-4"><SectionTitle title="支出管理" tip="操作列「分析」打开浮层；可在面板内勾选多笔支出，剩余可支配/资产曲线按勾选顺序堆叠边际影响。" /><button type="button" onClick={addExpense} className="rounded-xl bg-[#f07f62] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#df6e51]">+ 新增支出</button></div><div className="table-wrap mt-5"><table><thead><tr><th>名称</th><th>分类</th><th>类型</th><th>金额 / 月付</th><th className="cell-wrap">分期信息</th><th>操作</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}><td><ClickField display={expense.name || '未命名'} panel={<label className="block text-xs text-slate-500">名称<input className="field-input mt-1" value={expense.name} onChange={(event) => { updateExpense(expense.id, { name: event.target.value }); saveEvent(); }} /></label>} /></td><td><ClickField display={expense.category || '未分类'} panel={<label className="block text-xs text-slate-500">分类<input className="field-input mt-1" value={expense.category} onChange={(event) => { updateExpense(expense.id, { category: event.target.value }); saveEvent(); }} /></label>} /></td><td><ClickField display={formatExpenseMode(expense.mode)} panel={<label className="block text-xs text-slate-500">类型<select className="field-input mt-1" value={expense.mode} onChange={(event) => { updateExpense(expense.id, { mode: event.target.value as Expense['mode'] }); saveEvent(); }}><option value="fixed">固定金额</option><option value="percentage">按比例</option><option value="installment">分期</option><option value="one_time">一次性</option></select></label>} /></td><td><ClickField display={formatExpensePayment(expense)} panel={expense.mode === 'fixed' || expense.mode === 'one_time' ? <div className="grid gap-3">{expense.mode === 'one_time' && <label className="block text-xs text-slate-500">发生时间（默认当月）<input className="field-input mt-1" type="date" value={(expense.startDate || defaultOneTimeDate()).slice(0, 10)} onChange={(event) => { updateExpense(expense.id, { startDate: event.target.value || defaultOneTimeDate(), endDate: event.target.value || defaultOneTimeDate() }); saveEvent(); }} /></label>}<label className="block text-xs text-slate-500">{expense.mode === 'one_time' ? '金额' : '每月金额'}<input className="field-input mt-1" type="number" min="0" step="100" value={expense.amount} onChange={(event) => { updateExpense(expense.id, { amount: Number(event.target.value) }); saveEvent(); }} /></label></div> : expense.mode === 'percentage' ? <label className="block text-xs text-slate-500">收入比例（%）<input className="field-input mt-1" type="number" min="0" max="100" step="1" value={expense.rate || 0} onChange={(event) => { updateExpense(expense.id, { rate: Number(event.target.value) }); saveEvent(); }} /></label> : <p className="text-xs text-slate-500">分期月付由右侧分期信息计算得出</p>} /></td><td className="cell-wrap"><ClickField display={formatExpenseInstallment(expense)} width={360} wrap panel={expense.mode === 'installment' ? <InstallmentSettingsPanel expense={expense} onChange={(patch) => { updateExpense(expense.id, patch); saveEvent(); }} retirementDate={retirement.enabled ? retirementDate : undefined} /> : <p className="text-xs text-slate-500">仅分期类型可设置</p>} /></td><td><div className="flex items-center gap-2"><ExpenseAnalyzeButton expense={expense} financeInput={financeInput} reinvestRate={reinvestRate} retirementDate={retirement.enabled ? retirementDate : undefined} /><button type="button" onClick={() => removeExpense(expense.id)} className="text-xs text-red-500 hover:underline">删除</button></div></td></tr>)}</tbody></table></div></section></div>
      <div className="min-w-0 w-full lg:sticky lg:top-4 lg:self-start"><section className="mb-2 rounded-3xl bg-white p-6 shadow-lg"><div className="relative flex flex-wrap items-start justify-between gap-4"><SectionTitle title="资产走势" tip="最终资产 = 理财资产 + 闲置资金。闲置资金为现金存量及结余中未再投资部分（剩余可支配 × (1−投资比例) 的累积）；理财含复利与再投资。从当前资金起点按月预测。" /><button ref={assetDetailBtnRef} type="button" onClick={() => setShowAssetDetails((current) => !current)} className="text-sm font-semibold text-[#d9654a]">查看明细</button>{showAssetDetails && <FloatPanel open={showAssetDetails} anchorRef={assetDetailBtnRef} onClose={() => setShowAssetDetails(false)} width={620}><div className="flex items-center justify-between"><h3 className="font-semibold">月度资产明细</h3><button type="button" onClick={() => setShowAssetDetails(false)} className="text-xs text-slate-400">关闭</button></div><div className="table-wrap mt-4 max-h-[420px] overflow-auto"><table><thead><tr><th>月份</th><th>闲置资金</th><th>理财资产</th><th>最终资产</th><th>调整后可用资产</th></tr></thead><tbody>{monthlyAssetForecast.map((row) => <tr key={row.month}><td>{row.label}</td><td>{money(row.cash)}</td><td>{money(row.investment)}</td><td>{money(row.total)}</td><td>{money(row.available)}</td></tr>)}</tbody></table></div></FloatPanel>}</div><div className="mt-5 overflow-hidden rounded-2xl bg-slate-50 p-3"><ReactECharts option={assetChartOption} style={{ height: 400, width: "100%" }} notMerge lazyUpdate /></div><div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500"><button type="button" onClick={() => setVisibleAssetLines((current) => ({ ...current, cash: !current.cash }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleAssetLines.cash ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}><i className="h-2 w-2 rounded-full bg-slate-400" />闲置资金</button><button type="button" onClick={() => setVisibleAssetLines((current) => ({ ...current, investment: !current.investment }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleAssetLines.investment ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}><i className="h-2 w-2 rounded-full bg-[#f07f62]" />理财资产</button><button type="button" onClick={() => setVisibleAssetLines((current) => ({ ...current, total: !current.total }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleAssetLines.total ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}><i className="h-2 w-2 rounded-full bg-[#17212b]" />最终资产</button></div></section><section className="rounded-3xl bg-white p-6 shadow-lg"><div className="flex items-center justify-between"><SectionTitle title="剩余可支配收入走势" tip="从今天起模拟 30 年。口径与占比图一致：分母=可支配收入；剩余可支配占比 = 100% − 当月总支出占比（分期按真实月供，超支可为负）。" /><span className="text-sm text-slate-500">当前方案 · 360 个月</span></div><div className="mt-8 overflow-hidden rounded-2xl bg-slate-50 p-3"><ReactECharts option={remainShareChartOption} style={{ height: 400, width: "100%" }} notMerge lazyUpdate /></div><div className="mt-4 flex justify-between text-base font-semibold text-slate-600"><span>{forecastYearLabel(0)}</span><span>{forecastYearLabel(5)}</span><span>{forecastYearLabel(15)}</span><span>{forecastYearLabel(30)}</span></div></section>
        <section className="mt-2 rounded-3xl bg-white p-6 shadow-lg"><div className="flex items-center justify-between"><SectionTitle title="逐月现金流比率" tip="相对「可支配收入 + 理财月收益」：偿债比 DTI = 分期月供/收入；支出率 = 总支出/收入；储蓄率 = 结余/收入。分期按当月真实月供（等额本金递减、期满归零）。下方可勾选显示系列，交互同资产走势。" /><span className="text-sm text-slate-500">DTI · 支出 · 储蓄</span></div><div className="mt-8 overflow-hidden rounded-2xl bg-slate-50 p-3"><ReactECharts option={cashFlowChartOption} style={{ height: 400, width: "100%" }} notMerge lazyUpdate /></div><div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500"><button type="button" onClick={() => setVisibleCashFlowLines((current) => ({ ...current, dti: !current.dti }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleCashFlowLines.dti ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}><i className="h-2 w-2 rounded-full bg-[#f07f62]" />偿债比 DTI</button><button type="button" onClick={() => setVisibleCashFlowLines((current) => ({ ...current, expense: !current.expense }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleCashFlowLines.expense ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}><i className="h-2 w-2 rounded-full bg-slate-400" />支出率</button><button type="button" onClick={() => setVisibleCashFlowLines((current) => ({ ...current, savings: !current.savings }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${visibleCashFlowLines.savings ? 'bg-slate-100 font-semibold text-slate-700' : 'opacity-40'}`}><i className="h-2 w-2 rounded-full bg-[#3d8f6e]" />储蓄率</button></div><div className="mt-4 flex justify-between text-base font-semibold text-slate-600"><span>{forecastYearLabel(0)}</span><span>{forecastYearLabel(5)}</span><span>{forecastYearLabel(15)}</span><span>{forecastYearLabel(30)}</span></div></section></div></section><footer className="mx-auto max-w-[1920px] px-6 pb-8 text-xs text-slate-400 lg:px-10">原型版 · 个税和五险一金为月度估算，结果仅用于个人财务规划参考</footer>
    </main>;
}


function ExpenseAnalyzeButton({ expense, financeInput, reinvestRate, retirementDate }: { expense: Expense; financeInput: FinanceInput; reinvestRate: number; retirementDate?: string }) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([expense.id]);
  // 虚拟系列：把「剩余可支配」按 reinvestRate 拆成投资 + 可花费剩余
  const [includeInvestShare, setIncludeInvestShare] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<Expense>(expense);
  // 打开时：草稿=当前行；默认勾选当前行，可在面板内加选其他支出
  useEffect(() => {
    if (open) {
      setDraft({ ...expense, startDate: expense.startDate || (expense.mode === 'one_time' ? defaultOneTimeDate() : todayDateKey()) });
      setCompareIds([expense.id]);
    } else setSettingsOpen(false);
  }, [open, expense]);
  const patchDraft = (patch: Partial<Expense>) => setDraft((current) => {
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
  const toggleCompareId = (id: string) => {
    setCompareIds((ids) => {
      if (ids.includes(id)) {
        if (ids.length === 1) return ids; // 至少保留一项
        return ids.filter((itemId) => itemId !== id);
      }
      return [...ids, id];
    });
  };
  // 勾选集合：表内顺序；当前行若勾选则用草稿替换
  const selectedExpenses = useMemo(() => {
    const idSet = new Set(compareIds);
    return financeInput.expenses
      .filter((item) => idSet.has(item.id))
      .map((item) => (item.id === expense.id ? draft : item));
  }, [compareIds, financeInput.expenses, expense.id, draft]);
  const allExpenseIds = useMemo(() => financeInput.expenses.map((item) => item.id), [financeInput.expenses]);

  // 始终 isolated：消费前=无支出，测算=仅勾选集合
  const before = useMemo(() => computeFinanceResult({ ...financeInput, expenses: [] }), [financeInput]);
  const after = useMemo(() => computeFinanceResult({ ...financeInput, expenses: selectedExpenses }), [financeInput, selectedExpenses]);

  // KPI「30 年资产差额」仍用消费前/测算两端资产
  const assetBefore = useMemo(() => forecastYearlyTotals(financeInput.cash, financeInput.invest, financeInput.returnRate, reinvestRate, before.net, before.investmentIncome, before.recurringMonthlyExpenses, before.oneTimeTotal, before.committedDownPayments), [financeInput, reinvestRate, before]);
  const assetAfter = useMemo(() => forecastYearlyTotals(financeInput.cash, financeInput.invest, financeInput.returnRate, reinvestRate, after.net, after.investmentIncome, after.recurringMonthlyExpenses, after.oneTimeTotal, after.committedDownPayments), [financeInput, reinvestRate, after]);
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
      ? remainInvestSpendableSeries(topExpense, reinvestRate, { disposableIncome: before.net })
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
      grid: { left: 48, right: 16, top: 28, bottom: 118 },
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
  }, [selectedExpenses, financeInput, allExpenseIds, retirementDate, includeInvestShare, reinvestRate, before.net]);
  const deltaTotal30 = (assetAfter.at(-1)?.total ?? 0) - (assetBefore.at(-1)?.total ?? 0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(expense);
  const kpiCards = [
    { label: '剩余可支配占比变化', value: `${after.remainDisposablePct - before.remainDisposablePct >= 0 ? '+' : ''}${roundPct(after.remainDisposablePct - before.remainDisposablePct)}pp`, sub: `${before.remainDisposablePct}% → ${after.remainDisposablePct}%`, delta: after.remainDisposablePct - before.remainDisposablePct },
    { label: '月度剩余变化', value: `${after.surplus - before.surplus >= 0 ? '+' : ''}${money(after.surplus - before.surplus)}`, sub: `${money(before.surplus)} → ${money(after.surplus)}`, delta: after.surplus - before.surplus },
    { label: '月度支出变化', value: `${after.monthlyExpenses - before.monthlyExpenses >= 0 ? '+' : ''}${money(after.monthlyExpenses - before.monthlyExpenses)}`, sub: `${money(before.monthlyExpenses)} → ${money(after.monthlyExpenses)}`, delta: after.monthlyExpenses - before.monthlyExpenses },
    { label: '30 年资产差额', value: `${deltaTotal30 >= 0 ? '+' : ''}${money(deltaTotal30)}`, sub: '测算 − 消费前', delta: deltaTotal30 },
  ];
  return (
    <div className="relative inline-block">
      <button ref={anchorRef} type="button" onClick={() => setOpen((current) => !current)} className="text-xs font-semibold text-[#d9654a] hover:underline">分析</button>
      {open && (
        <FloatPanel open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} width={920} maxHeightVh={90} center draggable headerTitle="消费影响分析">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700">{draft.name || expense.name || '未命名'}</p>
            <p className="mt-1 text-xs text-slate-400">在下方勾选要纳入对比的支出；曲线按勾选顺序堆叠边际增量。当前行草稿不写回。</p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">ID：{expense.id}</p>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-[#f8faf9] px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700">纳入分析的支出</p>
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
                const isPrimary = item.id === expense.id;
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
                    <span>{item.name || '未命名'}{isPrimary ? '（本行）' : ''}</span>
                  </label>
                );
              })}
              <label
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${includeInvestShare ? 'bg-white font-semibold text-slate-700 shadow-sm' : 'border-slate-200 bg-white/60 text-slate-400'}`}
                style={includeInvestShare ? { borderColor: INVEST_SHARE_COLOR } : undefined}
                title="投资层 = 剩余可支配面积 × 投资比例（比例取自工资结余再投资比例）"
              >
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  style={{ accentColor: INVEST_SHARE_COLOR }}
                  checked={includeInvestShare}
                  onChange={() => setIncludeInvestShare((current) => !current)}
                />
                <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: INVEST_SHARE_COLOR, opacity: includeInvestShare ? 1 : 0.35 }} />
                <span>{INVEST_SHARE_NAME}（剩余×{clamp(reinvestRate, 0, 100)}%）</span>
              </label>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              已选 {selectedExpenses.length} 项支出入图
              {includeInvestShare ? ` · ${INVEST_SHARE_NAME}已勾选` : ''}
              {' '}· 色点与曲线/色带一一对应 · 未勾选不渲染
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {INVEST_SHARE_NAME}：在支出堆叠后的「剩余可支配」上再拆——投资层 = 剩余 × {clamp(reinvestRate, 0, 100)}%（取自「工资结余再投资比例」），其余为可花费剩余；剩余≤0 时投资为 0。
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-[#f8faf9] px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700">本行测算参数</p>
              <p className="mt-1 text-xs text-slate-500">
                {formatExpenseMode(draft.mode)} · {formatExpensePayment(draft)}
                {draft.mode === 'installment' ? ` · ${formatExpenseInstallment(draft)}` : ''}
              </p>
              {dirty && <p className="mt-1 text-[11px] font-medium text-amber-700">已相对保存值调整（未写入原数据）</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {dirty && <button type="button" onClick={() => setDraft({ ...expense })} className="text-[11px] font-semibold text-slate-500 hover:text-[#d9654a]">重置</button>}
              <button ref={settingsBtnRef} type="button" onClick={() => setSettingsOpen((current) => !current)} className="rounded-xl bg-[#17212b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2a3644]">测算设置</button>
            </div>
            {settingsOpen && (
              <FloatPanel open={settingsOpen} anchorRef={settingsBtnRef} onClose={() => setSettingsOpen(false)} width={420} maxHeightVh={80} zIndex={90}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">测算设置</h4>
                    <p className="mt-1 text-[11px] text-slate-400">仅影响本行草稿，不改已保存支出。</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">ID：{expense.id}</p>
                  </div>
                  <button type="button" onClick={() => setSettingsOpen(false)} className="text-xs text-slate-400">关闭</button>
                </div>
                <div className="mt-3 grid gap-3">
                  <label className="block text-xs text-slate-500">名称<input className="field-input mt-1" value={draft.name} onChange={(event) => patchDraft({ name: event.target.value })} /></label>
                  <label className="block text-xs text-slate-500">分类<input className="field-input mt-1" value={draft.category} onChange={(event) => patchDraft({ category: event.target.value })} /></label>
                  <label className="block text-xs text-slate-500">类型
                    <select className="field-input mt-1" value={draft.mode} onChange={(event) => patchDraft({ mode: event.target.value as Expense['mode'] })}>
                      <option value="fixed">固定金额</option>
                      <option value="percentage">按比例</option>
                      <option value="installment">分期</option>
                      <option value="one_time">一次性</option>
                    </select>
                  </label>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    <p>测算月付</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-[#c4533a]">{formatExpensePayment(draft)}</p>
                  </div>
                  {(draft.mode === 'fixed' || draft.mode === 'one_time') && (
                    <>
                      <label className="block text-xs text-slate-500">{draft.mode === 'one_time' ? '发生时间（默认当月）' : '开始时间'}<input className="field-input mt-1" type="date" value={(draft.startDate || (draft.mode === 'one_time' ? defaultOneTimeDate() : todayDateKey())).slice(0, 10)} onChange={(event) => patchDraft({ startDate: event.target.value || (draft.mode === 'one_time' ? defaultOneTimeDate() : todayDateKey()), endDate: draft.mode === 'one_time' ? (event.target.value || defaultOneTimeDate()) : draft.endDate })} /></label>
                      <label className="block text-xs text-slate-500">{draft.mode === 'one_time' ? '金额' : '每月金额'}<input className="field-input mt-1" type="number" min="0" step="100" value={draft.amount} onChange={(event) => patchDraft({ amount: Number(event.target.value) })} /></label>
                    </>
                  )}
                  {draft.mode === 'percentage' && (
                    <>
                      <label className="block text-xs text-slate-500">开始时间<input className="field-input mt-1" type="date" value={(draft.startDate || todayDateKey()).slice(0, 10)} onChange={(event) => patchDraft({ startDate: event.target.value })} /></label>
                      <label className="block text-xs text-slate-500">收入比例（%）<input className="field-input mt-1" type="number" min="0" max="100" step="1" value={draft.rate || 0} onChange={(event) => patchDraft({ rate: Number(event.target.value) })} /></label>
                    </>
                  )}
                  {draft.mode === 'installment' && (
                    <InstallmentSettingsPanel expense={draft} onChange={patchDraft} retirementDate={retirementDate} />
                  )}
                  <button type="button" onClick={() => setDraft({ ...expense })} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[#f07f62] hover:text-[#d9654a]">重置为已保存</button>
                </div>
              </FloatPanel>
            )}
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
            <p className="text-sm font-semibold">逐月支出占可支配收入</p>
            <p className="mt-1 text-xs text-slate-500">
              {includeInvestShare
                ? '先堆叠支出；剩余可支配再拆成投资占比与可花费剩余（投资 = 剩余 × 比例）。'
                : '勾选支出按时段计入占比，结余带补满至 100%。'}
            </p>
            <div className="mt-2 overflow-hidden rounded-xl bg-white p-2">
              <ReactECharts option={expenseShareOption} style={{ height: 450, width: '100%' }} notMerge lazyUpdate />
            </div>
          </div>
        </FloatPanel>
      )}
    </div>
  );
}

function FloatPanel({
  open,
  anchorRef,
  onClose,
  width = 256,
  maxHeightVh = 70,
  center = false,
  zIndex = 80,
  draggable = false,
  headerTitle,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  width?: number;
  maxHeightVh?: number;
  center?: boolean;
  zIndex?: number;
  /** 仅分析等大面板开启：标题栏可拖拽移动 */
  draggable?: boolean;
  headerTitle?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  // 用户拖过后不再被 scroll/resize 的 place 拉回
  const userDraggedRef = useRef(false);
  const dragRef = useRef<{ startX: number; startY: number; origTop: number; origLeft: number } | null>(null);

  useEffect(() => {
    if (!open) {
      userDraggedRef.current = false;
      return;
    }
    const place = () => {
      if (userDraggedRef.current) return;
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const narrow = window.innerWidth < 640;
      const maxH = window.innerHeight * (maxHeightVh / 100);
      const panelH = Math.min(panelRef.current?.offsetHeight ?? 240, maxH);
      // 窄屏几乎全宽，避免贴边裁切
      const panelW = narrow ? Math.max(280, window.innerWidth - 16) : Math.min(width, window.innerWidth - 32);
      let left: number;
      let top: number;
      if (center || narrow) {
        left = Math.max(8, (window.innerWidth - panelW) / 2);
        // 窄屏底部抽屉，大屏居中
        top = narrow
          ? Math.max(8, window.innerHeight - panelH - 8)
          : Math.max(window.innerHeight * 0.05, (window.innerHeight - panelH) / 2);
      } else {
        left = Math.min(Math.max(8, rect.left), window.innerWidth - panelW - 8);
        top = rect.bottom + 8;
        if (top + panelH > window.innerHeight - 8) top = Math.max(8, rect.top - panelH - 8);
      }
      setPos({ top, left });
    };
    place();
    const raf = window.requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.cancelAnimationFrame(raf); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, anchorRef, width, maxHeightVh, center]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      // 点击其它浮层时不关闭，支持分析面板内再开设置浮层
      if (target instanceof Element && target.closest('[data-float-panel]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, anchorRef, onClose]);

  const onHeaderMouseDown = (event: ReactMouseEvent) => {
    if (!draggable || event.button !== 0) return;
    // 关闭按钮等交互不启动拖拽
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
      setPos({ top: nextTop, left: nextLeft });
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
  const narrow = typeof window !== 'undefined' && window.innerWidth < 640;
  const maxHeight = `min(${maxHeightVh}vh, ${maxHeightVh === 90 ? '90vh' : '42rem'})`;
  const panelWidth = typeof window !== 'undefined'
    ? (narrow ? Math.max(280, window.innerWidth - 16) : Math.min(width, window.innerWidth - 32))
    : width;
  const showHeader = draggable || Boolean(headerTitle);
  return createPortal(
    <div
      ref={panelRef}
      data-float-panel
      role="dialog"
      className={`fixed flex flex-col overscroll-contain border border-slate-200 bg-white shadow-xl ${narrow ? 'rounded-t-2xl rounded-b-none' : 'rounded-2xl'} ${showHeader ? 'overflow-hidden' : 'overflow-x-auto overflow-y-auto p-4'}`}
      style={{
        top: pos.top,
        left: pos.left,
        zIndex,
        width: panelWidth,
        maxHeight: typeof window !== 'undefined' ? `${maxHeightVh}vh` : maxHeight,
      }}
    >
      {showHeader && (
        <div
          onMouseDown={onHeaderMouseDown}
          className={`flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 ${draggable ? 'cursor-move select-none' : ''}`}
          title={draggable ? '按住拖动面板' : undefined}
        >
          <h3 className="min-w-0 truncate text-base font-semibold text-slate-800">{headerTitle || '面板'}</h3>
          <button type="button" onClick={onClose} className="shrink-0 text-xs text-slate-400 hover:text-slate-600">关闭</button>
        </div>
      )}
      <div className={`min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain ${showHeader ? 'p-4' : ''}`}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
function Editable({ label, value, min, max, step, suffix = '', onChange }: EditableProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { if (!open) setDraft(String(Number.isInteger(value) ? value : value.toFixed(1))); }, [value, open]);
  const position = max === min ? 0 : Math.round((value - min) / (max - min) * 100);
  const commit = (nextValue = Number(draft)) => { const next = clamp(nextValue, min, max); setDraft(String(next)); onChange(next); window.dispatchEvent(new Event('money-manage-save')); };
  const display = `${Number.isInteger(value) ? value.toLocaleString('zh-CN') : value.toFixed(1)}${suffix}`;
  return <div className="relative block"><span className="flex items-center justify-between text-sm text-slate-600"><span>{label}</span><button ref={anchorRef} type="button" onClick={() => { setDraft(String(value)); setOpen((current) => !current); }} onDoubleClick={() => { setDraft(String(value)); setOpen(true); }} title="点击或双击数字打开编辑浮层" className="field-click">{display}</button></span><FloatPanel open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} width={280}><div className="flex items-center justify-between gap-3"><label className="flex-1 text-xs text-slate-500">精确值<input autoFocus type="number" min={min} max={max} step={step} value={draft} onChange={(event) => { const next = event.target.value; setDraft(next); const num = Number(next); if (Number.isFinite(num)) commit(num); }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }} className="field-input mt-1" /></label><span className="pt-5 font-mono text-sm text-slate-500">{suffix}</span></div><div className="mt-3 flex items-center gap-2"><input aria-label={`${label}百分比位置`} className="money-slider" type="range" min="0" max="100" step="1" value={position} onChange={(event) => commit(min + (max - min) * Number(event.target.value) / 100)} /><span className="w-12 text-right text-xs text-slate-500">{position}%</span></div></FloatPanel></div>;
}
function DateEditable({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return <div className="relative block"><span className="flex items-center justify-between text-sm text-slate-600"><span>{label}</span><button ref={anchorRef} type="button" onClick={() => setOpen((current) => !current)} onDoubleClick={() => setOpen(true)} title="点击或双击打开编辑浮层" className="field-click">{value || '未设置'}</button></span><FloatPanel open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} width={280}><label className="block text-xs text-slate-500">选择日期<input autoFocus type="date" min={min} value={value} onChange={(event) => { onChange(event.target.value); window.dispatchEvent(new Event('money-manage-save')); }} className="field-input mt-2" /></label></FloatPanel></div>;
}
function SelectEditable({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const display = options.find((item) => item.value === value)?.label ?? value;
  return <div className="relative block"><span className="flex items-center justify-between text-sm text-slate-600"><span>{label}</span><button ref={anchorRef} type="button" onClick={() => setOpen((current) => !current)} onDoubleClick={() => setOpen(true)} title="点击或双击打开编辑浮层" className="field-click">{display}</button></span><FloatPanel open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} width={280}><label className="block text-xs text-slate-500">选择<select autoFocus value={value} onChange={(event) => { onChange(event.target.value); window.dispatchEvent(new Event('money-manage-save')); }} className="field-input mt-1">{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></FloatPanel></div>;
}
const saveEvent = () => window.dispatchEvent(new Event('money-manage-save'));

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
  return <div className="space-y-3">
    <label className="block text-xs text-slate-500">还款方式<select className="field-input mt-1" value={mode} onChange={(event) => onChange({ repaymentMode: event.target.value as RepaymentMode })}><option value="equal_principal_interest">等额本息（每月固定）</option><option value="equal_principal">等额本金（首月最高，逐月递减）</option></select></label>
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-500">{mode === 'equal_principal' ? '预估首月月供' : '预估月供'}</span><strong className="ml-2 tabular-nums text-[#17212b]">{money(monthly)}</strong><span className="ml-1 text-xs text-slate-400">（计入分期月供 / 剩余可支配占比）</span></div>
    <label className="block text-xs text-slate-500">开始时间（默认当月）<input className="field-input mt-1" type="date" value={startDate.slice(0, 10)} onChange={(event) => patchStart(event.target.value)} /></label>
    <label className="flex items-center gap-2 text-xs text-slate-600">
      <input type="checkbox" className="h-3.5 w-3.5 accent-[#f07f62]" checked={followRetirement} onChange={(event) => patchFollowRetirement(event.target.checked)} />
      须在退休前还清（自动截断最长还款期）
    </label>
    {followRetirement && (
      <p className="text-[11px] text-slate-500">
        退休日 {retirementDate || '未设置'} · 有效期数 {term} · 预计还清 {span.end}
      </p>
    )}
    <label className="block text-xs text-slate-500">总价<input className="field-input mt-1" type="number" min="0" step="1000" value={total} onChange={(event) => patchTotal(Number(event.target.value))} /></label>
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-xs text-slate-500">首付金额<input className="field-input mt-1" type="number" min="0" step="1000" value={down} onChange={(event) => patchDownAmount(Number(event.target.value))} /></label>
      <label className="block text-xs text-slate-500">首付比例（%）<input className="field-input mt-1" type="number" min="0" max="100" step="0.1" value={downPercent} onChange={(event) => patchDownPercent(Number(event.target.value))} /></label>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-xs text-slate-500">年数<input className="field-input mt-1" type="number" min="0.1" max="30" step="0.1" value={years} onChange={(event) => patchTermYears(Number(event.target.value))} /></label>
      <label className="block text-xs text-slate-500">期数（月）<input className="field-input mt-1" type="number" min="1" max="360" step="1" value={term} onChange={(event) => patchTermMonths(Number(event.target.value))} /></label>
    </div>
    <p className="text-[11px] text-slate-500">年数与期数等价：1 年 = 12 期；贷款计算一律用月数。</p>
    <label className="block text-xs text-slate-500">年化利率（%）<input className="field-input mt-1" type="number" min="0" max="100" step="0.1" value={expense.interest || 0} onChange={(event) => onChange({ interest: clamp(Number(event.target.value), 0, 100) })} /></label>
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600 space-y-1.5">
      <div className="font-medium text-slate-700">计算公式</div>
      <p className="leading-relaxed">{explanation.formula}</p>
      <div className="font-medium text-slate-700 pt-1">计算过程</div>
      <ol className="list-decimal pl-4 space-y-0.5 leading-relaxed tabular-nums">
        {explanation.steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
    </div>
  </div>;
}
function ClickField({ display, panel, width = 280, wrap = false }: { display: string; panel: ReactNode; width?: number; wrap?: boolean }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return <div className="relative inline-block max-w-full"><button ref={anchorRef} type="button" onClick={() => setOpen((current) => !current)} onDoubleClick={() => setOpen(true)} title="点击打开编辑浮层" className={`field-click max-w-full text-left ${wrap ? 'field-click-wrap' : 'truncate'}`}>{display}</button><FloatPanel open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} width={width}>{panel}</FloatPanel></div>;
}

function Metric({ label, value, detail, negative = false }: { label: string; value: string; detail: string; negative?: boolean }) { return <div className="relative block"><span className="flex items-center justify-between text-sm text-slate-600"><span className="flex items-center gap-1">{label}<InfoTip>{detail}</InfoTip></span><span className={`field-readonly ${negative ? 'text-red-500' : ''}`}>{value}</span></span></div>; }
function Breakdown({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="relative block"><span className="flex items-center justify-between text-sm text-slate-600"><span className="flex items-center gap-1">{label}<InfoTip>{detail}</InfoTip></span><span className="field-readonly">{value}</span></span></div>; }
function SocialBreakdown({ rows, total, onHousingPersonalChange }: { rows: Array<{ name: string; personal: number; personalAmount: number; company: number; companyAmount: number }>; total: number; onHousingPersonalChange: (value: number) => void }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const housingPersonal = rows.find((row) => row.name === '住房公积金')?.personal ?? 5;
  const [housingDraft, setHousingDraft] = useState(String(housingPersonal));
  useEffect(() => { setHousingDraft(String(housingPersonal)); }, [housingPersonal]);
  const commitHousing = (raw: string) => {
    const next = clamp(Number(raw), 5, 12);
    setHousingDraft(String(next));
    onHousingPersonalChange(next);
  };
  return <div className="relative block"><span className="flex items-center justify-between text-sm text-slate-600"><span className="flex items-center gap-1">个人五险一金<InfoTip>个人承担的养老、医疗、失业、工伤、生育和住房公积金缴纳金额。住房公积金个人比例可在明细中按 5%–12% 调整。</InfoTip></span><button ref={anchorRef} type="button" onClick={() => setOpen((current) => !current)} onDoubleClick={() => setOpen(true)} title="点击查看明细" className="field-click">-{money(total)}</button></span><FloatPanel open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} width={620}><div className="flex items-center justify-between"><h3 className="font-semibold">五险一金缴纳明细</h3><button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400">关闭</button></div><div className="table-wrap mt-4"><table><thead><tr><th>项目</th><th>个人比例</th><th>个人金额</th><th>企业比例</th><th>企业金额</th></tr></thead><tbody>{rows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.name === '住房公积金' ? <label className="inline-flex items-center gap-1"><input className="field-input w-20" type="number" min={5} max={12} step={0.1} value={housingDraft} onChange={(event) => { const raw = event.target.value; setHousingDraft(raw); const num = Number(raw); if (Number.isFinite(num) && num >= 5 && num <= 12) onHousingPersonalChange(num); }} onBlur={() => commitHousing(housingDraft)} /><span>%</span><span className="text-[10px] text-slate-400">5–12</span></label> : `${row.personal}%`}</td><td>{money(row.personalAmount)}</td><td>{row.company}%</td><td>{money(row.companyAmount)}</td></tr>)}</tbody></table></div><div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold"><span>个人缴纳合计</span><span>-{money(total)}</span></div></FloatPanel></div>;
}

function TaxBreakdown({ salary, social, tax, deductions, onRentChange, onElderlyChange }: { salary: number; social: number; tax: number; deductions: Array<{ name: string; standard: number; actual: number; enabled: boolean }>; onRentChange: (value: boolean) => void; onElderlyChange: (value: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const taxable = Math.max(0, salary - social - deductions.reduce((sum, row) => sum + row.actual, 0));
  const bracket = taxable <= 3000 ? taxBrackets[0] : taxable <= 12000 ? taxBrackets[1] : taxable <= 25000 ? taxBrackets[2] : taxBrackets[3];
  return <div className="relative block"><span className="flex items-center justify-between text-sm text-slate-600"><span className="flex items-center gap-1">本月预估个税<InfoTip>根据当前税前工资、个人五险一金和已勾选专项附加扣除估算的本月个税。</InfoTip></span><button ref={anchorRef} type="button" onClick={() => setOpen((current) => !current)} onDoubleClick={() => setOpen(true)} title="点击查看明细" className="field-click">-{money(tax)}</button></span><FloatPanel open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} width={620}><div className="flex items-center justify-between"><h3 className="font-semibold">本月个税估算明细</h3><button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400">关闭</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm"><span className="flex items-center gap-2"><input type="checkbox" checked={deductions.find((row) => row.name === "住房租金")?.enabled ?? false} onChange={(event) => onRentChange(event.target.checked)} />住房租金</span><span className="mt-2 block text-xs text-slate-500">政策标准 {money(deductions.find((row) => row.name === "住房租金")?.standard ?? 0)} / 月</span></label><label className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm"><span className="flex items-center gap-2"><input type="checkbox" checked={deductions.find((row) => row.name === "赡养老人")?.enabled ?? false} onChange={(event) => onElderlyChange(event.target.checked)} />赡养老人</span><span className="mt-2 block text-xs text-slate-500">政策标准 {money(deductions.find((row) => row.name === "赡养老人")?.standard ?? 0)} / 月</span></label></div><div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span>税前工资</span><strong>{money(salary)}</strong></div><div className="flex justify-between"><span>个人五险一金</span><strong>-{money(social)}</strong></div>{deductions.map((row) => <div key={row.name} className="flex justify-between"><span>{row.name}</span><strong>-{money(row.actual)}</strong></div>)}<div className="flex justify-between border-t border-slate-100 pt-2"><span>应纳税所得额</span><strong>{money(taxable)}</strong></div><div className="flex justify-between"><span>当前区间：税率 / 速算扣除数</span><strong>{bracket.rate}% / {money(bracket.quick)}</strong></div><div className="flex justify-between border-t border-slate-100 pt-2 font-semibold"><span>本月预估个税</span><strong className="text-red-500">-{money(tax)}</strong></div></div><div className="mt-5"><h4 className="text-sm font-semibold">不同区间纳税明细</h4><div className="table-wrap mt-2"><table><thead><tr><th>月应纳税所得额</th><th>税率</th><th>速算扣除数</th><th>当前状态</th></tr></thead><tbody>{taxBrackets.map((item) => <tr key={item.range} className={item.range === bracket.range ? 'bg-emerald-50 font-semibold' : ''}><td>{item.range}</td><td>{item.rate}%</td><td>{money(item.quick)}</td><td>{item.range === bracket.range ? '当前区间' : '可选区间'}</td></tr>)}</tbody></table></div></div></FloatPanel></div>;
}
