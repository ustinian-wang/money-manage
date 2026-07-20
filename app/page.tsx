'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import ReactECharts from 'echarts-for-react';

type Expense = { id: string; name: string; category: string; mode: 'fixed' | 'percentage' | 'installment'; amount: number; rate?: number; total?: number; downPayment?: number; term?: number; interest?: number; startDate?: string; endDate?: string; followRetirement?: boolean };
type SnapshotChange = { id: string; label: string; path: 'salary' | 'cash' | 'returnRate'; value: number };
type Snapshot = { id: string; name: string; effectiveDate: string; changes: SnapshotChange[]; allowNegative: boolean };
type EditableProps = { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void };
type SocialRate = { personal: number; company: number };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const money = (value: number) => `¥${Math.round(value).toLocaleString('zh-CN')}`;
const uid = () => `expense-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const initialExpenses: Expense[] = [
  { id: 'parent-support', name: '上交父母', category: '家庭支持', mode: 'fixed', amount: 3000 },
  { id: 'daily-life', name: '日常生活', category: '生活', mode: 'fixed', amount: 4200 },
  { id: 'car-installment', name: '车辆分期', category: '交通', mode: 'installment', amount: 0, total: 150000, downPayment: 45000, term: 36, interest: 4.2 },
];
const retirementDefaults = { enabled: false, birthDate: '1996-01-01', identity: 'male', insuranceStartDate: '2016-01-01', contributionYears: 20, base: 7380 };
const monthKey = (date: string) => date ? date.slice(0, 7) : '';
const addMonths = (date: string, months: number) => { const next = new Date(`${date || new Date().toISOString().slice(0, 10)}T00:00:00`); next.setMonth(next.getMonth() + months); return next.toISOString().slice(0, 10); };
const retirementDateFor = (birthDate: string, identity: string) => { const birth = new Date(`${birthDate}T00:00:00`); if (Number.isNaN(birth.getTime())) return ''; const age = identity === 'female-worker' ? 55 : identity === 'female-cadre' ? 58 : 63; birth.setFullYear(birth.getFullYear() + age); return birth.toISOString().slice(0, 10); };
const defaultSocialRates: Record<string, SocialRate> = { 养老保险: { personal: 8, company: 16 }, 医疗保险: { personal: 2, company: 6 }, 失业保险: { personal: 0.5, company: 0.5 }, 工伤保险: { personal: 0, company: 0.4 }, 生育保险: { personal: 0, company: 0.8 }, 住房公积金: { personal: 5, company: 5 } };
const taxBrackets = [{ range: '不超过 3,000', rate: 3, quick: 0 }, { range: '3,000 - 12,000', rate: 10, quick: 210 }, { range: '12,000 - 25,000', rate: 20, quick: 1410 }, { range: '25,000 - 35,000', rate: 25, quick: 2660 }, { range: '35,000 - 55,000', rate: 30, quick: 4410 }, { range: '55,000 - 80,000', rate: 35, quick: 7160 }, { range: '超过 80,000', rate: 45, quick: 15160 }];
const InfoTip = ({ children }: { children: ReactNode }) => <span className="group relative inline-flex align-middle"><button type="button" aria-label="查看说明" className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-xs font-semibold text-slate-500 hover:border-[#f07f62] hover:text-[#d9654a]">i</button><span role="tooltip" className="pointer-events-none invisible absolute left-1/2 top-full z-[60] mt-2 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl bg-[#17212b] p-3 text-left text-xs font-normal leading-5 text-white opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">{children}</span></span>;
const SectionTitle = ({ eyebrow, title, tip, compact = false }: { eyebrow?: string; title: string; tip?: ReactNode; compact?: boolean }) => <div className="flex min-w-0 items-center gap-2">{eyebrow && <p className="eyebrow shrink-0">{eyebrow}</p>}<h2 className={`${compact ? 'text-lg' : 'text-2xl'} min-w-0 font-semibold`}>{title}</h2>{tip && <InfoTip>{tip}</InfoTip>}</div>;

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
  const [retirement, setRetirement] = useState(retirementDefaults);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('money-manage-profile');
      if (!saved) return;
      const data = JSON.parse(saved);
      if (data.salary) setSalary(data.salary); if (data.cash !== undefined) setCash(data.cash);
      if (data.emergencyMonths !== undefined) setEmergencyMonths(data.emergencyMonths);
      if (data.totalAssets !== undefined) setTotalAssets(data.totalAssets);
      if (data.invest !== undefined) setInvest(data.invest);
      // 现金由总资产与理财推导，保证三者一致
      if (data.totalAssets !== undefined && data.invest !== undefined) {
        const total = clamp(Number(data.totalAssets), 0, 2000000);
        const investAmount = clamp(Number(data.invest), 0, total);
        setCash(total - investAmount);
        setInvestRatio(total ? investAmount / total * 100 : 0);
      } else if (data.investRatio !== undefined) setInvestRatio(data.investRatio); if (data.returnRate !== undefined) setReturnRate(data.returnRate); if (data.reinvestRate !== undefined) setReinvestRate(data.reinvestRate);
      if (data.socialRates) setSocialRates({ ...defaultSocialRates, ...data.socialRates });
      if (data.expenses) setExpenses(data.expenses); if (data.rentEnabled !== undefined) setRentEnabled(data.rentEnabled);
      if (data.elderlyEnabled !== undefined) setElderlyEnabled(data.elderlyEnabled);
      if (data.snapshots) setSnapshots(data.snapshots);
      if (data.retirement) setRetirement({ ...retirementDefaults, ...data.retirement });
    } catch { /* retain defaults for invalid local data */ } finally { setHydrated(true); }
  }, []);

  const profile = { schemaVersion: 4, salary, cash, emergencyMonths, totalAssets, invest, investRatio, returnRate, reinvestRate, socialRates, expenses, rentEnabled, elderlyEnabled, snapshots, retirement };
  const save = () => { localStorage.setItem('money-manage-profile', JSON.stringify(profile)); setSavedAt(new Date().toLocaleTimeString('zh-CN')); };
  useEffect(() => { if (!hydrated) return; const timer = window.setTimeout(save, 120); return () => window.clearTimeout(timer); }, [hydrated, salary, cash, emergencyMonths, totalAssets, invest, investRatio, returnRate, reinvestRate, socialRates, expenses, rentEnabled, elderlyEnabled, snapshots, retirement]);
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

  const result = useMemo(() => {
    const base = Math.min(salary, 31000);
    const socialRows = [
      ...Object.entries(socialRates).map(([name, rates]) => [name, rates.personal, rates.company] as [string, number, number]),
    ].map(([name, personal, company]) => ({ name: String(name), personal: Number(personal), company: Number(company), personalAmount: base * Number(personal) / 100, companyAmount: base * Number(company) / 100 }));
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
    const monthlyExpenses = expenses.reduce((sum, expense) => {
      if (expense.mode === 'fixed') return sum + expense.amount;
      if (expense.mode === 'percentage') return sum + (net + investmentIncome) * (expense.rate || 0) / 100;
      const principal = Math.max(0, (expense.total || 0) - (expense.downPayment || 0)); const rate = (expense.interest || 0) / 1200; const maxByDate = expense.endDate && expense.startDate ? Math.max(1, Math.round((new Date(`${expense.endDate}T00:00:00`).getTime() - new Date(`${expense.startDate}T00:00:00`).getTime()) / (30.4375 * 86400000)) + 1) : 360; const months = Math.min(expense.term || 1, maxByDate);
      return sum + (rate ? principal * rate * (1 + rate) ** months / ((1 + rate) ** months - 1) : principal / months);
    }, 0);
    const committedDownPayments = expenses.filter((expense) => expense.mode === 'installment').reduce((sum, expense) => sum + (expense.downPayment || 0), 0);
    const liquidAssets = cash + invest;
    const adjustedAvailableAssets = Math.max(0, liquidAssets - committedDownPayments);
    const totalLiabilities = expenses.filter((expense) => expense.mode === 'installment').reduce((sum, expense) => sum + Math.max(0, (expense.total || 0) - (expense.downPayment || 0)), 0);
    const netWorth = totalAssets - totalLiabilities;
    const surplus = net + investmentIncome - monthlyExpenses;
    const emergency = emergencyMonths;
    const debt = expenses.filter((expense) => expense.mode === 'installment').reduce((sum, expense) => {
      const principal = Math.max(0, (expense.total || 0) - (expense.downPayment || 0)); const rate = (expense.interest || 0) / 1200; const months = expense.term || 1;
      return sum + (rate ? principal * rate * (1 + rate) ** months / ((1 + rate) ** months - 1) : principal / months);
    }, 0);
    const health = clamp(Math.round(92 - debt / Math.max(1, net + investmentIncome) * 105 - Math.max(0, 4 - emergency) * 5), 0, 100);
    return { socialRows, social, deductions, tax: Math.max(0, tax), net, investmentIncome, monthlyExpenses, surplus, emergency, debt, health, committedDownPayments, liquidAssets, adjustedAvailableAssets, totalLiabilities, netWorth };
  }, [salary, cash, emergencyMonths, invest, returnRate, expenses, rentEnabled, elderlyEnabled, totalAssets, socialRates]);

  const updateExpense = (id: string, patch: Partial<Expense>) => setExpenses((items) => items.map((item) => {
    if (item.id !== id) return item;
    const next = { ...item, ...patch };
    if (next.mode === 'installment' && next.endDate && next.startDate) next.term = Math.min(next.term || 1, Math.max(1, Math.round((new Date(`${next.endDate}T00:00:00`).getTime() - new Date(`${next.startDate}T00:00:00`).getTime()) / (30.4375 * 86400000)) + 1));
    return next;
  }));
  const addExpense = () => setExpenses((items) => [...items, { id: uid(), name: '新支出', category: '其他', mode: 'fixed', amount: 1000 }]);
  const removeExpense = (id: string) => setExpenses((items) => items.filter((item) => item.id !== id));
  const status = result.health >= 75 ? '可以考虑' : result.health >= 55 ? '谨慎评估' : '不建议';
  const today = new Date().toISOString().slice(0, 10);
  const forecast = useMemo(() => Array.from({ length: 360 }, (_, index) => {
    const date = new Date(); date.setMonth(date.getMonth() + index);
    const dateKey = date.toISOString().slice(0, 10);
    const active = [...snapshots].filter((item) => item.effectiveDate <= dateKey).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)).at(-1);
    const nextSalary = active?.changes.find((change) => change.path === 'salary')?.value ?? salary;
    const nextCash = active?.changes.find((change) => change.path === 'cash')?.value ?? cash;
    const nextReturn = active?.changes.find((change) => change.path === 'returnRate')?.value ?? returnRate;
    return { dateKey, label: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, value: clamp(result.health + ((nextSalary / Math.max(1, salary)) - 1) * 18 + (nextCash - cash) / 100000, 0, 100), nextReturn };
  }), [snapshots, salary, cash, returnRate, result.health]);
  const assetForecast = useMemo(() => {
    const rows = [];
    let cashAsset = cash;
    let investmentAsset = invest;
    const monthlyLiving = result.monthlyExpenses;
    for (let year = 0; year <= 30; year += 1) {
      const annualReturn = year === 0 ? 0 : investmentAsset * returnRate / 100;
      const annualSurplus = Math.max(0, (result.net + result.investmentIncome - monthlyLiving) * 12);
      const salaryReinvestment = year === 0 ? 0 : annualSurplus * reinvestRate / 100;
      if (year > 0) {
        investmentAsset += annualReturn + salaryReinvestment;
        cashAsset += annualSurplus - salaryReinvestment;
      }
      const total = cashAsset + investmentAsset;
      const available = Math.max(0, total - result.committedDownPayments);
      rows.push({ year, label: year === 0 ? '现在' : `${year} 年`, cash: cashAsset, investment: investmentAsset, annualReturn, salaryReinvestment, total, available });
    }
    return rows;
  }, [cash, invest, returnRate, reinvestRate, result.net, result.investmentIncome, result.monthlyExpenses, result.committedDownPayments]);
  const monthlyAssetForecast = useMemo(() => {
    const rows = [];
    let cashAsset = cash;
    let investmentAsset = invest;
    const monthlyReturn = (1 + returnRate / 100) ** (1 / 12) - 1;
    const monthlySurplus = Math.max(0, result.net + result.investmentIncome - result.monthlyExpenses);
    const monthlyReinvestment = monthlySurplus * reinvestRate / 100;
    for (let month = 0; month <= 360; month += 1) {
      if (month > 0) {
        investmentAsset += investmentAsset * monthlyReturn + monthlyReinvestment;
        cashAsset += monthlySurplus - monthlyReinvestment;
      }
      const total = cashAsset + investmentAsset;
      rows.push({ month, label: month === 0 ? '现在' : `${Math.floor(month / 12)}年${month % 12}个月`, cash: cashAsset, investment: investmentAsset, total, available: Math.max(0, total - result.committedDownPayments) });
    }
    return rows;
  }, [cash, invest, returnRate, reinvestRate, result.net, result.investmentIncome, result.monthlyExpenses, result.committedDownPayments]);
  const assetChart = useMemo(() => {
    const width = 960; const height = 300;
    const padL = 210; const padR = 20; const padT = 32; const padB = 52;
    const max = 10_000_000; // 纵轴固定 0–1000 万
    const x = (month: number) => padL + month / 360 * (width - padL - padR);
    const y = (value: number) => padT + (1 - Math.min(Math.max(value, 0), max) / max) * (height - padT - padB);
    const path = (key: 'cash' | 'investment' | 'total') => monthlyAssetForecast.map((row, index) => `${index === 0 ? 'M' : 'L'}${x(row.month).toFixed(1)},${y(row[key]).toFixed(1)}`).join(' ');
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({ ratio, value: max * ratio, y: y(max * ratio) }));
    return { width, height, padL, padR, padT, padB, plotRight: width - padR, plotMid: padL + (width - padL - padR) / 2, max, ticks, paths: { cash: path('cash'), investment: path('investment'), total: path('total') } };
  }, [monthlyAssetForecast]);
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
  const healthChartOption = useMemo(() => {
    const scores = forecast.map((point) => Math.round(point.value));
    const currentScore = scores[0] ?? 0;
    return {
    animation: false,
    grid: { left: 72, right: 28, top: 40, bottom: 96 },
    tooltip: { trigger: 'axis', textStyle: { fontSize: 16 }, valueFormatter: (value: number) => `${Math.round(Number(value))} 分` },
    xAxis: { type: 'category', boundaryGap: false, data: forecast.map((point) => point.label), axisLabel: { color: '#334155', fontSize: 16, fontWeight: 600, interval: 11, rotate: 40, hideOverlap: true, margin: 14 }, axisTick: { show: true, length: 8, lineStyle: { color: '#64748b', width: 2 } }, axisLine: { lineStyle: { color: '#64748b', width: 2 } }, name: '未来月份', nameLocation: 'middle', nameGap: 56, nameTextStyle: { color: '#334155', fontSize: 18, fontWeight: 600 } },
    yAxis: { type: 'value', min: 0, max: 100, interval: 20, name: '健康分', nameTextStyle: { color: '#334155', fontSize: 18, fontWeight: 600 }, axisLabel: { color: '#334155', fontSize: 18, fontWeight: 600 }, axisTick: { show: true, length: 8, lineStyle: { color: '#64748b', width: 2 } }, axisLine: { show: true, lineStyle: { color: '#64748b', width: 2 } }, splitLine: { lineStyle: { color: '#cbd5e1', type: 'dashed', width: 1.5 } } },
    dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', height: 18, bottom: 8, start: 0, end: 100 }],
    series: [{ name: '财务健康分', type: 'line', smooth: true, symbol: 'none', data: scores, lineStyle: { color: '#f07f62', width: 3 }, areaStyle: { color: 'rgba(240,127,98,0.12)' }, markPoint: { symbol: 'pin', symbolSize: 52, data: [{ name: '当前', coord: [forecast[0]?.label, currentScore], value: currentScore }], label: { show: true, formatter: '{c} 分', color: '#fff', fontSize: 13, fontWeight: 700 }, itemStyle: { color: '#f07f62', borderColor: '#fff', borderWidth: 1 } }, markLine: { silent: true, data: [{ yAxis: 75, name: '安全线' }, { yAxis: 55, name: '警戒线' }], lineStyle: { color: '#64748b', type: 'dashed', width: 2 }, label: { color: '#334155', fontSize: 14, fontWeight: 600 } } }]
  };
  }, [forecast]);

  return <main className="min-h-screen bg-[#f6f8f5] text-[#17212b]">
    <header className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-6 py-2 lg:px-10"><div className="flex min-w-0 items-center gap-2.5"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#17212b] text-sm font-bold text-white">M</div><div className="min-w-0"><p className="text-sm font-semibold leading-tight">财务管理</p><p className="truncate text-[11px] leading-tight text-slate-400">单人模型 · 改参即时重算</p></div></div><div className="relative flex flex-wrap items-center gap-2"><div className="flex items-center gap-2 rounded-full bg-[#17212b] px-3 py-1 text-white"><span className="text-[11px] text-slate-300">健康分</span><strong className="text-base tabular-nums leading-none">{result.health}<span className="text-[11px] font-normal text-slate-400"> / 100</span></strong><span className="text-[11px] text-emerald-300">{status}</span></div><span className="hidden rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500 sm:inline">{savedAt ? `已保存 ${savedAt}` : '双击编辑 · 自动保存'}</span><button ref={snapshotBtnRef} type="button" onClick={() => setShowSnapshotPanel((current) => !current)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#17212b] hover:border-[#f07f62] hover:text-[#d9654a]">快照设置{snapshots.length > 0 ? ` · ${snapshots.length}` : ''}</button>{showSnapshotPanel && <FloatPanel open={showSnapshotPanel} anchorRef={snapshotBtnRef} onClose={() => setShowSnapshotPanel(false)} width={720}><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">未来快照</h3><p className="mt-1 text-xs text-slate-400">保存前会确认负资产击穿</p></div><button type="button" onClick={() => setShowSnapshotPanel(false)} className="text-xs text-slate-400">关闭</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"><label className="field"><span>快照名称</span><input value={snapshotName} onChange={(event) => setSnapshotName(event.target.value)} onBlur={saveEvent} /></label><DateEditable label="生效日期" value={snapshotDate} min={today} onChange={setSnapshotDate} /><label className="field"><span>变化后税前工资</span><input type="number" min="0" max="2000000" value={snapshotSalary} onChange={(event) => setSnapshotSalary(Number(event.target.value))} /></label><button type="button" onClick={addSnapshot} className="rounded-xl bg-[#17212b] px-4 py-2.5 text-sm font-semibold text-white">保存快照</button></div>{snapshotMessage && <p className="mt-3 text-sm text-emerald-700">{snapshotMessage}</p>}{snapshots.length > 0 ? <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto">{snapshots.map((snapshot, index) => { const previous = snapshots[index - 1]; const before = previous?.changes[0]?.value ?? salary; return <div key={snapshot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm"><div><strong>{snapshot.name}</strong><span className="ml-3 text-slate-500">{snapshot.effectiveDate}</span><span className="ml-3 text-slate-600">税前工资 {money(before)} → {money(snapshot.changes[0].value)}</span>{snapshot.allowNegative && <span className="ml-3 text-amber-700">已确认允许击穿</span>}</div><button type="button" onClick={() => removeSnapshot(snapshot.id)} className="text-xs text-red-500">删除</button></div>; })}</div> : <p className="mt-4 text-sm text-slate-400">暂无快照，填写上方信息后保存。</p>}</FloatPanel>}</div></header>
    <section className="mx-auto grid max-w-[1920px] gap-2 px-6 pb-12 pt-3 lg:grid-cols-[minmax(0,1fr)_720px] lg:px-10">
      <div className="space-y-2"><section className="rounded-3xl bg-white p-6 shadow-lg"><div><SectionTitle title="财务参数" tip="按收入到卡、资产配置、结余安全垫、退休规划四组查看与调整。点击可编辑字段打开浮层；修改立即生效并自动保存。" /></div><div className="section-label">收入与到卡</div><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Editable label="税前工资" value={salary} min={0} max={100000000} step={1} onChange={setSalary} /><SocialBreakdown rows={result.socialRows} total={result.social} onHousingPersonalChange={(value) => { setSocialRates((current) => ({ ...current, 住房公积金: { ...current['住房公积金'], personal: clamp(value, 5, 12) } })); window.dispatchEvent(new Event('money-manage-save')); }} /><TaxBreakdown salary={salary} social={result.social} tax={result.tax} deductions={result.deductions} onRentChange={setRentEnabled} onElderlyChange={setElderlyEnabled} /><Breakdown label="可支配收入" value={money(result.net)} detail="税前工资 - 五险一金 - 本月预估个税" /></div><div className="section-label">资产与理财</div><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Editable label="总资产" value={totalAssets} min={0} max={2000000} step={1000} onChange={updateTotalAssets} /><Editable label="现金资产" value={cash} min={0} max={totalAssets} step={1000} onChange={updateCash} /><Editable label="理财资产" value={invest} min={0} max={totalAssets} step={1000} onChange={updateInvestByAmount} /><Editable label="理财资金占比" value={investRatio} min={0} max={100} step={1} suffix="%" onChange={updateInvestByRatio} /><Editable label="年化收益率" value={returnRate} min={0} max={100} step={0.1} suffix="%" onChange={setReturnRate} /><Editable label="工资结余再投资比例" value={reinvestRate} min={0} max={100} step={1} suffix="%" onChange={setReinvestRate} /></div><div className="section-label">结余与安全垫</div><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Editable label="应急资金月数" value={emergencyMonths} min={0} max={36} step={0.5} suffix=" 个月" onChange={setEmergencyMonths} /><Metric label="月度剩余" value={money(result.surplus)} detail="可支配收入扣除本月全部支出后的剩余金额" negative={result.surplus < 0} /><Metric label="调整后可用资产" value={money(result.adjustedAvailableAssets)} detail="已承诺首付金额已从可用资产中扣除" /></div><div className="section-label flex items-center gap-2">退休与社保<input type="checkbox" className="h-3.5 w-3.5 accent-[#f07f62]" checked={retirement.enabled} onChange={(event) => updateRetirement({ enabled: event.target.checked })} title="启用退休与社保规划" aria-label="启用退休与社保规划" /></div><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><DateEditable label="出生日期" value={retirement.birthDate} onChange={(value) => updateRetirement({ birthDate: value })} /><SelectEditable label="身份" value={retirement.identity} options={[{ value: 'male', label: '男性' }, { value: 'female-worker', label: '女性职工' }, { value: 'female-cadre', label: '女性干部' }]} onChange={(value) => updateRetirement({ identity: value })} /><DateEditable label="参保开始日期" value={retirement.insuranceStartDate} onChange={(value) => updateRetirement({ insuranceStartDate: value })} /><Editable label="计划缴费年限" value={retirement.contributionYears} min={0} max={20} step={1} suffix=" 年" onChange={(value) => updateRetirement({ contributionYears: value })} /><div className="relative block"><span className="flex items-center justify-between text-sm text-slate-600"><span>广州 2026 基数</span><span className="field-readonly">{money(retirement.base)} / 月</span></span></div><div className="relative block"><span className="flex items-center justify-between text-sm text-slate-600"><span>预计退休</span><span className="field-readonly">{retirementDate || '未设置'}</span></span></div></div></section>
      <section className="rounded-3xl bg-white p-6 shadow-lg"><div className="flex flex-wrap items-center justify-between gap-4"><SectionTitle title="支出管理" tip="表格中展示支出字段；点击字段可打开浮层进行设置，修改后立即生效并自动保存。" /><button type="button" onClick={addExpense} className="rounded-xl bg-[#f07f62] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#df6e51]">+ 新增支出</button></div><div className="table-wrap mt-5"><table><thead><tr><th>名称</th><th>分类</th><th>类型</th><th>金额 / 月付</th><th>分期信息</th><th>操作</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}><td><ClickField display={expense.name || '未命名'} panel={<label className="block text-xs text-slate-500">名称<input className="field-input mt-1" value={expense.name} onChange={(event) => { updateExpense(expense.id, { name: event.target.value }); saveEvent(); }} /></label>} /></td><td><ClickField display={expense.category || '未分类'} panel={<label className="block text-xs text-slate-500">分类<input className="field-input mt-1" value={expense.category} onChange={(event) => { updateExpense(expense.id, { category: event.target.value }); saveEvent(); }} /></label>} /></td><td><ClickField display={formatExpenseMode(expense.mode)} panel={<label className="block text-xs text-slate-500">类型<select className="field-input mt-1" value={expense.mode} onChange={(event) => { updateExpense(expense.id, { mode: event.target.value as Expense['mode'] }); saveEvent(); }}><option value="fixed">固定金额</option><option value="percentage">按比例</option><option value="installment">分期</option></select></label>} /></td><td><ClickField display={formatExpensePayment(expense)} panel={expense.mode === 'fixed' ? <label className="block text-xs text-slate-500">每月金额<input className="field-input mt-1" type="number" min="0" step="100" value={expense.amount} onChange={(event) => { updateExpense(expense.id, { amount: Number(event.target.value) }); saveEvent(); }} /></label> : expense.mode === 'percentage' ? <label className="block text-xs text-slate-500">收入比例（%）<input className="field-input mt-1" type="number" min="0" max="100" step="1" value={expense.rate || 0} onChange={(event) => { updateExpense(expense.id, { rate: Number(event.target.value) }); saveEvent(); }} /></label> : <p className="text-xs text-slate-500">分期月付由右侧分期信息计算得出</p>} /></td><td><ClickField display={formatExpenseInstallment(expense)} width={360} panel={expense.mode === 'installment' ? <InstallmentSettingsPanel expense={expense} onChange={(patch) => { updateExpense(expense.id, patch); saveEvent(); }} /> : <p className="text-xs text-slate-500">仅分期类型可设置</p>} /></td><td><button type="button" onClick={() => removeExpense(expense.id)} className="text-xs text-red-500 hover:underline">删除</button></td></tr>)}</tbody></table></div></section></div>
      <div className="min-w-0 w-full lg:sticky lg:top-4 lg:self-start"><section className="mb-2 rounded-3xl bg-white p-6 shadow-lg"><div className="relative flex flex-wrap items-start justify-between gap-4"><SectionTitle title="资产走势" tip="年化收益按月度复合增长，工资年度结余按设置的再投资比例追加到理财资产。数据从当前资金起点开始预测。" /><button ref={assetDetailBtnRef} type="button" onClick={() => setShowAssetDetails((current) => !current)} className="text-sm font-semibold text-[#d9654a]">查看明细</button>{showAssetDetails && <FloatPanel open={showAssetDetails} anchorRef={assetDetailBtnRef} onClose={() => setShowAssetDetails(false)} width={620}><div className="flex items-center justify-between"><h3 className="font-semibold">月度资产明细</h3><button type="button" onClick={() => setShowAssetDetails(false)} className="text-xs text-slate-400">关闭</button></div><div className="table-wrap mt-4 max-h-[420px] overflow-auto"><table><thead><tr><th>月份</th><th>现金资产</th><th>理财资产</th><th>总资产</th><th>调整后可用资产</th></tr></thead><tbody>{monthlyAssetForecast.map((row) => <tr key={row.month}><td>{row.label}</td><td>{money(row.cash)}</td><td>{money(row.investment)}</td><td>{money(row.total)}</td><td>{money(row.available)}</td></tr>)}</tbody></table></div></FloatPanel>}</div><div className="mt-5 overflow-x-auto rounded-2xl bg-slate-50 p-3"><svg viewBox="0 0 960 300" className="h-[16.8rem] min-w-0 w-full" role="img" aria-label="资产月度走势"><g>{assetChart.ticks.map((tick) => <g key={tick.ratio}><line x1={assetChart.padL} y1={tick.y} x2={assetChart.plotRight} y2={tick.y} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="5 5" /><line x1={assetChart.padL - 8} y1={tick.y} x2={assetChart.padL} y2={tick.y} stroke="#64748b" strokeWidth="2" /><text x={assetChart.padL - 12} y={tick.y + 8} textAnchor="end" className="fill-slate-700 text-[27px] font-semibold">{money(tick.value)}</text></g>)}</g>{visibleAssetLines.cash && <path d={assetChart.paths.cash} fill="none" stroke="#94a3b8" strokeWidth="2.5" />}{visibleAssetLines.investment && <path d={assetChart.paths.investment} fill="none" stroke="#f07f62" strokeWidth="3" />}{visibleAssetLines.total && <path d={assetChart.paths.total} fill="none" stroke="#17212b" strokeWidth="3.5" />}<line x1={assetChart.padL} y1={assetChart.padT} x2={assetChart.padL} y2={300 - assetChart.padB} stroke="#64748b" strokeWidth="2.5" /><line x1={assetChart.padL} y1={300 - assetChart.padB} x2={assetChart.plotRight} y2={300 - assetChart.padB} stroke="#64748b" strokeWidth="2.5" /><text x={assetChart.padL + 8} y="28" className="fill-slate-600 text-[24px] font-semibold">当前资金起点：{money(cash + invest)}</text><text x={assetChart.padL} y="286" className="fill-slate-700 text-[27px] font-semibold">现在</text><text x={assetChart.plotMid} y="286" textAnchor="middle" className="fill-slate-700 text-[27px] font-semibold">15 年</text><text x={assetChart.plotRight} y="286" textAnchor="end" className="fill-slate-700 text-[27px] font-semibold">30 年</text></svg></div><div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500"><button type="button" onClick={() => setVisibleAssetLines((current) => ({ ...current, cash: !current.cash }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 `}><i className="h-2 w-2 rounded-full bg-slate-400" />现金资产</button><button type="button" onClick={() => setVisibleAssetLines((current) => ({ ...current, investment: !current.investment }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 `}><i className="h-2 w-2 rounded-full bg-[#f07f62]" />理财资产</button><button type="button" onClick={() => setVisibleAssetLines((current) => ({ ...current, total: !current.total }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 `}><i className="h-2 w-2 rounded-full bg-[#17212b]" />总资产</button></div></section><section className="rounded-3xl bg-white p-6 shadow-lg"><div className="flex items-center justify-between"><SectionTitle title="未来财务健康曲线" tip="从今天起模拟 30 年，快照在生效日期后接管对应参数。" /><span className="text-sm text-slate-500">当前方案 · 360 个月</span></div><div className="mt-8 overflow-hidden rounded-2xl bg-slate-50 p-3"><ReactECharts option={healthChartOption} style={{ height: 400, width: "100%" }} notMerge lazyUpdate /></div><div className="mt-4 flex justify-between text-base font-semibold text-slate-600"><span>现在</span><span>5 年</span><span>15 年</span><span>30 年</span></div></section></div></section><footer className="mx-auto max-w-[1920px] px-6 pb-8 text-xs text-slate-400 lg:px-10">原型版 · 个税和五险一金为月度估算，结果仅用于个人财务规划参考</footer>
    </main>;
}

function FloatPanel({ open, anchorRef, onClose, width = 256, children }: { open: boolean; anchorRef: RefObject<HTMLElement | null>; onClose: () => void; width?: number; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const panelH = panelRef.current?.offsetHeight ?? 240;
      const panelW = Math.min(width, window.innerWidth - 32);
      let left = Math.min(Math.max(16, rect.left), window.innerWidth - panelW - 16);
      let top = rect.bottom + 8;
      if (top + panelH > window.innerHeight - 16) top = Math.max(16, rect.top - panelH - 8);
      setPos({ top, left });
    };
    place();
    const raf = window.requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.cancelAnimationFrame(raf); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, anchorRef, width]);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, anchorRef, onClose]);
  if (!open) return null;
  return createPortal(<div ref={panelRef} role="dialog" className="fixed z-[80] max-h-[min(70vh,42rem)] overflow-x-auto overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-4 shadow-xl" style={{ top: pos.top, left: pos.left, width: Math.min(width, typeof window !== 'undefined' ? window.innerWidth - 32 : width) }}>{children}</div>, document.body);
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
  if (expense.mode === 'fixed') return money(expense.amount);
  if (expense.mode === 'percentage') return `${expense.rate || 0}% 收入`;
  const principal = Math.max(0, (expense.total || 0) - (expense.downPayment || 0));
  const rate = (expense.interest || 0) / 1200;
  const maxByDate = expense.startDate && expense.endDate ? Math.max(1, Math.round((new Date(`${expense.endDate}T00:00:00`).getTime() - new Date(`${expense.startDate}T00:00:00`).getTime()) / (30.4375 * 86400000)) + 1) : 360;
  const actualTerm = Math.min(expense.term || 36, maxByDate);
  const paymentAmount = actualTerm > 0 ? (rate ? principal * rate * (1 + rate) ** actualTerm / ((1 + rate) ** actualTerm - 1) : principal / actualTerm) : 0;
  return `${money(paymentAmount)} / 月`;
}
function formatExpenseMode(mode: Expense['mode']) {
  return mode === 'installment' ? '分期' : mode === 'percentage' ? '按比例' : '固定金额';
}
function formatExpenseInstallment(expense: Expense) {
  if (expense.mode !== 'installment') return '—';
  const total = expense.total || 0;
  const down = expense.downPayment || 0;
  const term = expense.term || 36;
  const pct = total > 0 ? (down / total * 100) : 0;
  const years = term / 12;
  const yearLabel = Number.isInteger(years) ? `${years}` : years.toFixed(1);
  return `${money(total)} · 首付 ${money(down)}（${pct.toFixed(1)}%）· ${term} 期 / ${yearLabel} 年 · ${expense.interest || 0}%`;
}
function InstallmentSettingsPanel({ expense, onChange }: { expense: Expense; onChange: (patch: Partial<Expense>) => void }) {
  const total = expense.total || 0;
  const down = Math.min(expense.downPayment || 0, total);
  const term = Math.max(1, expense.term || 36);
  const downPercent = total > 0 ? Math.round(down / total * 1000) / 10 : 0;
  const years = Math.round(term / 12 * 10) / 10;
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
    onChange({ term: clamp(Math.round(months), 1, 360) });
  };
  const patchTermYears = (value: number) => {
    const safeYears = clamp(value, 1 / 12, 30);
    onChange({ term: clamp(Math.round(safeYears * 12), 1, 360) });
  };
  return <div className="space-y-3">
    <label className="block text-xs text-slate-500">总价<input className="field-input mt-1" type="number" min="0" step="1000" value={total} onChange={(event) => patchTotal(Number(event.target.value))} /></label>
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-xs text-slate-500">首付金额<input className="field-input mt-1" type="number" min="0" step="1000" value={down} onChange={(event) => patchDownAmount(Number(event.target.value))} /></label>
      <label className="block text-xs text-slate-500">首付比例（%）<input className="field-input mt-1" type="number" min="0" max="100" step="0.1" value={downPercent} onChange={(event) => patchDownPercent(Number(event.target.value))} /></label>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-xs text-slate-500">期数（月）<input className="field-input mt-1" type="number" min="1" max="360" step="1" value={term} onChange={(event) => patchTermMonths(Number(event.target.value))} /></label>
      <label className="block text-xs text-slate-500">年数<input className="field-input mt-1" type="number" min="0.1" max="30" step="0.1" value={years} onChange={(event) => patchTermYears(Number(event.target.value))} /></label>
    </div>
    <label className="block text-xs text-slate-500">年化利率（%）<input className="field-input mt-1" type="number" min="0" max="100" step="0.1" value={expense.interest || 0} onChange={(event) => onChange({ interest: clamp(Number(event.target.value), 0, 100) })} /></label>
  </div>;
}
function ClickField({ display, panel, width = 280 }: { display: string; panel: ReactNode; width?: number }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return <div className="relative inline-block max-w-full"><button ref={anchorRef} type="button" onClick={() => setOpen((current) => !current)} onDoubleClick={() => setOpen(true)} title="点击打开编辑浮层" className="field-click max-w-full truncate text-left">{display}</button><FloatPanel open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} width={width}>{panel}</FloatPanel></div>;
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
