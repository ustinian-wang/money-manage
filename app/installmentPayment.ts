/** 页面分期月供口径（与 DTI / 支出占比 / 剩余可支配曲线共用） */
export type PageRepaymentMode = 'equal_principal_interest' | 'equal_principal';

export type PageInstallmentInput = {
  total?: number;
  downPayment?: number;
  term?: number;
  interest?: number;
  repaymentMode?: PageRepaymentMode;
  startDate?: string;
  endDate?: string;
};

/** 无息粗算月供超过此值且 term≤40 时，视为「年误存为月」 */
export const YEAR_LIKE_TERM_MONTHLY_THRESHOLD = 20000;

/** 是否像「把年数写进了 term（月）」：term≤40 且 本金/term > 2 万 */
export function isYearMisstoredAsMonths(
  term: number,
  opts: { total?: number; downPayment?: number } = {},
): boolean {
  const raw = Math.max(1, Math.round(term) || 1);
  if (raw > 40) return false;
  const principal = Math.max(0, (opts.total || 0) - (opts.downPayment || 0));
  return principal / Math.max(1, raw) > YEAR_LIKE_TERM_MONTHLY_THRESHOLD;
}

/**
 * 归一化分期期数（月）。双保险：计算时若仍遇到年误存，×12。
 * 主修正路径是 migrateInstallmentTerms（hydrate 写回 state）。
 */
export function normalizeInstallmentTermMonths(
  term: number,
  opts: { total?: number; downPayment?: number } = {},
): number {
  const raw = Math.max(1, Math.round(term) || 1);
  return isYearMisstoredAsMonths(raw, opts) ? raw * 12 : raw;
}

/**
 * 加载 profile：把「年误存为月」的 term 写成月数（30→360），并同步 endDate。
 * 车贷 36 期、本金 10 万级：本金/term 远低于阈值，不变。
 */
export function migrateInstallmentTerms<T extends PageInstallmentInput & { mode?: string }>(
  expenses: T[],
): T[] {
  return expenses.map((item) => {
    if (item.mode && item.mode !== 'installment') return item;
    const term = Math.max(1, Math.round(item.term || 1) || 1);
    if (!isYearMisstoredAsMonths(term, { total: item.total, downPayment: item.downPayment })) {
      return item;
    }
    const months = term * 12;
    const start = (item.startDate || '').slice(0, 10);
    // 旧 endDate 按短期写的，必须跟着拉长，否则曾被用来截断月供
    let endDate = item.endDate;
    if (start && /^\d{4}-\d{2}-\d{2}/.test(start)) {
      const end = new Date(`${start}T00:00:00`);
      end.setMonth(end.getMonth() + months - 1);
      const pad = (n: number) => String(n).padStart(2, '0');
      endDate = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
    }
    return { ...item, term: months, endDate };
  });
}

/**
 * 贷款期数（月）。年数与期数等价：年 × 12 = 月；存储与计算一律用月。
 * 不以陈旧 endDate 截断 term（那会把 360 错裁成 ~36）。
 */
export function installmentTermMonths(expense: PageInstallmentInput): number {
  // 仅对「年误存为月」残留做 ×12；已是 360 月的不再动
  const months = normalizeInstallmentTermMonths(expense.term || 1, {
    total: expense.total,
    downPayment: expense.downPayment,
  });
  return Math.min(360, Math.max(1, months));
}

/** 日历月差（按年月），同月为 0 */
export function calendarMonthsBetween(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate.slice(0, 10)}T00:00:00`);
  const to = new Date(`${toDate.slice(0, 10)}T00:00:00`);
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/**
 * 第 period 期月供（1-based）。超出期数返回 0。
 * 等额本息固定；等额本金随剩余本金递减。
 */
export function installmentPaymentAtPeriod(expense: PageInstallmentInput, period: number): number {
  const principal = Math.max(0, (expense.total || 0) - (expense.downPayment || 0));
  const months = installmentTermMonths(expense);
  if (principal <= 0 || !Number.isInteger(period) || period < 1 || period > months) return 0;
  const monthlyRate = (expense.interest || 0) / 1200;
  const mode = expense.repaymentMode || 'equal_principal_interest';
  if (mode === 'equal_principal') {
    const principalPart = principal / months;
    const remaining = principal - principalPart * (period - 1);
    return principalPart + remaining * monthlyRate;
  }
  if (!monthlyRate) return principal / months;
  const factor = (1 + monthlyRate) ** months;
  return principal * monthlyRate * factor / (factor - 1);
}

/** 仪表盘当期：等额本息固定；等额本金取首月（压力最大） */
export function installmentMonthlyPayment(expense: PageInstallmentInput): number {
  return installmentPaymentAtPeriod(expense, 1);
}

/**
 * 预测日 `asOfDate` 的月供。无 startDate 时视为已从 `anchorDate`（通常今天）起贷。
 * 未开始 / 已还清 → 0。
 */
export function installmentPaymentAsOf(expense: PageInstallmentInput, asOfDate: string, anchorDate: string): number {
  const start = (expense.startDate || anchorDate).slice(0, 10);
  const asOf = asOfDate.slice(0, 10);
  if (asOf < start) return 0;
  const period = calendarMonthsBetween(start, asOf) + 1;
  return installmentPaymentAtPeriod(expense, period);
}

export type InstallmentExplanation = {
  /** 当前还款方式的主公式（中文 + 符号） */
  formula: string;
  /** 代入当前字段后的逐步结果 */
  steps: string[];
  /** 与 installmentMonthlyPayment 一致的当期月供（等额本金=首月） */
  monthly: number;
};

const fmtMoney = (n: number) => Math.round(n).toLocaleString('zh-CN');
const fmtRate = (n: number, digits = 6) => {
  const s = n.toFixed(digits).replace(/\.?0+$/, '');
  return s || '0';
};

/**
 * 分期计算公式 + 代入当前 total/首付/期数/利率/还款方式后的逐步说明。
 * 年数与期数等价展示：n 月 = n/12 年；计算只用月。
 */
export function explainInstallmentPayment(expense: PageInstallmentInput): InstallmentExplanation {
  const total = expense.total || 0;
  const downPayment = Math.min(expense.downPayment || 0, total);
  const principal = Math.max(0, total - downPayment);
  const rawTerm = Math.max(1, Math.round(expense.term || 1) || 1);
  const n = installmentTermMonths(expense);
  const years = n / 12;
  const yearLabel = Number.isInteger(years) ? String(years) : years.toFixed(2);
  const annualPct = expense.interest || 0;
  const r = annualPct / 1200;
  const mode = expense.repaymentMode || 'equal_principal_interest';
  const monthly = installmentMonthlyPayment(expense);

  // 年↔月等价；若输入是年误存（如 30）被归一成月，注明换算
  const termStep = rawTerm !== n
    ? `期数 n = ${n} 月（= ${yearLabel} 年；输入 ${rawTerm} 按年×12）`
    : `期数 n = ${n} 月（= ${yearLabel} 年）`;

  const common: string[] = [
    `本金 P = 总价 − 首付 = ${fmtMoney(total)} − ${fmtMoney(downPayment)} = ${fmtMoney(principal)}`,
    termStep,
    `年化 i = ${annualPct}% ，月利率 r = i/1200 = ${fmtRate(r, 8)}`,
  ];

  if (principal <= 0) {
    return {
      formula: '本金为 0，无月供',
      steps: [...common, '月供 M = 0'],
      monthly: 0,
    };
  }

  if (mode === 'equal_principal') {
    const principalPart = principal / n;
    const first = principalPart + principal * r;
    const last = principalPart + principalPart * r;
    // 等差利息：首月 P·r … 末月 (P/n)·r，合计 P·r·(n+1)/2
    const totalInterest = principal * r * (n + 1) / 2;
    const totalRepay = principal + totalInterest;
    return {
      formula: '等额本金：第 k 月月供 = P/n + 剩余本金·r（首月最高，逐月递减）',
      steps: [
        ...common,
        `每月本金 = P/n = ${fmtMoney(principal)} / ${n} = ${fmtMoney(principalPart)}`,
        `首月月供 = P/n + P·r = ${fmtMoney(principalPart)} + ${fmtMoney(principal * r)} = ${fmtMoney(first)}`,
        `末月月供 ≈ P/n + (P/n)·r = ${fmtMoney(last)}`,
        `总利息 ≈ P·r·(n+1)/2 = ${fmtMoney(totalInterest)}`,
        `总还款 ≈ 本金 + 总利息 = ${fmtMoney(totalRepay)}`,
      ],
      monthly,
    };
  }

  // 等额本息
  if (!r) {
    const m = principal / n;
    return {
      formula: '等额本息（零利率）：M = P / n',
      steps: [
        ...common,
        `月供 M = P / n = ${fmtMoney(principal)} / ${n} = ${fmtMoney(m)}`,
        `总还款 = M·n = ${fmtMoney(m * n)}`,
        '总利息 = 0',
      ],
      monthly,
    };
  }

  const factor = (1 + r) ** n;
  const numerator = principal * r * factor;
  const denominator = factor - 1;
  const m = numerator / denominator;
  const totalRepay = m * n;
  const totalInterest = totalRepay - principal;
  return {
    formula: '等额本息：M = P·r·(1+r)^n / ((1+r)^n − 1)',
    steps: [
      ...common,
      `(1+r)^n = (1+${fmtRate(r, 8)})^${n} = ${fmtRate(factor, 8)}`,
      `分子 = P·r·(1+r)^n = ${fmtMoney(principal)} × ${fmtRate(r, 8)} × ${fmtRate(factor, 8)} = ${fmtMoney(numerator)}`,
      `分母 = (1+r)^n − 1 = ${fmtRate(denominator, 8)}`,
      `月供 M = 分子 / 分母 = ${fmtMoney(m)}`,
      `总还款 = M·n = ${fmtMoney(totalRepay)}`,
      `总利息 = 总还款 − 本金 = ${fmtMoney(totalInterest)}`,
    ],
    monthly,
  };
}
