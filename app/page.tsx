'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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
      if (data.totalAssets) setTotalAssets(data.totalAssets); if (data.invest !== undefined) setInvest(data.invest);
      if (data.investRatio !== undefined) setInvestRatio(data.investRatio); if (data.returnRate !== undefined) setReturnRate(data.returnRate); if (data.reinvestRate !== undefined) setReinvestRate(data.reinvestRate);
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
  const updateInvestByAmount = (value: number) => { const availableCap = Math.max(0, totalAssets - result.committedDownPayments); const next = clamp(value, 0, availableCap); setInvest(next); setInvestRatio(totalAssets ? next / totalAssets * 100 : 0); };
  const updateInvestByRatio = (value: number) => { const next = clamp(value, 0, 100); const availableCap = Math.max(0, totalAssets - result.committedDownPayments); const nextAmount = Math.min(availableCap, totalAssets * next / 100); setInvestRatio(totalAssets ? nextAmount / totalAssets * 100 : 0); setInvest(nextAmount); };

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
    const max = Math.max(1, ...monthlyAssetForecast.flatMap((row) => [row.cash, row.investment, row.total]));
    const x = (month: number) => month / 360 * width;
    const y = (value: number) => height - value / max * (height - 24) - 12;
    const path = (key: 'cash' | 'investment' | 'total') => monthlyAssetForecast.map((row, index) => `${index === 0 ? 'M' : 'L'}${x(row.month).toFixed(1)},${y(row[key]).toFixed(1)}`).join(' ');
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({ ratio, value: max * ratio, y: y(max * ratio) }));
    return { width, height, max, ticks, paths: { cash: path('cash'), investment: path('investment'), total: path('total') } };
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
  const healthChartOption = useMemo(() => ({
    animation: false,
    grid: { left: 48, right: 24, top: 24, bottom: 48 },
    tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${Math.round(value)} 分` },
    xAxis: { type: 'category', boundaryGap: false, data: forecast.map((point) => point.label), axisLabel: { color: '#52605b', fontSize: 14, interval: 35 }, axisLine: { lineStyle: { color: '#94a3b8', width: 1.5 } }, name: '未来月份', nameLocation: 'middle', nameGap: 32, nameTextStyle: { color: '#52605b', fontSize: 14 } },
    yAxis: { type: 'value', min: 0, max: 100, interval: 20, name: '健康分', nameTextStyle: { color: '#52605b', fontSize: 14 }, axisLabel: { color: '#52605b', fontSize: 14 }, axisLine: { show: true, lineStyle: { color: '#94a3b8', width: 1.5 } }, splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } } },
    dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', height: 16, bottom: 8, start: 0, end: 100 }],
    series: [{ name: '财务健康分', type: 'line', smooth: true, symbol: 'none', data: forecast.map((point) => Math.round(point.value)), lineStyle: { color: '#f07f62', width: 3 }, areaStyle: { color: 'rgba(240,127,98,0.12)' }, markLine: { silent: true, data: [{ yAxis: 75, name: '安全线' }, { yAxis: 55, name: '警戒线' }], lineStyle: { color: '#94a3b8', type: 'dashed' }, label: { color: '#64748b' } } }]
  }), [forecast]);

  return <main className="min-h-screen bg-[#f6f8f5] text-[#17212b]">
    <header className="mx-auto flex max-w-[1920px] items-center justify-between border-b border-slate-100 px-6 py-3 lg:px-10"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#17212b] font-bold text-white">M</div><div><p className="font-bold">财务管理</p><p className="text-xs text-slate-500">个人财务管理系统</p></div></div><span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">{savedAt ? `已保存 ${savedAt}` : '双击数字编辑 · 失焦自动保存'}</span></header>
    <section className="mx-auto grid max-w-[1920px] items-center gap-5 px-6 pb-5 pt-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:px-10"><div><h1 className="mt-0 text-4xl font-semibold tracking-tight sm:text-5xl">每一笔钱，都会改变<br /><span className="text-[#f07f62]">未来的财务健康流</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">单人模型 · 税费到卡工资与支出统一管理 · 参数调整后即时重算</p></div><div className="rounded-3xl bg-[#17212b] p-4 text-white shadow-lg"><span className="text-sm text-slate-300">当前健康分</span><p className="mt-1 text-4xl font-semibold">{result.health}<small className="text-lg text-slate-300"> / 100</small></p><div className="mt-2 flex items-center justify-between gap-3"><p className="text-xs text-emerald-300">{status}</p><a href="#snapshot-actions" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20">快照操作</a></div></div></section>
    <section className="mx-auto grid max-w-[1920px] gap-2 px-6 pb-12 lg:grid-cols-[280px_minmax(420px,1fr)_480px] lg:px-10"><aside className="space-y-6 rounded-3xl bg-white p-6 shadow-lg"><div><SectionTitle title="财务参数" compact tip="应急资金月数、资产、现金、理财比例、年化收益率和工资结余再投资比例都可以点击数值打开浮层调整。所有修改立即生效并自动保存；理财金额不会超过总资产，收益按年度复利计算。" /></div><div className="section-label">基础参数</div><Editable label="应急资金月数" value={emergencyMonths} min={0} max={36} step={0.5} suffix=" 个月" onChange={setEmergencyMonths} /><div className="section-label">资产与理财</div><Editable label="总资产" value={totalAssets} min={0} max={2000000} step={1000} onChange={(value) => { const next = clamp(value, 0, 2000000); setTotalAssets(next); const boundedInvest = Math.min(invest, next); setInvest(boundedInvest); setInvestRatio(next ? boundedInvest / next * 100 : 0); }} /><Editable label="现金资产" value={cash} min={0} max={2000000} step={1000} onChange={(value) => setCash(clamp(value, 0, 2000000))} /><Editable label="理财资产" value={invest} min={0} max={totalAssets} step={1000} onChange={updateInvestByAmount} /><Editable label="理财资金占比" value={investRatio} min={0} max={100} step={1} suffix="%" onChange={updateInvestByRatio} /><Editable label="年化收益率" value={returnRate} min={0} max={100} step={0.1} suffix="%" onChange={setReturnRate} /><Editable label="工资结余再投资比例" value={reinvestRate} min={0} max={100} step={1} suffix="%" onChange={setReinvestRate} /><div className="section-label">退休与社保</div><div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={retirement.enabled} onChange={(event) => updateRetirement({ enabled: event.target.checked })} />启用退休与社保规划</label>{retirement.enabled && <div className="mt-4 space-y-3"><DateEditable label="出生日期" value={retirement.birthDate} onChange={(value) => updateRetirement({ birthDate: value })} /><label className="field"><span>身份</span><select value={retirement.identity} onChange={(event) => updateRetirement({ identity: event.target.value })}><option value="male">男性</option><option value="female-worker">女性职工</option><option value="female-cadre">女性干部</option></select></label><DateEditable label="参保开始日期" value={retirement.insuranceStartDate} onChange={(value) => updateRetirement({ insuranceStartDate: value })} /><label className="field"><span>计划缴费年限（最多 20 年）</span><input type="number" min="0" max="20" value={retirement.contributionYears} onChange={(event) => updateRetirement({ contributionYears: clamp(Number(event.target.value), 0, 20) })} /></label><div className="retirement-summary"><span>广州 2026 基数：{money(retirement.base)} / 月</span><span>预计退休：{retirementDate}</span></div></div>}</div></aside>
      <div className="space-y-2"><section className="rounded-3xl bg-white p-6 shadow-lg"><div className="flex flex-wrap items-start justify-between gap-4"><SectionTitle title="税费与到卡工资" tip="五险一金和个税共同决定实际到卡金额；赡养老人按政策扣除，上交父母属于普通支出。" /><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">月度估算</span></div><div className="mt-6 grid gap-3 sm:grid-cols-4"><SocialBreakdown rows={result.socialRows} total={result.social} /><TaxBreakdown salary={salary} social={result.social} tax={result.tax} deductions={result.deductions} onRentChange={setRentEnabled} onElderlyChange={setElderlyEnabled} /><Breakdown label="可支配收入" value={money(result.net)} detail="税前工资 - 五险一金 - 本月预估个税" /></div><div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><IncomeMetric salary={salary} net={result.net} tax={result.tax} onSalaryChange={setSalary} /><Metric label="调整后可用资产" value={money(result.adjustedAvailableAssets)} detail="已承诺首付金额已从可用资产中扣除" /><Metric label="月度剩余" value={money(result.surplus)} detail="可支配收入扣除本月全部支出后的剩余金额" negative={result.surplus < 0} /><Metric label="应急资金月数" value={result.emergency.toFixed(1) + " 个月"} detail="当前应急资金月数，可在左侧财务参数中调整" /></div><div className="mt-6"><h3 className="font-semibold">五险一金明细</h3><div className="table-wrap mt-3"><table><thead><tr><th>项目</th><th>个人比例</th><th>个人金额</th><th>公司比例</th><th>公司金额</th></tr></thead><tbody>{result.socialRows.map((row) => <tr key={row.name}><td>{row.name}</td><td><RateEditable value={row.personal} onChange={(value) => setSocialRates((current) => ({ ...current, [row.name]: { ...current[row.name], personal: value } }))} /></td><td>{money(row.personalAmount)}</td><td><RateEditable value={row.company} onChange={(value) => setSocialRates((current) => ({ ...current, [row.name]: { ...current[row.name], company: value } }))} /></td><td>{money(row.companyAmount)}</td></tr>)}</tbody></table></div></div></section>
      <section className="rounded-3xl bg-white p-6 shadow-lg"><div className="flex flex-wrap items-center justify-between gap-4"><SectionTitle title="支出管理" tip="普通支出和分期支出统一管理，点击支出项的设置即可修改，修改会立即生效并自动保存。" /><button onClick={addExpense} className="rounded-xl bg-[#f07f62] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#df6e51]">+ 新增支出</button></div><div className="mt-5 overflow-x-auto"><div className="grid min-w-[680px] grid-cols-[minmax(0,1.4fr)_minmax(120px,1fr)_minmax(130px,1fr)_auto] gap-3 border-b border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400"><span>名称</span><span>备注</span><span>金额</span><span>操作</span></div><div className="expense-list space-y-2">{expenses.map((expense) => <ExpenseItem key={expense.id} expense={expense} retirementEnabled={retirement.enabled} retirementDate={retirementDate} onChange={(patch) => updateExpense(expense.id, patch)} onDelete={() => removeExpense(expense.id)} />)}</div></div></section></div>
      <div className="min-w-0 w-full lg:sticky lg:top-4 lg:self-start"><section className="mb-2 rounded-3xl bg-white p-6 shadow-lg"><div className="flex flex-wrap items-start justify-between gap-4"><SectionTitle title="资产走势" tip="年化收益按月度复合增长，工资年度结余按设置的再投资比例追加到理财资产。数据从当前资金起点开始预测。" /><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">30 年 / 31 个年度节点</span></div><div className="mt-5 overflow-x-auto rounded-2xl bg-slate-50 p-3"><svg viewBox="0 0 960 300" className="h-72 min-w-0 w-full" role="img" aria-label="资产月度走势"><g>{assetChart.ticks.map((tick) => <g key={tick.ratio}><line x1="48" y1={tick.y} x2="960" y2={tick.y} stroke="#e2e8f0" strokeDasharray="4 4" /><text x="4" y={tick.y + 4} className="fill-slate-400 text-[14px]">{money(tick.value)}</text></g>)}</g>{visibleAssetLines.cash && <path d={assetChart.paths.cash} fill="none" stroke="#94a3b8" strokeWidth="2" />}{visibleAssetLines.investment && <path d={assetChart.paths.investment} fill="none" stroke="#f07f62" strokeWidth="2.5" />}{visibleAssetLines.total && <path d={assetChart.paths.total} fill="none" stroke="#17212b" strokeWidth="3" />}<line x1="48" y1="12" x2="48" y2="288" stroke="#cbd5e1" /><line x1="48" y1="288" x2="960" y2="288" stroke="#cbd5e1" /><line x1="48" y1="150" x2="960" y2="150" stroke="#e2e8f0" strokeDasharray="4 4" /><text x="48" y="14" className="fill-slate-400 text-[14px]">当前资金起点：{money(cash + invest)}</text><text x="48" y="299" className="fill-slate-400 text-[14px]">现在（当前资金）</text><text x="460" y="299" className="fill-slate-400 text-[14px]">15 年</text><text x="910" y="299" className="fill-slate-400 text-[14px]">30 年</text></svg></div><div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500"><button type="button" onClick={() => setVisibleAssetLines((current) => ({ ...current, cash: !current.cash }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 `}><i className="h-2 w-2 rounded-full bg-slate-400" />现金资产</button><button type="button" onClick={() => setVisibleAssetLines((current) => ({ ...current, investment: !current.investment }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 `}><i className="h-2 w-2 rounded-full bg-[#f07f62]" />理财资产</button><button type="button" onClick={() => setVisibleAssetLines((current) => ({ ...current, total: !current.total }))} className={`flex items-center gap-1 rounded-lg px-2 py-1 `}><i className="h-2 w-2 rounded-full bg-[#17212b]" />总资产</button></div><div className="relative mt-5 border-t border-slate-100 pt-4"><button type="button" onClick={() => setShowAssetDetails((current) => !current)} className="text-sm font-semibold text-[#d9654a]">查看月度资产明细（361 个节点）</button>{showAssetDetails && <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,620px)] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h3 className="font-semibold">月度资产明细</h3><button type="button" onClick={() => setShowAssetDetails(false)} className="text-xs text-slate-400">关闭</button></div><div className="table-wrap mt-4 max-h-[420px] overflow-auto"><table><thead><tr><th>月份</th><th>现金资产</th><th>理财资产</th><th>总资产</th><th>调整后可用资产</th></tr></thead><tbody>{monthlyAssetForecast.map((row) => <tr key={row.month}><td>{row.label}</td><td>{money(row.cash)}</td><td>{money(row.investment)}</td><td>{money(row.total)}</td><td>{money(row.available)}</td></tr>)}</tbody></table></div></div>}</div></section><section className="rounded-3xl bg-white p-6 shadow-lg"><div className="flex items-center justify-between"><SectionTitle title="未来财务健康曲线" tip="从今天起模拟 30 年，快照在生效日期后接管对应参数。" /><span className="text-sm text-slate-500">当前方案 · 360 个月</span></div><div className="mt-8 overflow-hidden rounded-2xl bg-slate-50 p-3"><ReactECharts option={healthChartOption} style={{ height: 360, width: "100%" }} notMerge lazyUpdate /></div><div className="mt-4 flex justify-between text-xs text-slate-400"><span>现在</span><span>5 年</span><span>15 年</span><span>30 年</span></div><div id="snapshot-actions" className="mt-8 scroll-mt-6 border-t border-slate-100 pt-5"><div className="flex items-center justify-between"><h3 className="font-semibold">未来快照</h3><span className="text-xs text-slate-400">保存前会确认负资产击穿</span></div><div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_1fr_auto] md:items-end"><label className="field"><span>快照名称</span><input value={snapshotName} onChange={(event) => setSnapshotName(event.target.value)} onBlur={saveEvent} /></label><DateEditable label="生效日期" value={snapshotDate} min={today} onChange={setSnapshotDate} /><label className="field"><span>变化后税前工资</span><input type="number" min="0" max="2000000" value={snapshotSalary} onChange={(event) => setSnapshotSalary(Number(event.target.value))} /></label><button onClick={addSnapshot} className="rounded-xl bg-[#17212b] px-4 py-2.5 text-sm font-semibold text-white">保存快照</button></div>{snapshotMessage && <p className="mt-3 text-sm text-emerald-700">{snapshotMessage}</p>}{snapshots.length > 0 && <div className="mt-4 space-y-2">{snapshots.map((snapshot, index) => { const previous = snapshots[index - 1]; const before = previous?.changes[0]?.value ?? salary; return <div key={snapshot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm"><div><strong>{snapshot.name}</strong><span className="ml-3 text-slate-500">{snapshot.effectiveDate}</span><span className="ml-3 text-slate-600">税前工资 {money(before)} → {money(snapshot.changes[0].value)}</span>{snapshot.allowNegative && <span className="ml-3 text-amber-700">已确认允许击穿</span>}</div><button onClick={() => removeSnapshot(snapshot.id)} className="text-xs text-red-500">删除</button></div>; })}</div>}</div></section></div></section><footer className="mx-auto max-w-[1920px] px-6 pb-8 text-xs text-slate-400 lg:px-10">原型版 · 个税和五险一金为月度估算，结果仅用于个人财务规划参考</footer>
    </main>;
}

function Editable({ label, value, min, max, step, suffix = '', onChange }: EditableProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { if (!open) setDraft(String(Number.isInteger(value) ? value : value.toFixed(1))); }, [value, open]);
  const position = max === min ? 0 : Math.round((value - min) / (max - min) * 100);
  const commit = (nextValue = Number(draft)) => { const next = clamp(nextValue, min, max); setDraft(String(next)); onChange(next); window.dispatchEvent(new Event('money-manage-save')); };
  const display = `${Number.isInteger(value) ? value.toLocaleString('zh-CN') : value.toFixed(1)}${suffix}`;
  useEffect(() => { if (!open) return; const close = (event: PointerEvent) => { if (!containerRef.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close); }, [open]);
  return <div ref={containerRef} className="relative block"><span className="flex items-center justify-between text-sm text-slate-600"><span>{label}</span><button type="button" onClick={() => { setDraft(String(value)); setOpen((current) => !current); }} onDoubleClick={() => { setDraft(String(value)); setOpen(true); }} title="点击或双击数字打开编辑浮层" className="rounded-lg px-2 py-1 font-mono text-xs text-slate-700 hover:bg-slate-100">{display}</button></span>{open && <div className="absolute inset-x-0 top-full z-40 mt-2 max-w-[calc(100vw-2rem)] overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"><div className="flex items-center justify-between gap-3"><label className="flex-1 text-xs text-slate-500">精确值<input autoFocus type="number" min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { commit(); setOpen(false); } if (event.key === 'Escape') setOpen(false); }} onBlur={() => commit()} className="field-input mt-1" /></label><span className="pt-5 font-mono text-sm text-slate-500">{suffix}</span></div><div className="mt-3 flex items-center gap-2"><input aria-label={`${label}百分比位置`} className="money-slider" type="range" min="0" max="100" step="1" value={position} onChange={(event) => commit(min + (max - min) * Number(event.target.value) / 100)} /><span className="w-12 text-right text-xs text-slate-500">{position}%</span></div><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs">完成</button></div></div>}</div>;
}
function DateEditable({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const close = (event: PointerEvent) => { if (!containerRef.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close); }, [open]);
  return <div ref={containerRef} className="relative block"><span className="mb-2 block text-sm text-slate-600">{label}</span><button type="button" onClick={() => setOpen((current) => !current)} onDoubleClick={() => setOpen(true)} className="field-input w-full text-left text-sm" title="点击或双击日期打开日历">{value || '未设置'}</button>{open && <div className="absolute left-0 top-full z-40 mt-2 max-w-[calc(100vw-2rem)] overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"><label className="block text-xs text-slate-500">选择日期<input autoFocus type="date" min={min} value={value} onChange={(event) => { onChange(event.target.value); setOpen(false); }} className="field-input mt-2" /></label><button type="button" onClick={() => setOpen(false)} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs">完成</button></div>}</div>;
}
function RateEditable({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close); }, [open]);
  const commit = (next: number) => { const safe = clamp(next, 0, 100); setDraft(String(safe)); onChange(safe); };
  return <div ref={ref} className="relative inline-block"><button type="button" onClick={() => { setDraft(String(value)); setOpen((current) => !current); }} className="rounded-lg px-2 py-1 text-sm hover:bg-slate-100">{value}%</button>{open && <div className="absolute right-0 top-full z-50 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"><label className="text-xs text-slate-500">比例<input autoFocus type="number" min="0" max="100" step="0.1" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { commit(Number(draft)); setOpen(false); } if (event.key === 'Escape') setOpen(false); }} onBlur={() => commit(Number(draft))} className="field-input mt-1" /></label><input className="money-slider mt-3" type="range" min="0" max="100" step="0.1" value={Number(draft)} onChange={(event) => commit(Number(event.target.value))} /></div>}</div>;
}
const saveEvent = () => window.dispatchEvent(new Event('money-manage-save'));

function ExpenseItem({ expense, retirementEnabled, retirementDate, onChange, onDelete }: { expense: Expense; retirementEnabled: boolean; retirementDate: string; onChange: (patch: Partial<Expense>) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const principal = Math.max(0, (expense.total || 0) - (expense.downPayment || 0));
  const rate = (expense.interest || 0) / 1200;
  const maxByDate = expense.startDate && expense.endDate ? Math.max(1, Math.round((new Date(`${expense.endDate}T00:00:00`).getTime() - new Date(`${expense.startDate}T00:00:00`).getTime()) / (30.4375 * 86400000)) + 1) : 360;
  const actualTerm = Math.min(expense.term || 36, maxByDate);
  const paymentAmount = actualTerm > 0 ? (rate ? principal * rate * (1 + rate) ** actualTerm / ((1 + rate) ** actualTerm - 1) : principal / actualTerm) : 0;
  const payment = expense.mode === 'fixed' ? money(expense.amount) : expense.mode === 'percentage' ? `${expense.rate || 0}% 收入` : `${money(paymentAmount)} / 月`;
  const patchDate = (key: 'startDate' | 'endDate', value: string) => {
    const next = { [key]: value } as Partial<Expense>;
    const start = key === 'startDate' ? value : expense.startDate; const end = key === 'endDate' ? value : expense.endDate;
    if (start && end && end < start) next.endDate = start;
    onChange(next);
  };
  return <div className="expense-item relative grid min-w-[680px] grid-cols-[minmax(0,1.4fr)_minmax(120px,1fr)_minmax(130px,1fr)_auto] items-center gap-3 rounded-xl border border-slate-100 bg-white p-4"><div className="min-w-0"><div className="flex items-center gap-2"><strong className="break-words">{expense.name}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{expense.category}</span><span className="rounded-full bg-orange-50 px-2 py-1 text-xs text-orange-700">{expense.mode === 'installment' ? '分期' : expense.mode === 'percentage' ? '按比例' : '固定金额'}</span></div></div><div className="min-w-0 text-sm text-slate-500">{expense.mode === 'installment' ? '分期消费' : expense.mode === 'percentage' ? '按收入比例' : '固定支出'}</div><button type="button" onClick={() => setEditing(true)} className="min-w-0 truncate text-left text-sm text-slate-700 hover:text-[#d9654a]">{payment}{expense.mode === 'installment' && ` · ${actualTerm} 期 · 利率 ${expense.interest}%`}</button><div className="flex items-center justify-end gap-2"><button type="button" onClick={() => setEditing((current) => !current)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">编辑</button><button type="button" onClick={onDelete} className="rounded-lg px-3 py-2 text-xs text-red-500 hover:bg-red-50">删除</button></div>{editing && <div className="absolute inset-x-3 top-full z-30 mt-2 max-w-[calc(100vw-1.5rem)] overflow-x-auto grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:grid-cols-2 lg:grid-cols-4"><label className="field"><span>名称</span><input value={expense.name} onChange={(event) => onChange({ name: event.target.value })} onBlur={saveEvent} /></label><label className="field"><span>类型</span><select value={expense.mode} onChange={(event) => onChange({ mode: event.target.value as Expense['mode'] })}><option value="fixed">固定金额</option><option value="percentage">按收入比例</option><option value="installment">分期</option></select></label>{expense.mode === 'fixed' && <Editable label="每月金额" value={expense.amount} min={0} max={10000000} step={100} onChange={(value) => onChange({ amount: value })} />}{expense.mode === 'percentage' && <Editable label="收入比例" value={expense.rate || 0} min={0} max={100} step={1} suffix="%" onChange={(value) => onChange({ rate: value })} />}{expense.mode === 'installment' && <><label className="field"><span>生效日期</span><input type="date" value={expense.startDate || ''} onChange={(event) => patchDate('startDate', event.target.value)} /></label><label className="field"><span>截止日期</span><input type="date" min={expense.startDate || undefined} value={expense.endDate || ''} onChange={(event) => patchDate('endDate', event.target.value)} /></label><Editable label="总价格" value={expense.total || 0} min={0} max={10000000} step={1000} onChange={(value) => onChange({ total: value })} /><Editable label="首付金额" value={expense.downPayment || 0} min={0} max={Math.min(10000000, expense.total || 0)} step={1000} onChange={(value) => onChange({ downPayment: value })} /><Editable label="分期时长" value={actualTerm} min={1} max={maxByDate} step={1} suffix="期" onChange={(value) => onChange({ term: value })} /><Editable label="年化利率" value={expense.interest || 0} min={0} max={100} step={0.1} suffix="%" onChange={(value) => onChange({ interest: value })} />{retirementEnabled && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(expense.followRetirement)} onChange={(event) => onChange({ followRetirement: event.target.checked })} />跟随预计退休时间（{retirementDate}）</label>}</>}</div>}</div>;
}
function Metric({ label, value, detail, negative = false }: { label: string; value: string; detail: string; negative?: boolean }) { return <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-slate-100 px-1 py-3 last:border-0"><div><span className="flex items-center gap-1 text-sm text-slate-500">{label}<InfoTip>{detail}</InfoTip></span></div><p className={`text-right text-lg font-semibold ${negative ? 'text-red-500' : 'text-[#17212b]'}`}>{value}</p></div>; }
function IncomeMetric({ salary, net, tax, onSalaryChange }: { salary: number; net: number; tax: number; onSalaryChange: (value: number) => void }) { return <div className="grid grid-cols-2 gap-4 border-b border-slate-100 px-1 py-3 sm:grid-cols-2"><div><p className="flex items-center gap-1 text-sm text-slate-500">税前工资<InfoTip>税前工资是计算五险一金、个税和可支配收入的基础参数。</InfoTip></p><Editable label="税前工资" value={salary} min={10000} max={30000} step={100} onChange={onSalaryChange} /></div><div><p className="flex items-center gap-1 text-sm text-slate-500">可支配收入<InfoTip>税前工资扣除个人五险一金和本月预估个税后的收入。</InfoTip></p><p className="mt-2 text-lg font-semibold">{money(net)}</p></div></div>; }
function Breakdown({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="flex items-center gap-1 text-sm text-slate-500">{label}<InfoTip>{detail}</InfoTip></p><p className="mt-2 text-xl font-semibold">{value}</p></div>; }
function SocialBreakdown({ rows, total }: { rows: Array<{ name: string; personal: number; personalAmount: number; company: number; companyAmount: number }>; total: number }) {
  const [open, setOpen] = useState(false);
  return <div className="relative rounded-2xl bg-slate-50 p-4"><p className="flex items-center gap-1 text-sm text-slate-500">个人五险一金<InfoTip>个人承担的养老、医疗、失业、工伤、生育和住房公积金缴纳金额。</InfoTip></p><p className="mt-2 text-xl font-semibold">-{money(total)}</p><div className="mt-1 flex items-center justify-between gap-2"><p className="text-xs text-slate-400">个人缴纳合计</p><button type="button" onClick={() => setOpen((current) => !current)} className="text-xs font-semibold text-[#d9654a]">查看明细</button></div>{open && <div className="absolute right-0 top-full z-50 mt-2 max-w-[calc(100vw-2rem)] w-[min(92vw,620px)] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h3 className="font-semibold">五险一金缴纳明细</h3><button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400">关闭</button></div><div className="table-wrap mt-4"><table><thead><tr><th>项目</th><th>个人比例</th><th>个人金额</th><th>企业比例</th><th>企业金额</th></tr></thead><tbody>{rows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.personal}%</td><td>{money(row.personalAmount)}</td><td>{row.company}%</td><td>{money(row.companyAmount)}</td></tr>)}</tbody></table></div><div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold"><span>个人缴纳合计</span><span>-{money(total)}</span></div></div>}</div>;
}
function TaxBreakdown({ salary, social, tax, deductions, onRentChange, onElderlyChange }: { salary: number; social: number; tax: number; deductions: Array<{ name: string; standard: number; actual: number; enabled: boolean }>; onRentChange: (value: boolean) => void; onElderlyChange: (value: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const taxable = Math.max(0, salary - social - deductions.reduce((sum, row) => sum + row.actual, 0));
  const bracket = taxable <= 3000 ? taxBrackets[0] : taxable <= 12000 ? taxBrackets[1] : taxable <= 25000 ? taxBrackets[2] : taxBrackets[3];
  return <div className="relative rounded-2xl bg-slate-50 p-4"><p className="flex items-center gap-1 text-sm text-slate-500">本月预估个税<InfoTip>根据当前税前工资、个人五险一金和已勾选专项附加扣除估算的本月个税。</InfoTip></p><p className="mt-2 text-xl font-semibold">-{money(tax)}</p><div className="mt-1 flex items-center justify-between gap-2"><p className="text-xs text-slate-400">扣除后估算</p><button type="button" onClick={() => setOpen((current) => !current)} className="text-xs font-semibold text-[#d9654a]">查看明细</button></div>{open && <div className="absolute right-0 top-full z-50 mt-2 max-w-[calc(100vw-2rem)] w-[min(92vw,620px)] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h3 className="font-semibold">本月个税估算明细</h3><button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400">关闭</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm"><span className="flex items-center gap-2"><input type="checkbox" checked={deductions.find((row) => row.name === "住房租金")?.enabled ?? false} onChange={(event) => onRentChange(event.target.checked)} />住房租金</span><span className="mt-2 block text-xs text-slate-500">政策标准 {money(deductions.find((row) => row.name === "住房租金")?.standard ?? 0)} / 月</span></label><label className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm"><span className="flex items-center gap-2"><input type="checkbox" checked={deductions.find((row) => row.name === "赡养老人")?.enabled ?? false} onChange={(event) => onElderlyChange(event.target.checked)} />赡养老人</span><span className="mt-2 block text-xs text-slate-500">政策标准 {money(deductions.find((row) => row.name === "赡养老人")?.standard ?? 0)} / 月</span></label></div><div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span>税前工资</span><strong>{money(salary)}</strong></div><div className="flex justify-between"><span>个人五险一金</span><strong>-{money(social)}</strong></div>{deductions.map((row) => <div key={row.name} className="flex justify-between"><span>{row.name}</span><strong>-{money(row.actual)}</strong></div>)}<div className="flex justify-between border-t border-slate-100 pt-2"><span>应纳税所得额</span><strong>{money(taxable)}</strong></div><div className="flex justify-between"><span>当前区间：税率 / 速算扣除数</span><strong>{bracket.rate}% / {money(bracket.quick)}</strong></div><div className="flex justify-between border-t border-slate-100 pt-2 font-semibold"><span>本月预估个税</span><strong className="text-red-500">-{money(tax)}</strong></div></div><div className="mt-5"><h4 className="text-sm font-semibold">不同区间纳税明细</h4><div className="table-wrap mt-2"><table><thead><tr><th>月应纳税所得额</th><th>税率</th><th>速算扣除数</th><th>当前状态</th></tr></thead><tbody>{taxBrackets.map((item) => <tr key={item.range} className={item.range === bracket.range ? 'bg-emerald-50 font-semibold' : ''}><td>{item.range}</td><td>{item.rate}%</td><td>{money(item.quick)}</td><td>{item.range === bracket.range ? '当前区间' : '可选区间'}</td></tr>)}</tbody></table></div></div></div>}</div>;
}
