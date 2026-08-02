/**
 * 资产走势决策组合：按分支剪支后的离散笛卡尔积。
 * 供 combinatorics 测试枚举与不变量检查。
 *
 * 文件名避免 `*.cases.ts`：node 的 path.extname 会把 `.cases` 当成扩展名，
 * 导致 tests/ts-ext-resolve.mjs 无法补全 `.ts`。
 */
import type { AssetForecastInput } from './assetForecast';
import type { ReinvestSetting } from '../domain/reinvest';

/** investRatio 输入面：未传 / 0 / >0（行为上 未传≡0，但保留 API 面） */
export type InvestRatioDim = 'omit' | 'zero' | 'ratio50';
/** 再投入：结余 50% / 固定额 / 不投入 */
export type ReinvestDim = 'percent50' | 'amount2k' | 'zero';
/** 经营结余符号 */
export type SurplusDim = 'pos' | 'zero' | 'neg';
/** 应急水位 */
export type FloorDim = 'none' | 'withFloor';
/** 支出路径 */
export type ExpensePathDim = 'recurring' | 'outflow';
/** 年化 */
export type AnnualDim = 'flat0' | 'pct12';
/** 起点资产 */
export type StartDim = 'empty' | 'cashOnly' | 'investOnly' | 'both';

export type ForecastCaseDims = {
  investRatio: InvestRatioDim;
  reinvest: ReinvestDim;
  surplus: SurplusDim;
  floor: FloorDim;
  expensePath: ExpensePathDim;
  annual: AnnualDim;
  start: StartDim;
};

export type ForecastCase = {
  id: string;
  dims: ForecastCaseDims;
  /** 剪支原因标记（调试用） */
  prunedAs?: string;
  input: AssetForecastInput;
};

const REINVEST: Record<ReinvestDim, ReinvestSetting> = {
  percent50: { mode: 'percent', rate: 50, amount: 0 },
  amount2k: { mode: 'amount', rate: 0, amount: 2_000 },
  zero: { mode: 'amount', rate: 0, amount: 0 },
};

const SURPLUS_MONTHLY: Record<SurplusDim, number> = {
  pos: 10_000,
  zero: 0,
  neg: -8_000,
};

const START: Record<StartDim, { cash: number; investment: number }> = {
  empty: { cash: 0, investment: 0 },
  cashOnly: { cash: 50_000, investment: 0 },
  investOnly: { cash: 0, investment: 80_000 },
  both: { cash: 40_000, investment: 60_000 },
};

const FLOOR: Record<FloorDim, number> = {
  none: 0,
  withFloor: 40_000,
};

function hasRatioMode(d: InvestRatioDim): boolean {
  return d === 'ratio50';
}

function reinvestActive(d: ReinvestDim): boolean {
  return d !== 'zero';
}

/** 年化是否可能影响结果（否则与 flat0 等价） */
function annualCanMatter(dims: ForecastCaseDims): boolean {
  if (dims.annual === 'flat0') return true; // 代表元本身保留
  const startInvest = START[dims.start].investment > 0;
  if (startInvest) return true;
  // 起点无理财时：只有能新增理财才可能感受年化
  if (dims.surplus !== 'pos') return false;
  if (hasRatioMode(dims.investRatio)) return true;
  return reinvestActive(dims.reinvest);
}

/**
 * 剪支规则（合法且行为可区分的组合）：
 * 1. investRatio>0 时忽略 reinvest → 只保留 reinvest=zero 为代表
 * 2. 非比例路径且结余≤0 时 reinvestFromSurplus 恒 0 → 只保留 reinvest=zero
 * 3. 年化对「全程理财余额恒为 0」的路径无影响 → 丢掉 pct12
 * 4. investRatio omit 与 zero 行为等价，但保留两者作 API 面回归（不剪）
 */
export function enumerateForecastCases(): ForecastCase[] {
  const investRatios: InvestRatioDim[] = ['omit', 'zero', 'ratio50'];
  const reinvests: ReinvestDim[] = ['percent50', 'amount2k', 'zero'];
  const surpluses: SurplusDim[] = ['pos', 'zero', 'neg'];
  const floors: FloorDim[] = ['none', 'withFloor'];
  const paths: ExpensePathDim[] = ['recurring', 'outflow'];
  const annuals: AnnualDim[] = ['flat0', 'pct12'];
  const starts: StartDim[] = ['empty', 'cashOnly', 'investOnly', 'both'];

  const out: ForecastCase[] = [];

  for (const investRatio of investRatios) {
    for (const reinvest of reinvests) {
      for (const surplus of surpluses) {
        for (const floor of floors) {
          for (const expensePath of paths) {
            for (const annual of annuals) {
              for (const start of starts) {
                const dims: ForecastCaseDims = {
                  investRatio,
                  reinvest,
                  surplus,
                  floor,
                  expensePath,
                  annual,
                  start,
                };

                // 剪支 1：比例再平衡忽略 reinvest
                if (hasRatioMode(investRatio) && reinvest !== 'zero') continue;

                // 剪支 2：结余≤0 时再投入额恒 0
                if (!hasRatioMode(investRatio) && surplus !== 'pos' && reinvest !== 'zero') {
                  continue;
                }

                // 剪支 3：年化无效组合
                if (annual === 'pct12' && !annualCanMatter(dims)) continue;

                out.push({
                  id: [
                    investRatio,
                    reinvest,
                    surplus,
                    floor,
                    expensePath,
                    annual,
                    start,
                  ].join('|'),
                  dims,
                  input: buildInput(dims),
                });
              }
            }
          }
        }
      }
    }
  }

  return out;
}

/** 未剪支的原始笛卡尔积大小（文档用） */
export function rawCartesianCount(): number {
  return 3 * 3 * 3 * 2 * 2 * 2 * 4; // 864
}

export function buildInput(dims: ForecastCaseDims): AssetForecastInput {
  const { cash, investment } = START[dims.start];
  const monthlySurplus = SURPLUS_MONTHLY[dims.surplus];
  const income = 20_000;
  const recurringExpense = income - monthlySurplus;
  const emergencyReserve = FLOOR[dims.floor];
  const annualReturnRate = dims.annual === 'pct12' ? 12 : 0;

  const base: AssetForecastInput = {
    cash,
    investment,
    annualReturnRate,
    disposableIncomeMonthly: income,
    recurringExpenseMonthly: dims.expensePath === 'recurring' ? recurringExpense : 0,
    oneTimeExpense: 0,
    reinvest: REINVEST[dims.reinvest],
    months: 6,
    emergencyReserve,
  };

  if (dims.investRatio === 'zero') base.investRatio = 0;
  if (dims.investRatio === 'ratio50') base.investRatio = 50;

  if (dims.expensePath === 'outflow') {
    const outflow = income - monthlySurplus;
    base.incomeAtMonth = () => income;
    base.expenseOutflowAtMonth = () => outflow;
    // recurring 字段在 outflow 路径下不参与结余，置 0 避免误读
    base.recurringExpenseMonthly = 0;
  }

  return base;
}

/** 剪支后期望组合数（与 enumerateForecastCases().length 对齐，作回归锚点） */
export const EXPECTED_PRUNED_CASE_COUNT = 352;
