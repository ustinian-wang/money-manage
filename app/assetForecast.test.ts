import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assetAxisBounds,
  buildMonthlyAssetForecast,
  rebalanceByInvestRatio,
  yearlyTotalsFromMonthly,
} from './assetForecast';

const noReinvestment = { mode: 'amount' as const, rate: 0, amount: 0 };

describe('buildMonthlyAssetForecast', () => {
  it('counts investment return once instead of adding it to cash and investment', () => {
    const rows = buildMonthlyAssetForecast({
      cash: 0,
      investment: 120_000,
      annualReturnRate: 12,
      disposableIncomeMonthly: 0,
      recurringExpenseMonthly: 0,
      oneTimeExpense: 0,
      reinvest: noReinvestment,
      months: 12,
    });

    assert.ok(rows[12].investment > 133_000);
    assert.ok(rows[12].investment < 135_000);
    assert.equal(rows[12].cash, 0);
    assert.equal(rows[12].total, rows[12].investment);
  });

  it('lets a negative monthly surplus consume cash', () => {
    const rows = buildMonthlyAssetForecast({
      cash: 100_000,
      investment: 0,
      annualReturnRate: 0,
      disposableIncomeMonthly: 10_000,
      recurringExpenseMonthly: 15_000,
      oneTimeExpense: 0,
      reinvest: noReinvestment,
      months: 12,
    });

    assert.equal(rows[12].cash, 40_000);
    assert.equal(rows[12].total, 40_000);
  });

  it('deducts one-time expense only in the first projected month', () => {
    const rows = buildMonthlyAssetForecast({
      cash: 100_000,
      investment: 0,
      annualReturnRate: 0,
      disposableIncomeMonthly: 10_000,
      recurringExpenseMonthly: 8_000,
      oneTimeExpense: 5_000,
      reinvest: noReinvestment,
      months: 2,
    });

    assert.equal(rows[1].cash, 97_000);
    assert.equal(rows[2].cash, 99_000);
  });
});

describe('yearlyTotalsFromMonthly', () => {
  it('uses the same monthly model for yearly comparison checkpoints', () => {
    const rows = yearlyTotalsFromMonthly({
      cash: 100_000,
      investment: 0,
      annualReturnRate: 0,
      disposableIncomeMonthly: 10_000,
      recurringExpenseMonthly: 15_000,
      oneTimeExpense: 0,
      reinvest: noReinvestment,
      years: 2,
    });

    assert.deepEqual(rows.map((row) => row.total), [100_000, 40_000, -20_000]);
  });
});

describe('assetAxisBounds', () => {
  it('keeps negative assets visible instead of clipping the chart at zero', () => {
    assert.deepEqual(assetAxisBounds([100_000, 40_000, -20_000]), {
      min: -100_000,
      max: 100_000,
    });
  });
});

describe('buildMonthlyAssetForecast recurringSurplusAtMonth', () => {
  it('从某月起用更高结余，不影响固定口径入参语义', () => {
    const rows = buildMonthlyAssetForecast({
      cash: 100_000,
      investment: 0,
      annualReturnRate: 0,
      disposableIncomeMonthly: 10_000,
      recurringExpenseMonthly: 8_000,
      oneTimeExpense: 0,
      reinvest: noReinvestment,
      months: 3,
      // month1–2: 结余 2000；month3+: 结余 5000（模拟加薪）
      recurringSurplusAtMonth: (month) => (month >= 3 ? 5000 : 2000),
    });
    assert.equal(rows[1].cash, 102_000);
    assert.equal(rows[2].cash, 104_000);
    assert.equal(rows[3].cash, 109_000);
  });
});

describe('buildMonthlyAssetForecast annualReturnRateAtMonth', () => {
  it('从某月起用更高年化，理财余额高于全程 0%', () => {
    const flat = buildMonthlyAssetForecast({
      cash: 0,
      investment: 100_000,
      annualReturnRate: 0,
      disposableIncomeMonthly: 0,
      recurringExpenseMonthly: 0,
      oneTimeExpense: 0,
      reinvest: noReinvestment,
      months: 12,
    });
    const stepped = buildMonthlyAssetForecast({
      cash: 0,
      investment: 100_000,
      annualReturnRate: 0,
      disposableIncomeMonthly: 0,
      recurringExpenseMonthly: 0,
      oneTimeExpense: 0,
      reinvest: noReinvestment,
      months: 12,
      // month≥7 → 12% 年化（模拟计划变更）
      annualReturnRateAtMonth: (month) => (month >= 7 ? 12 : 0),
    });
    assert.equal(flat[12].investment, 100_000);
    assert.ok(stepped[12].investment > flat[12].investment);
    assert.ok(stepped[6].investment === 100_000);
  });
});

/**
 * 资产分解不变量：最终 = 闲置(cash) + 理财；备用金=cash。
 * 负结余先吃现金，cash < floor 时从理财赎回补水位；理财赎光仍不够才允许 cash < floor。
 */
describe('buildMonthlyAssetForecast 资产恒等式与税前下调', () => {
  it('任意月 total === cash + investment', () => {
    const rows = buildMonthlyAssetForecast({
      cash: 50_000,
      investment: 120_000,
      annualReturnRate: 5,
      disposableIncomeMonthly: 15_000,
      recurringExpenseMonthly: 12_000,
      oneTimeExpense: 0,
      reinvest: { mode: 'percent', rate: 30, amount: 0 },
      months: 36,
      recurringSurplusAtMonth: (month) => (month >= 13 ? -5000 : 3000),
    });
    for (const row of rows) {
      assert.ok(
        Math.abs(row.total - (row.cash + row.investment)) < 1e-6,
        `month ${row.month}: total=${row.total} cash+invest=${row.cash + row.investment}`,
      );
    }
  });

  it('税前下调负结余：无目标水位时赎回理财保 cash≥0，正常不出现 total < investment', () => {
    // month≥13 结余 -5000；floor 缺省 0；36 月内理财未赎光
    const rows = buildMonthlyAssetForecast({
      cash: 50_000,
      investment: 120_000,
      annualReturnRate: 5,
      disposableIncomeMonthly: 15_000,
      recurringExpenseMonthly: 12_000,
      oneTimeExpense: 0,
      reinvest: noReinvestment,
      months: 36,
      recurringSurplusAtMonth: (month) => (month >= 13 ? -5000 : 3000),
    });
    for (const row of rows) {
      assert.ok(row.cash >= 0, `month ${row.month}: 理财未尽时 cash 应 ≥0`);
      assert.ok(row.total >= row.investment - 1e-6, `month ${row.month}: cash≥0 ⇒ total≥invest`);
      assert.ok(Math.abs(row.total - (row.cash + row.investment)) < 1e-6);
    }
    // 负结余阶段应已从理财赎回（相对仅复利、不赎回的峰值下降）
    assert.ok(rows[36].investment < rows[12].investment, '负结余应赎回理财补现金');
    assert.equal(rows[36].cash, 0);
  });

  it('负结余：有应急目标时赎回理财使 cash≥floor', () => {
    const floor = 40_000;
    // 起点已在水位；每月 -8000 → 先扣现金再赎回补回 floor
    const rows = buildMonthlyAssetForecast({
      cash: floor,
      investment: 100_000,
      annualReturnRate: 0,
      disposableIncomeMonthly: 0,
      recurringExpenseMonthly: 8_000,
      oneTimeExpense: 0,
      reinvest: noReinvestment,
      months: 3,
      emergencyReserve: floor,
    });
    assert.equal(rows[1].cash, floor);
    assert.equal(rows[1].investment, 92_000);
    assert.equal(rows[2].cash, floor);
    assert.equal(rows[2].investment, 84_000);
    assert.equal(rows[3].cash, floor);
    assert.equal(rows[3].investment, 76_000);
    for (const row of rows) {
      assert.ok(row.cash >= floor || row.investment === 0);
      assert.ok(Math.abs(row.total - (row.cash + row.investment)) < 1e-6);
    }
  });

  it('理财赎光仍不够：允许 cash < floor（含穿零）', () => {
    // invest 仅 5k，floor=20k，每月 -10k → 首月赎光后只能继续吃现金
    const rows = buildMonthlyAssetForecast({
      cash: 20_000,
      investment: 5_000,
      annualReturnRate: 0,
      disposableIncomeMonthly: 0,
      recurringExpenseMonthly: 10_000,
      oneTimeExpense: 0,
      reinvest: noReinvestment,
      months: 3,
      emergencyReserve: 20_000,
    });
    assert.equal(rows[1].investment, 0);
    assert.equal(rows[1].cash, 15_000); // 20k-10k+5k redeem
    assert.ok(rows[1].cash < 20_000);
    assert.equal(rows[2].cash, 5_000);
    assert.equal(rows[3].cash, -5_000); // 理财已尽，继续穿零
    assert.ok(rows[3].total < rows[3].investment); // invest=0、cash 负 → total < invest
  });
});

describe('buildMonthlyAssetForecast 按月扣款 + 理财比例再平衡', () => {
  it('首月扣首付后总资产下降，并按比例拆分', () => {
    const rows = buildMonthlyAssetForecast({
      cash: 562_500,
      investment: 337_500,
      annualReturnRate: 0,
      disposableIncomeMonthly: 0,
      recurringExpenseMonthly: 0,
      oneTimeExpense: 0,
      reinvest: noReinvestment,
      months: 2,
      investRatio: 50,
      emergencyReserve: 0,
      expenseOutflowAtMonth: (month) => (month === 1 ? 300_000 : month === 2 ? 1_945 : 0),
      incomeAtMonth: () => 0,
    });
    // month0: 900k
    assert.equal(rows[0].total, 900_000);
    // month1: 900k - 300k = 600k，再 50/50
    assert.equal(rows[1].total, 600_000);
    assert.equal(rows[1].investment, 300_000);
    assert.equal(rows[1].cash, 300_000);
    // month2: 600k - 1945，再 50/50
    assert.ok(Math.abs(rows[2].total - (600_000 - 1_945)) < 0.01);
    assert.ok(Math.abs(rows[2].investment - rows[2].cash) < 0.01);
  });

  it('investRatio=0 时走 reinvest，正结余若干月后理财 > 0', () => {
    const rows = buildMonthlyAssetForecast({
      cash: 0,
      investment: 0,
      annualReturnRate: 0,
      disposableIncomeMonthly: 10_000,
      recurringExpenseMonthly: 0,
      oneTimeExpense: 0,
      reinvest: { mode: 'percent', rate: 50, amount: 0 },
      months: 6,
      investRatio: 0,
      emergencyReserve: 0,
    });
    // 每月结余 10k，50% 投入 → 6 个月理财应累积 30k
    assert.ok(rows[6].investment > 0);
    assert.ok(Math.abs(rows[6].investment - 30_000) < 0.01);
    assert.ok(Math.abs(rows[6].cash - 30_000) < 0.01);
  });

  it('investRatio=0 + 结余50%：逐月理财=累计结余×50%（贴近用户画像）', () => {
    // takeHome 26000，支出 4600 → 月结余 21400；50% → 10700 进理财
    const income = 26_000;
    const expense = 4_600;
    const surplus = income - expense;
    const rows = buildMonthlyAssetForecast({
      cash: 0,
      investment: 0,
      annualReturnRate: 0,
      disposableIncomeMonthly: income,
      recurringExpenseMonthly: 0,
      oneTimeExpense: 0,
      reinvest: { mode: 'percent', rate: 50, amount: 0 },
      months: 3,
      investRatio: 0,
      emergencyReserve: 0,
      incomeAtMonth: () => income,
      expenseOutflowAtMonth: () => expense,
    });
    assert.equal(rows[0].investment, 0);
    assert.equal(rows[0].cash, 0);
    for (const m of [1, 2, 3]) {
      const expectedInvest = surplus * 0.5 * m;
      const expectedCash = surplus * 0.5 * m;
      assert.ok(
        Math.abs(rows[m].investment - expectedInvest) < 0.01,
        `month ${m}: investment ${rows[m].investment} ≠ ${expectedInvest}`,
      );
      assert.ok(
        Math.abs(rows[m].cash - expectedCash) < 0.01,
        `month ${m}: cash ${rows[m].cash} ≠ ${expectedCash}`,
      );
      assert.ok(
        Math.abs(rows[m].total - surplus * m) < 0.01,
        `month ${m}: total 应为累计结余`,
      );
    }
  });

  it('未传 investRatio 时同样走 reinvest（结余一半进理财）', () => {
    const rows = buildMonthlyAssetForecast({
      cash: 0,
      investment: 0,
      annualReturnRate: 0,
      disposableIncomeMonthly: 8_000,
      recurringExpenseMonthly: 0,
      oneTimeExpense: 0,
      reinvest: { mode: 'percent', rate: 50, amount: 0 },
      months: 1,
      emergencyReserve: 0,
    });
    assert.equal(rows[1].investment, 4_000);
    assert.equal(rows[1].cash, 4_000);
  });

  it('investRatio=50 时仍按比例再平衡（忽略 reinvest）', () => {
    const rows = buildMonthlyAssetForecast({
      cash: 0,
      investment: 0,
      annualReturnRate: 0,
      disposableIncomeMonthly: 10_000,
      recurringExpenseMonthly: 0,
      oneTimeExpense: 0,
      reinvest: { mode: 'percent', rate: 50, amount: 0 },
      months: 2,
      investRatio: 50,
      emergencyReserve: 0,
    });
    // 结余进现金后按 50/50 拆，不走 reinvest 的「仅投 50% 结余」
    assert.equal(rows[1].total, 10_000);
    assert.equal(rows[1].investment, 5_000);
    assert.equal(rows[1].cash, 5_000);
    assert.equal(rows[2].total, 20_000);
    assert.equal(rows[2].investment, 10_000);
    assert.equal(rows[2].cash, 10_000);
  });

  it('investRatio=0 + 负结余：reinvest 不投、现金下降；有 floor 时可从理财赎回', () => {
    // 负结余时 reinvestFromSurplus → 0，不因 rate=100 误投
    const noFloor = buildMonthlyAssetForecast({
      cash: 50_000,
      investment: 20_000,
      annualReturnRate: 0,
      disposableIncomeMonthly: 0,
      recurringExpenseMonthly: 5_000,
      oneTimeExpense: 0,
      reinvest: { mode: 'percent', rate: 100, amount: 0 },
      months: 2,
      investRatio: 0,
      emergencyReserve: 0,
    });
    assert.equal(noFloor[1].investment, 20_000);
    assert.equal(noFloor[1].cash, 45_000);
    assert.equal(noFloor[2].cash, 40_000);
    assert.equal(noFloor[2].investment, 20_000);

    const floor = 40_000;
    const withFloor = buildMonthlyAssetForecast({
      cash: floor,
      investment: 30_000,
      annualReturnRate: 0,
      disposableIncomeMonthly: 0,
      recurringExpenseMonthly: 8_000,
      oneTimeExpense: 0,
      reinvest: { mode: 'percent', rate: 100, amount: 0 },
      months: 2,
      investRatio: 0,
      emergencyReserve: floor,
    });
    assert.equal(withFloor[1].cash, floor);
    assert.equal(withFloor[1].investment, 22_000); // 30k − 8k 赎回
    assert.equal(withFloor[2].cash, floor);
    assert.equal(withFloor[2].investment, 14_000);
  });

  it('investRatio 为 NaN 时走 reinvest（与未传同路径）', () => {
    const rows = buildMonthlyAssetForecast({
      cash: 0,
      investment: 0,
      annualReturnRate: 0,
      disposableIncomeMonthly: 8_000,
      recurringExpenseMonthly: 0,
      oneTimeExpense: 0,
      reinvest: { mode: 'percent', rate: 50, amount: 0 },
      months: 1,
      investRatio: Number.NaN,
      emergencyReserve: 0,
    });
    assert.equal(rows[1].investment, 4_000);
    assert.equal(rows[1].cash, 4_000);
  });
});

describe('rebalanceByInvestRatio', () => {
  it('再平衡后 cash≥floor；total≤floor 时全现金', () => {
    // 50% 目标会使 cash=40k < floor=60k → 抬升 cash 到 floor
    assert.deepEqual(rebalanceByInvestRatio(100_000, 0, 50, 60_000), {
      cash: 60_000,
      investment: 40_000,
    });
    // total 刚好等于 floor → 全现金
    assert.deepEqual(rebalanceByInvestRatio(20_000, 20_000, 80, 40_000), {
      cash: 40_000,
      investment: 0,
    });
    // total < floor → 全现金（无法再拆理财）
    assert.deepEqual(rebalanceByInvestRatio(10_000, 5_000, 50, 30_000), {
      cash: 15_000,
      investment: 0,
    });
  });

  it('investRatio>0 + floor：经 buildMonthlyAssetForecast 后 cash≥floor', () => {
    const floor = 50_000;
    // 起点 100k 全现金；占比 80% 目标 cash=20k，但 floor 抬到 50k
    const rows = buildMonthlyAssetForecast({
      cash: 100_000,
      investment: 0,
      annualReturnRate: 0,
      disposableIncomeMonthly: 0,
      recurringExpenseMonthly: 0,
      oneTimeExpense: 0,
      reinvest: noReinvestment,
      months: 1,
      investRatio: 80,
      emergencyReserve: floor,
    });
    assert.equal(rows[1].total, 100_000);
    assert.equal(rows[1].cash, floor);
    assert.equal(rows[1].investment, 50_000);
    assert.ok(rows[1].cash >= floor);
  });
});
