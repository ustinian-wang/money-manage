'use client';

import { useEffect, useMemo, useState } from 'react';

type Expense = { id: string; name: string; category: string; mode: 'fixed' | 'percentage' | 'installment'; amount: number; rate?: number; total?: number; downPayment?: number; term?: number; interest?: number };
type SnapshotChange = { id: string; label: string; path: 'salary' | 'cash' | 'returnRate'; value: number };
type Snapshot = { id: string; name: string; effectiveDate: string; changes: SnapshotChange[]; allowNegative: boolean };
type EditableProps = { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const money = (value: number) => `¥${Math.round(value).toLocaleString('zh-CN')}`;
const uid = () => `expense-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const initialExpenses: Expense[] = [
  { id: 'parent-support', name: '上交父母', category: '家庭支持', mode: 'fixed', amount: 3000 },
  { id: 'daily-life', name: '日常生活', category: '生活', mode: 'fixed', amount: 4200 },
  { id: 'car-installment', name: '车辆分期', category: '交通', mode: 'installment', amount: 0, total: 150000, downPayment: 45000, term: 36, interest: 4.2 },
];

export default function HomePage() {
  const [salary, setSalary] = useState(16667);
  const [cash, setCash] = useState(100000);
  const [totalAssets, setTotalAssets] = useState(500000);
  const [invest, setInvest] = useState(120000);
  const [investRatio, setInvestRatio] = useState(24);
  const [returnRate, setReturnRate] = useState(3.2);
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem('money-manage-profile');
      if (!saved) return;
      const data = JSON.parse(saved);
      if (data.salary) setSalary(data.salary); if (data.cash !== undefined) setCash(data.cash);
      if (data.totalAssets) setTotalAssets(data.totalAssets); if (data.invest !== undefined) setInvest(data.invest);
      if (data.investRatio !== undefined) setInvestRatio(data.investRatio); if (data.returnRate !== undefined) setReturnRate(data.returnRate);
      if (data.expenses) setExpenses(data.expenses); if (data.rentEnabled !== undefined) setRentEnabled(data.rentEnabled);
      if (data.elderlyEnabled !== undefined) setElderlyEnabled(data.elderlyEnabled);
      if (data.snapshots) setSnapshots(data.snapshots);
    } catch { /* retain defaults for invalid local data */ } finally { setHydrated(true); }
  }, []);

  const profile = { schemaVersion: 2, salary, cash, totalAssets, invest, investRatio, returnRate, expenses, rentEnabled, elderlyEnabled, snapshots };
  const save = () => { localStorage.setItem('money-manage-profile', JSON.stringify(profile)); setSavedAt(new Date().toLocaleTimeString('zh-CN')); };
  useEffect(() => { if (!hydrated) return; const timer = window.setTimeout(save, 120); return () => window.clearTimeout(timer); }, [hydrated, salary, cash, totalAssets, invest, investRatio, returnRate, expenses, rentEnabled, elderlyEnabled, snapshots]);
  const updateInvestByAmount = (value: number) => { const availableCap = Math.max(0, totalAssets - result.committedDownPayments); const next = clamp(value, 0, availableCap); setInvest(next); setInvestRatio(totalAssets ? next / totalAssets * 100 : 0); };
  const updateInvestByRatio = (value: number) => { const next = clamp(value, 0, 100); const availableCap = Math.max(0, totalAssets - result.committedDownPayments); const nextAmount = Math.min(availableCap, totalAssets * next / 100); setInvestRatio(totalAssets ? nextAmount / totalAssets * 100 : 0); setInvest(nextAmount); };

  const result = useMemo(() => {
    const base = Math.min(salary, 31000);
    const socialRows = [
      ['养老保险', 8, 16], ['医疗保险', 2, 6], ['失业保险', 0.5, 0.5], ['工伤保险', 0, 0.4], ['生育保险', 0, 0.8], ['住房公积金', 5, 5],
    ].map(([name, personal, company]) => ({ name: String(name), personal: Number(personal), company: Number(company), personalAmount: base * Number(personal) / 100, companyAmount: base * Number(company) / 100 }));
    const social = socialRows.reduce((sum, row) => sum + row.personalAmount, 0);
    const deductions = [
      { name: '基本减除费用', enabled: true, standard: 5000, rate: 100 },
      { name: '住房租金', enabled: rentEnabled, standard: 1500, rate: rentEnabled ? 100 : 0 },
      { name: '赡养老人', enabled: elderlyEnabled, standard: 2000, rate: elderlyEnabled ? 100 : 0 },
    ].map((row) => ({ ...row, actual: row.standard * row.rate / 100 }));
    const taxable = Math.max(0, salary - social - deductions.reduce((sum, row) => sum + row.actual, 0));
    const tax = taxable <= 3000 ? taxable * 0.03 : taxable <= 12000 ? taxable * 0.1 - 210 : taxable <= 25000 ? taxable * 0.2 - 1410 : taxable * 0.25 - 2660;
    const net = salary - social - Math.max(0, tax);
    const investmentIncome = invest * returnRate / 100 / 12;
    const monthlyExpenses = expenses.reduce((sum, expense) => {
      if (expense.mode === 'fixed') return sum + expense.amount;
      if (expense.mode === 'percentage') return sum + (net + investmentIncome) * (expense.rate || 0) / 100;
      const principal = Math.max(0, (expense.total || 0) - (expense.downPayment || 0)); const rate = (expense.interest || 0) / 1200; const months = expense.term || 1;
      return sum + (rate ? principal * rate * (1 + rate) ** months / ((1 + rate) ** months - 1) : principal / months);
    }, 0);
    const committedDownPayments = expenses.filter((expense) => expense.mode === 'installment').reduce((sum, expense) => sum + (expense.downPayment || 0), 0);
    const liquidAssets = cash + invest;
    const adjustedAvailableAssets = Math.max(0, liquidAssets - committedDownPayments);
    const totalLiabilities = expenses.filter((expense) => expense.mode === 'installment').reduce((sum, expense) => sum + Math.max(0, (expense.total || 0) - (expense.downPayment || 0)), 0);
    const netWorth = totalAssets - totalLiabilities;
    const surplus = net + investmentIncome - monthlyExpenses;
    const emergency = cash / Math.max(1, monthlyExpenses);
    const debt = expenses.filter((expense) => expense.mode === 'installment').reduce((sum, expense) => {
      const principal = Math.max(0, (expense.total || 0) - (expense.downPayment || 0)); const rate = (expense.interest || 0) / 1200; const months = expense.term || 1;
      return sum + (rate ? principal * rate * (1 + rate) ** months / ((1 + rate) ** months - 1) : principal / months);
    }, 0);
    const health = clamp(Math.round(92 - debt / Math.max(1, net + investmentIncome) * 105 - Math.max(0, 4 - emergency) * 5), 0, 100);
    return { socialRows, social, deductions, tax: Math.max(0, tax), net, investmentIncome, monthlyExpenses, surplus, emergency, debt, health, committedDownPayments, liquidAssets, adjustedAvailableAssets, totalLiabilities, netWorth };
  }, [salary, cash, invest, returnRate, expenses, rentEnabled, elderlyEnabled]);

  const updateExpense = (id: string, patch: Partial<Expense>) => setExpenses((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
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
  const addSnapshot = () => {
    const effectiveDate = snapshotDate || today;
    const previous = [...snapshots].filter((item) => item.effectiveDate <= effectiveDate).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)).at(-1);
    const previousSalary = previous?.changes.find((change) => change.path === 'salary')?.value ?? salary;
    const risk = snapshotSalary < 10000 && result.surplus < 0;
    if (risk && !window.confirm(`该节点可能造成财务击穿（当前月度剩余 ${money(result.surplus)}）。确认后才会保存并允许击穿。`)) return;
    const id = `snapshot-${Date.now()}`;
    const change: SnapshotChange = { id: `${id}-salary`, label: '税前月薪', path: 'salary', value: clamp(snapshotSalary, 0, 2000000) };
    setSnapshots((items) => [...items, { id, name: snapshotName || `${effectiveDate} 收入节点`, effectiveDate, allowNegative: risk, changes: [change] }].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)));
    setSnapshotMessage(`已对比最近节点：${money(previousSalary)} → ${money(snapshotSalary)}`);
    setSnapshotName(''); setSnapshotDate('');
  };
  const removeSnapshot = (id: string) => setSnapshots((items) => items.filter((item) => item.id !== id));

  return <main className="min-h-screen bg-[#f6f8f5] text-[#17212b]">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#17212b] font-bold text-white">M</div><div><p className="font-bold">money manage</p><p className="text-xs text-slate-500">个人财务管理系统</p></div></div><span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">{savedAt ? `已保存 ${savedAt}` : '双击数字编辑 · 失焦自动保存'}</span></header>
    <section className="mx-auto grid max-w-7xl gap-8 px-6 pb-8 pt-5 lg:grid-cols-[1fr_190px] lg:px-10"><div><p className="eyebrow">FINANCIAL HEALTH / 03</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">每一笔钱，都会改变<br /><span className="text-[#f07f62]">未来的财务健康流</span></h1><p className="mt-5 text-slate-500">单人模型 · 税费到卡工资与支出统一管理 · 参数调整后即时重算</p></div><div className="rounded-3xl bg-[#17212b] p-6 text-white shadow-xl"><span className="text-sm text-slate-300">当前健康分</span><p className="mt-2 text-5xl font-semibold">{result.health}<small className="text-lg text-slate-300"> / 100</small></p><p className="mt-3 text-sm text-emerald-300">{status}</p></div></section>
    <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-12 lg:grid-cols-[320px_1fr] lg:px-10"><aside className="space-y-6 rounded-3xl bg-white p-6 shadow-lg"><div><p className="eyebrow">CONTROL PANEL</p><h2 className="mt-1 text-2xl font-semibold">财务参数</h2></div><Editable label="税前月薪" value={salary} min={10000} max={30000} step={100} onChange={setSalary} /><div className="section-label">资产与理财</div><Editable label="总资产" value={totalAssets} min={0} max={2000000} step={1000} onChange={(value) => { const next = clamp(value, 0, 2000000); setTotalAssets(next); const boundedInvest = Math.min(invest, next); setInvest(boundedInvest); setInvestRatio(next ? boundedInvest / next * 100 : 0); }} /><Editable label="现金资产" value={cash} min={0} max={2000000} step={1000} onChange={(value) => setCash(clamp(value, 0, 2000000))} /><Editable label="理财资产" value={invest} min={0} max={totalAssets} step={1000} onChange={updateInvestByAmount} /><Editable label="理财资金占比" value={investRatio} min={0} max={100} step={1} suffix="%" onChange={updateInvestByRatio} /><Editable label="年化收益率" value={returnRate} min={0} max={100} step={0.1} suffix="%" onChange={setReturnRate} /><p className="text-xs leading-5 text-slate-500">理财金额与占比双向联动，且不会超过总资产。年化收益率仅用于模拟。</p><button onClick={save} className="w-full rounded-xl bg-[#17212b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">立即保存</button></aside>
      <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="实际到卡工资" value={money(result.net)} detail={`税前 ${money(salary)} · 个税 ${money(result.tax)}`} /><Metric label="调整后可用资产" value={money(result.adjustedAvailableAssets)} detail={`已承诺首付 ${money(result.committedDownPayments)}`} /><Metric label="月度剩余" value={money(result.surplus)} detail={`总支出 ${money(result.monthlyExpenses)}`} negative={result.surplus < 0} /><Metric label="应急金覆盖" value={`${result.emergency.toFixed(1)} 个月`} detail="建议保持 3–6 个月" /></div>
      <section className="rounded-3xl bg-white p-6 shadow-lg"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">TAX & BENEFITS</p><h2 className="mt-1 text-2xl font-semibold">税费与到卡工资</h2><p className="mt-2 text-sm text-slate-500">五险一金和个税共同决定实际到卡金额；赡养老人按系统政策标准直接扣除，上交父母在支出列表中单独管理。</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">月度估算</span></div><div className="mt-6 grid gap-3 sm:grid-cols-4"><Breakdown label="税前工资" value={money(salary)} detail="工资收入基数" /><Breakdown label="个人五险一金" value={`-${money(result.social)}`} detail="个人缴纳合计" /><Breakdown label="预计个人所得税" value={`-${money(result.tax)}`} detail="扣除后估算" /><Breakdown label="实际到卡工资" value={money(result.net)} detail="税前 - 五险一金 - 个税" /></div><div className="mt-6"><h3 className="font-semibold">五险一金明细</h3><div className="table-wrap mt-3"><table><thead><tr><th>项目</th><th>个人比例</th><th>个人金额</th><th>公司比例</th><th>公司金额</th></tr></thead><tbody>{result.socialRows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.personal}%</td><td>{money(row.personalAmount)}</td><td>{row.company}%</td><td>{money(row.companyAmount)}</td></tr>)}</tbody></table></div></div><div className="mt-6"><div className="flex items-center justify-between"><h3 className="font-semibold">个税系统专项附加扣除</h3><span className="text-xs text-slate-400">政策勾选，不直接输入自定义金额</span></div><div className="mt-3 grid gap-3 md:grid-cols-2">{result.deductions.slice(1).map((row) => <label key={row.name} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><span className="flex items-center gap-2"><input type="checkbox" checked={row.name === '住房租金' ? rentEnabled : elderlyEnabled} onChange={(event) => row.name === '住房租金' ? setRentEnabled(event.target.checked) : setElderlyEnabled(event.target.checked)} />{row.name}</span><span className="mt-3 block text-xs text-slate-500">政策标准 {money(row.standard)} / 月</span><span className="mt-1 block text-sm font-semibold">系统直接扣除 {money(row.actual)}</span><span className="mt-2 block text-xs text-emerald-700">预计减税：按适用税率估算</span></label>)}</div><p className="mt-3 text-xs text-slate-500">上交父母不属于专项附加扣除，不会因为勾选赡养老人而自动增加或减少。</p></div></section>
      <section className="rounded-3xl bg-white p-6 shadow-lg"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">EXPENSES</p><h2 className="mt-1 text-2xl font-semibold">支出管理</h2><p className="mt-2 text-sm text-slate-500">普通支出和分期支出统一管理，每个 item 都可以独立编辑或删除。</p></div><button onClick={addExpense} className="rounded-xl bg-[#f07f62] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#df6e51]">+ 新增支出</button></div><div className="mt-5 space-y-3">{expenses.map((expense) => <ExpenseItem key={expense.id} expense={expense} onChange={(patch) => updateExpense(expense.id, patch)} onDelete={() => removeExpense(expense.id)} />)}</div></section>
      <section className="rounded-3xl bg-white p-6 shadow-lg"><div className="flex items-center justify-between"><div><p className="eyebrow">FORECAST / SNAPSHOT</p><h2 className="mt-1 text-2xl font-semibold">未来财务健康曲线</h2><p className="mt-2 text-sm text-slate-500">从今天起模拟 30 年，快照在生效日期后接管对应参数。</p></div><span className="text-sm text-slate-500">当前方案 · 360 个月</span></div><div className="mt-8 flex h-64 items-end gap-px overflow-hidden rounded-2xl bg-slate-50 p-5">{forecast.map((point) => <div key={point.dateKey} className="min-w-[2px] flex-1 rounded-t bg-[#f07f62]/80" style={{ height: `${Math.max(8, point.value)}%` }} title={`${point.label} · ${Math.round(point.value)} 分`} />)}</div><div className="mt-4 flex justify-between text-xs text-slate-400"><span>现在</span><span>5 年</span><span>15 年</span><span>30 年</span></div><div className="mt-8 border-t border-slate-100 pt-5"><div className="flex items-center justify-between"><h3 className="font-semibold">未来快照</h3><span className="text-xs text-slate-400">保存前会确认负资产击穿</span></div><div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_1fr_auto] md:items-end"><label className="field"><span>快照名称</span><input value={snapshotName} onChange={(event) => setSnapshotName(event.target.value)} onBlur={saveEvent} /></label><label className="field"><span>生效日期</span><input type="date" min={today} value={snapshotDate} onChange={(event) => setSnapshotDate(event.target.value)} /></label><label className="field"><span>变化后税前月薪</span><input type="number" min="0" max="2000000" value={snapshotSalary} onChange={(event) => setSnapshotSalary(Number(event.target.value))} /></label><button onClick={addSnapshot} className="rounded-xl bg-[#17212b] px-4 py-2.5 text-sm font-semibold text-white">保存快照</button></div>{snapshotMessage && <p className="mt-3 text-sm text-emerald-700">{snapshotMessage}</p>}{snapshots.length > 0 && <div className="mt-4 space-y-2">{snapshots.map((snapshot, index) => { const previous = snapshots[index - 1]; const before = previous?.changes[0]?.value ?? salary; return <div key={snapshot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm"><div><strong>{snapshot.name}</strong><span className="ml-3 text-slate-500">{snapshot.effectiveDate}</span><span className="ml-3 text-slate-600">税前月薪 {money(before)} → {money(snapshot.changes[0].value)}</span>{snapshot.allowNegative && <span className="ml-3 text-amber-700">已确认允许击穿</span>}</div><button onClick={() => removeSnapshot(snapshot.id)} className="text-xs text-red-500">删除</button></div>; })}</div>}</div></section></div></section><footer className="mx-auto max-w-7xl px-6 pb-8 text-xs text-slate-400 lg:px-10">原型版 · 个税和五险一金为月度估算，结果仅用于个人财务规划参考</footer>
    </main>;
}

function Editable({ label, value, min, max, step, suffix = '', onChange }: EditableProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { if (!editing) setDraft(String(Number.isInteger(value) ? value : value.toFixed(1))); }, [value, editing]);
  const commit = () => { const next = clamp(Number(draft), min, max); setDraft(String(next)); onChange(next); setEditing(false); window.dispatchEvent(new Event('money-manage-save')); };
  const position = max === min ? 0 : Math.round((value - min) / (max - min) * 100);
  return <label className="block space-y-2"><span className="flex items-center justify-between text-sm text-slate-600"><span>{label}</span>{editing ? <input autoFocus type="number" min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') commit(); if (event.key === 'Escape') { setDraft(String(value)); setEditing(false); } }} className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right font-mono text-xs outline-none" /> : <button type="button" onDoubleClick={() => { setDraft(String(value)); setEditing(true); }} title="双击数字编辑，失焦自动保存" className="rounded-lg px-2 py-1 font-mono text-xs text-slate-700 hover:bg-slate-100">{Number.isInteger(value) ? value.toLocaleString('zh-CN') : value.toFixed(1)}{suffix}</button>}</span><div className="flex items-center gap-2"><input aria-label={label} className="money-slider flex-1" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} onMouseUp={saveEvent} onTouchEnd={saveEvent} /><input aria-label={`${label}百分比位置`} className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right font-mono text-xs" type="number" min="0" max="100" step="1" value={position} onChange={(event) => onChange(min + (max - min) * clamp(Number(event.target.value), 0, 100) / 100)} onBlur={saveEvent} />%</div></label>;
}
const saveEvent = () => window.dispatchEvent(new Event('money-manage-save'));

function ExpenseItem({ expense, onChange, onDelete }: { expense: Expense; onChange: (patch: Partial<Expense>) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const payment = expense.mode === 'fixed' ? money(expense.amount) : expense.mode === 'percentage' ? `${expense.rate || 0}% 收入` : `${money(expense.amount)} / 月`;
  return <div className="rounded-2xl border border-slate-100 p-4"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong>{expense.name}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{expense.category}</span><span className="rounded-full bg-orange-50 px-2 py-1 text-xs text-orange-700">{expense.mode === 'installment' ? '分期' : expense.mode === 'percentage' ? '按比例' : '固定金额'}</span></div><p className="mt-2 text-sm text-slate-500">本月计入：<span className="font-semibold text-slate-700">{payment}</span>{expense.mode === 'installment' && ` · ${expense.term} 期 · 利率 ${expense.interest}%`}</p></div><button onClick={() => setEditing(!editing)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">{editing ? '完成' : '编辑'}</button><button onClick={onDelete} className="rounded-lg px-3 py-2 text-xs text-red-500 hover:bg-red-50">删除</button></div>{editing && <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4"><label className="field"><span>名称</span><input value={expense.name} onChange={(event) => onChange({ name: event.target.value })} onBlur={saveEvent} /></label><label className="field"><span>类型</span><select value={expense.mode} onChange={(event) => onChange({ mode: event.target.value as Expense['mode'] })}><option value="fixed">固定金额</option><option value="percentage">按收入比例</option><option value="installment">分期</option></select></label>{expense.mode === 'fixed' && <Editable label="每月金额" value={expense.amount} min={0} max={2000000} step={100} onChange={(value) => onChange({ amount: value })} />}{expense.mode === 'percentage' && <Editable label="收入比例" value={expense.rate || 0} min={0} max={100} step={1} suffix="%" onChange={(value) => onChange({ rate: value })} />}{expense.mode === 'installment' && <><Editable label="总价格" value={expense.total || 0} min={0} max={2000000} step={1000} onChange={(value) => onChange({ total: value })} /><Editable label="首付金额" value={expense.downPayment || 0} min={0} max={expense.total || 0} step={1000} onChange={(value) => onChange({ downPayment: value })} /><Editable label="分期时长" value={expense.term || 36} min={1} max={360} step={1} suffix="期" onChange={(value) => onChange({ term: value })} /><Editable label="年化利率" value={expense.interest || 0} min={0} max={100} step={0.1} suffix="%" onChange={(value) => onChange({ interest: value })} /></>}</div>}</div>;
}
function Metric({ label, value, detail, negative = false }: { label: string; value: string; detail: string; negative?: boolean }) { return <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><span className="text-sm text-slate-500">{label}</span><p className={`mt-3 text-2xl font-semibold ${negative ? 'text-red-500' : ''}`}>{value}</p><small className="mt-2 block text-xs leading-5 text-slate-400">{detail}</small></div>; }
function Breakdown({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>; }
