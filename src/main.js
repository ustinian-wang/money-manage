import './style.css';

const state = {
  salary: 16667, rentDeduction: 2500, parents: 3000, living: 4200, cash: 100000,
  socialRates: { pension: { personal: 8, company: 16 }, medical: { personal: 2, company: 6 }, unemployment: { personal: .5, company: .5 }, housing: { personal: 5, company: 5 } },
  invest: 120000, investRatio: 55, returnRate: 3.2, item: 150000, down: 30, term: 36, rate: 4.2,
  incomes: [{ name: '工资收入', amount: 16667, type: 'fixed' }, { name: '其他收入', amount: 800, type: 'fixed' }],
  expenses: [{ name: '父母上交', amount: 3000, type: 'fixed' }, { name: '必要生活', amount: 4200, type: 'fixed' }],
  debts: [{ name: '信用卡分期', type: '信用卡分期', amount: 500, term: 8, rate: 0 }],
  snapshots: [{ name: '当前基线', month: 0, change: '基线状态' }]
};
try { Object.assign(state, JSON.parse(localStorage.getItem('money-manage-state') || '{}')); } catch (error) { console.warn('无法读取本地财务数据', error); }
let rafId = 0;
const money = (n) => `¥${Math.round(n).toLocaleString('zh-CN')}`;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const debounce = (fn, wait = 100) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); }; };

function calculate() {
  const socialBase = Math.min(state.salary, 31000);
  const social = Object.fromEntries(Object.entries(state.socialRates).map(([key, rate]) => [key, socialBase * rate.personal / 100]));
  const socialTotal = Object.values(social).reduce((a, b) => a + b, 0);
  const taxable = Math.max(0, state.salary - socialTotal - 5000 - state.rentDeduction);
  const tax = taxable <= 3000 ? taxable * .03 : taxable <= 12000 ? taxable * .1 - 210 : taxable * .2 - 1410;
  const net = state.salary - socialTotal - tax;
  const investmentIncome = state.invest * state.investRatio / 100 * state.returnRate / 100 / 12;
  const expenses = state.expenses.reduce((sum, item) => sum + (item.type === 'percent' ? net * item.amount / 100 : item.amount), 0);
  const principal = state.item * (1 - state.down / 100); const monthlyRate = state.rate / 1200;
  const newPayment = monthlyRate ? principal * monthlyRate * (1 + monthlyRate) ** state.term / ((1 + monthlyRate) ** state.term - 1) : principal / state.term;
  const debtPayment = state.debts.reduce((sum, item) => sum + item.amount, 0) + newPayment;
  const surplus = net + investmentIncome - expenses - debtPayment;
  const emergency = state.cash / Math.max(1, expenses);
  const debtRatio = debtPayment / Math.max(1, net + investmentIncome);
  const health = clamp(Math.round(92 - debtRatio * 105 - Math.max(0, 4 - emergency) * 5 + Math.min(5, investmentIncome / 100)), 0, 100);
  return { social, socialTotal, tax, net, investmentIncome, expenses, newPayment, debtPayment, surplus, emergency, debtRatio, health };
}
function schedule() { const c = calculate(); return Array.from({ length: 13 }, (_, i) => clamp(c.health - Math.max(0, 10 - i) * (c.newPayment / 2600), 0, 100)); }
function slider(label, key, min, max, step, value, suffix = '') { return `<label class="slider-label"><span>${label}<output>${key === 'returnRate' ? value + suffix : money(value) + suffix}</output></span><input data-key="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`; }
function renderRows(items, kind) { return items.map((item, index) => `<div class="list-row"><span class="row-icon">${kind === 'debt' ? '↗' : kind === 'asset' ? '◈' : '−'}</span><div><b>${item.name}</b><small>${kind === 'debt' ? `${item.type} · ${item.term}期` : item.type === 'percent' ? '按收入比例' : '固定金额'}</small></div><strong>${kind === 'asset' ? money(item.amount) : item.type === 'percent' ? item.amount + '%' : money(item.amount)} </strong><button class="remove" data-remove="${kind}:${index}" title="删除">×</button></div>`).join(''); }

function render() {
  const c = calculate(); const values = schedule(); const line = values.map((v, i) => `${i ? 'L' : 'M'} ${i * 7.5} ${100 - v}`).join(' '); const min = Math.min(...values); const status = c.health >= 75 ? ['可以考虑', 'good'] : c.health >= 55 ? ['谨慎评估', 'warn'] : ['不建议', 'bad'];
  document.querySelector('#app').innerHTML = `<div class="shell"><header><div class="brand"><span class="mark">M</span><div><b>money manage</b><small>个人财务管理系统</small></div></div><div class="period">模拟周期　<span>未来 36 个月⌄</span></div><button class="ghost">导出快照 ↗</button></header><main>
  <section class="intro"><div><p class="eyebrow">FINANCIAL HEALTH / 02</p><h1>每一笔钱，都会改变<br><em>未来的财务健康流</em></h1><p class="muted">单人财务模型 · 父母上交作为刚性支出 · 可保存未来变化快照</p></div><div class="score-ring"><strong>${c.health}</strong><span>/ 100</span><small>当前健康分</small></div></section>
  <div class="layout"><aside class="panel inputs"><div class="panel-head"><div><p class="eyebrow">CONTROL PANEL</p><h2>财务参数</h2></div><span class="dot"></span></div>${slider('税前月薪', 'salary', 10000, 30000, 100, state.salary)}${slider('当前现金资产', 'cash', 20000, 300000, 1000, state.cash)}<div class="subhead">资产与收益</div>${slider('理财资产', 'invest', 0, 500000, 1000, state.invest)}${slider('理财资金占比', 'investRatio', 0, 100, 1, state.investRatio, '%')}${slider('年化收益率', 'returnRate', 0, 10, .1, state.returnRate, '%')}<div class="subhead">个税扣除与刚性支出</div><div class="mini-grid"><label>租房扣除<input data-key="rentDeduction" type="number" value="${state.rentDeduction}"></label><label>父母上交<input data-key="parents" type="number" value="${state.parents}"></label></div><p class="helper">父母上交计入每月刚性支出，不重复抵扣个税。</p><div class="subhead">评估消费</div>${slider('消费金额', 'item', 30000, 300000, 1000, state.item)}${slider('首付比例', 'down', 0, 80, 1, state.down, '%')}${slider('分期期限', 'term', 6, 60, 6, state.term, '期')}</aside>
  <section class="content"><div class="metric-grid"><div class="metric"><span>预计月总收入</span><b>${money(c.net + c.investmentIncome)}</b><small>工资到手 ${money(c.net)} · 理财 ${money(c.investmentIncome)}</small></div><div class="metric"><span>新增月供</span><b>${money(c.newPayment)}</b><small>总债务收入比 ${Math.round(c.debtRatio * 100)}%</small></div><div class="metric"><span>月度剩余</span><b class="${c.surplus < 0 ? 'negative' : ''}">${money(c.surplus)}</b><small>父母上交 ${money(state.parents)} 已计入</small></div><div class="metric"><span>应急金覆盖</span><b>${c.emergency.toFixed(1)}<i>个月</i></b><small>建议保持 3–6 个月</small></div></div>
  <div class="card chart-card"><div class="card-title"><div><p class="eyebrow">FORECAST / SNAPSHOT</p><h2>未来财务健康曲线</h2></div><div class="legend"><span></span>当前方案　<i></i>安全基线</div></div><div class="chart"><div class="y-labels"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><svg viewBox="0 0 90 100" preserveAspectRatio="none"><path class="baseline" d="M0 25 L90 25"/><path class="area" d="${line} L90 100 L0 100 Z"/><path class="line" d="${line}"/></svg><div class="x-labels"><span>现在</span><span>12 个月</span><span>24 个月</span><span>36 个月</span></div></div><div class="chart-callout"><b>最低点：${min.toFixed(0)} 分</b><span>第 ${Math.max(1, values.findIndex(x => x === min) * 3)} 个月 · 可通过快照模拟未来变化</span></div></div>
  <div class="management-grid"><div class="card manage-card"><div class="card-title"><div><p class="eyebrow">CASH FLOW</p><h2>支出管理</h2></div><button class="add" data-add="expense">＋ 添加</button></div>${renderRows(state.expenses, 'expense')}</div><div class="card manage-card"><div class="card-title"><div><p class="eyebrow">LIABILITIES</p><h2>超前消费 / 负债</h2></div><button class="add" data-add="debt">＋ 添加</button></div>${renderRows(state.debts, 'debt')}</div></div>
  <div class="lower-grid"><div class="card breakdown"><p class="eyebrow">SOCIAL SECURITY</p><h2>五险一金明细</h2><div class="social-table"><div><span>养老保险 <small>个人 ${state.socialRates.pension.personal}% · 公司 ${state.socialRates.pension.company}%</small></span><b>${money(c.social.pension)}</b></div><div><span>医疗保险 <small>个人 ${state.socialRates.medical.personal}% · 公司 ${state.socialRates.medical.company}%</small></span><b>${money(c.social.medical)}</b></div><div><span>失业保险 <small>个人 ${state.socialRates.unemployment.personal}% · 公司 ${state.socialRates.unemployment.company}%</small></span><b>${money(c.social.unemployment)}</b></div><div><span>住房公积金 <small>个人 ${state.socialRates.housing.personal}% · 公司 ${state.socialRates.housing.company}%</small></span><b>${money(c.social.housing)}</b></div><div class="rate-editor"><label>个人公积金比例<input data-rate="housing:personal" type="number" step=".5" value="${state.socialRates.housing.personal}">%</label><label>公司公积金比例<input data-rate="housing:company" type="number" step=".5" value="${state.socialRates.housing.company}">%</label></div><div class="total"><span>个人缴纳合计</span><b>${money(c.socialTotal)}</b></div></div></div><div class="card manage-card"><div class="card-title"><div><p class="eyebrow">FUTURE SNAPSHOTS</p><h2>未来快照</h2></div><button class="add" data-add="snapshot">＋ 添加</button></div>${renderRows(state.snapshots, 'snapshot')}<p class="helper">快照用于记录未来某个时间点的收入、支出或负债变化。</p></div></div>
  </section></div><footer>原型版 · 估算结果仅用于个人财务规划参考，不构成税务或借贷建议</footer></main></div>`;
  bind();
}
function persist() { localStorage.setItem('money-manage-state', JSON.stringify(state)); fetch('/api/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state) }).catch(() => {}); }
function bind() { document.querySelectorAll('input[data-key]').forEach(el => { el.addEventListener('input', e => { state[e.target.dataset.key] = Number(e.target.value) || 0; const out = e.target.parentElement.querySelector('output'); if (out) out.textContent = e.target.dataset.key === 'returnRate' ? `${e.target.value}%` : `${money(Number(e.target.value))}${e.target.dataset.key === 'down' ? '%' : e.target.dataset.key === 'term' ? '期' : ''}`; persist(); }); el.addEventListener('change', () => render()); }); document.querySelectorAll('input[data-rate]').forEach(el => el.addEventListener('input', e => { const [key, field] = e.target.dataset.rate.split(':'); state.socialRates[key][field] = Number(e.target.value) || 0; persist(); render(); })); document.querySelectorAll('[data-remove]').forEach(el => el.addEventListener('click', () => { const [kind, index] = el.dataset.remove.split(':'); state[kind === 'expense' ? 'expenses' : kind === 'debt' ? 'debts' : 'snapshots'].splice(Number(index), 1); persist(); render(); })); document.querySelectorAll('[data-add]').forEach(el => el.addEventListener('click', () => { const kind = el.dataset.add; if (kind === 'expense') state.expenses.push({ name: '给家里', amount: 1000, type: 'fixed' }); if (kind === 'debt') state.debts.push({ name: '新消费', type: '普通消费', amount: 1200, term: 24, rate: 3.5 }); if (kind === 'snapshot') state.snapshots.push({ name: '未来变化', month: state.snapshots.length * 6, change: '待配置' }); persist(); render(); })); }
render();
