import './style.css';

const state = { salary: 16667, housing: 2500, parents: 2000, insurance: 3200, living: 4200, cash: 100000, item: 150000, down: 30, term: 36, rate: 4.2, extra: 500 };
const fmt = (n) => `¥${Math.round(n).toLocaleString('zh-CN')}`;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function calc(salary = state.salary) {
  const social = Math.min(salary, 31000) * 0.105;
  const taxable = Math.max(0, salary - social - 5000 - state.housing - state.parents);
  const tax = taxable <= 3000 ? taxable * 0.03 : taxable <= 12000 ? taxable * 0.1 - 210 : taxable <= 25000 ? taxable * 0.2 - 1410 : taxable * 0.25 - 2660;
  const net = salary - social - tax;
  const principal = state.item * (1 - state.down / 100);
  const monthlyRate = state.rate / 100 / 12;
  const payment = monthlyRate ? principal * monthlyRate * (1 + monthlyRate) ** state.term / ((1 + monthlyRate) ** state.term - 1) : principal / state.term;
  const fixed = state.living + state.extra;
  const surplus = net - fixed - payment;
  const emergencyMonths = state.cash * (1 - state.down / 100 * state.item / state.cash) / Math.max(1, fixed);
  const debtRatio = payment / Math.max(1, net);
  const health = clamp(Math.round(92 - debtRatio * 100 - Math.max(0, 4 - emergencyMonths) * 5 + (state.housing + state.parents > 0 ? 3 : 0)), 0, 100);
  return { social, tax, net, payment, surplus, emergencyMonths, debtRatio, health, principal };
}

function series() { const base = calc(); return Array.from({ length: 13 }, (_, i) => clamp(base.health - Math.max(0, 10 - i) * (base.payment / 2500), 0, 100)); }

function render() {
  const c = calc(); const points = series();
  const path = points.map((v, i) => `${i ? 'L' : 'M'} ${i * 7.5} ${100 - v}`).join(' ');
  const label = c.health >= 75 ? ['可以考虑', '健康缓冲充足，当前方案处于可控区间。', 'good'] : c.health >= 55 ? ['谨慎评估', '月度结余偏紧，建议降低金额或延长准备周期。', 'warn'] : ['不建议', '方案会明显压缩现金流与应急储备。', 'bad'];
  document.querySelector('#app').innerHTML = `
    <div class="shell">
      <header><div class="brand"><span class="mark">M</span><div><b>money manage</b><small>个人财务管理系统</small></div></div><div class="period">模拟周期　<span>未来 36 个月⌄</span></div><button class="ghost">导出报告 ↗</button></header>
      <main>
        <section class="intro"><div><p class="eyebrow">FINANCIAL HEALTH / 01</p><h1>看清每一笔消费<br><em>如何改变未来现金流</em></h1><p class="muted">收入、五险一金、个税扣除与分期方案，在同一个财务健康模型里联动计算。</p></div><div class="score-ring"><strong>${c.health}</strong><span>/ 100</span><small>当前财务健康分</small></div></section>
        <div class="layout"><aside class="panel inputs"><div class="panel-head"><div><p class="eyebrow">INPUTS</p><h2>你的财务底盘</h2></div><span class="dot"></span></div>
          ${slider('月薪（税前）', 'salary', 10000, 30000, 100, state.salary, fmt(state.salary))}
          <div class="subhead">专项附加扣除</div><div class="mini-grid"><label>租房扣除<input data-key="housing" type="number" value="${state.housing}"></label><label>赡养父母<input data-key="parents" type="number" value="${state.parents}"></label></div>
          <div class="subhead">每月支出</div><div class="mini-grid"><label>必要生活<input data-key="living" type="number" value="${state.living}"></label><label>已有月供<input data-key="extra" type="number" value="${state.extra}"></label></div>
          ${slider('当前可动用现金', 'cash', 20000, 300000, 1000, state.cash, fmt(state.cash))}
          <div class="subhead">评估一笔消费</div>${slider('消费金额', 'item', 30000, 300000, 1000, state.item, fmt(state.item))}${slider('首付比例', 'down', 0, 80, 1, state.down, `${state.down}%`)}${slider('分期期限', 'term', 6, 60, 6, state.term, `${state.term} 期`)}
        </aside><section class="content"><div class="metric-grid"><div class="metric"><span>预计月到手</span><b>${fmt(c.net)}</b><small>含五险一金 ${fmt(c.social)} · 个税 ${fmt(c.tax)}</small></div><div class="metric"><span>新增月供</span><b>${fmt(c.payment)}</b><small>债务收入比 ${Math.round(c.debtRatio * 100)}%</small></div><div class="metric"><span>月度剩余</span><b class="${c.surplus < 0 ? 'negative' : ''}">${fmt(c.surplus)}</b><small>基础支出 ${fmt(state.living + state.extra)}</small></div><div class="metric"><span>应急金覆盖</span><b>${c.emergencyMonths.toFixed(1)}<i>个月</i></b><small>建议保持 3–6 个月</small></div></div>
          <div class="card chart-card"><div class="card-title"><div><p class="eyebrow">SIMULATION</p><h2>财务健康曲线</h2></div><div class="legend"><span></span>当前方案　<i></i>安全基线</div></div><div class="chart"><div class="y-labels"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><svg viewBox="0 0 90 100" preserveAspectRatio="none"><path class="baseline" d="M0 25 L90 25"/><path class="area" d="${path} L90 100 L0 100 Z"/><path class="line" d="${path}"/></svg><div class="x-labels"><span>现在</span><span>12 个月</span><span>24 个月</span><span>36 个月</span></div></div><div class="chart-callout"><b>最低点：${Math.min(...points).toFixed(0)} 分</b><span>第 ${Math.max(1, points.findIndex(x => x === Math.min(...points)) * 3)} 个月 · 分期结束后逐步恢复</span></div></div>
          <div class="bottom-grid"><div class="card verdict"><p class="eyebrow">RECOMMENDATION</p><div class="verdict-row"><div><h2>${label[0]} <span class="${label[2]}"></span></h2><p>${label[1]}</p></div><span class="arrow">→</span></div><div class="tip"><b>你的超前消费红线</b><span>新增月供不超过 ${fmt(Math.max(0, c.net * 0.3 - state.extra))}，且应急储备不低于 3 个月。</span></div></div><div class="card breakdown"><p class="eyebrow">TAX & BENEFITS</p><h2>本月收入拆解</h2><div class="bar"><span style="width:${c.net / state.salary * 100}%"></span></div><div class="break-row"><span>税前收入 <b>${fmt(state.salary)}</b></span><span>五险一金 <b class="red">−${fmt(c.social)}</b></span><span>个税 <b class="red">−${fmt(c.tax)}</b></span><span>税后到手 <b>${fmt(c.net)}</b></span></div></div></div></section></div>
        <footer>原型版 · 计算结果仅用于个人财务规划参考，不构成投资、借贷或税务建议</footer>
      </main>
    </div>`;
  document.querySelectorAll('[data-key]').forEach(el => el.addEventListener('input', e => { state[e.target.dataset.key] = Number(e.target.value) || 0; render(); }));
}
function slider(label, key, min, max, step, value, text) { return `<label class="slider-label"><span>${label}<output>${text}</output></span><input data-key="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`; }
render();
