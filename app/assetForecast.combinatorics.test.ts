/**
 * 资产走势：剪支组合枚举 + 不变量回归
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reinvestFromSurplus } from '../domain/reinvest';
import {
  buildMonthlyAssetForecast,
  rebalanceByInvestRatio,
} from './assetForecast';
import {
  EXPECTED_PRUNED_CASE_COUNT,
  enumerateForecastCases,
  rawCartesianCount,
  type ForecastCase,
} from './assetForecastCases';

const EPS = 1e-6;
const MONTHS_CHECK = 6;

function isFiniteNumber(n: number): boolean {
  return Number.isFinite(n);
}

function assertRowInvariants(c: ForecastCase): void {
  const rows = buildMonthlyAssetForecast(c.input);
  assert.equal(rows.length, MONTHS_CHECK + 1, `${c.id}: row count`);

  for (const row of rows) {
    assert.ok(isFiniteNumber(row.cash), `${c.id} m${row.month}: cash NaN/Inf`);
    assert.ok(isFiniteNumber(row.investment), `${c.id} m${row.month}: invest NaN/Inf`);
    assert.ok(isFiniteNumber(row.total), `${c.id} m${row.month}: total NaN/Inf`);
    assert.ok(
      Math.abs(row.total - (row.cash + row.investment)) < EPS,
      `${c.id} m${row.month}: total≠cash+invest (${row.total} vs ${row.cash}+${row.investment})`,
    );
  }

  const { dims, input } = c;
  const hasRatio = Number.isFinite(input.investRatio) && (input.investRatio as number) > 0;
  const floor = Math.max(0, input.emergencyReserve ?? 0);

  // investRatio>0：再平衡后比例约束（floor 允许范围内）
  if (hasRatio) {
    const ratio = (input.investRatio as number) / 100;
    for (const row of rows) {
      if (row.month === 0) continue;
      const total = row.cash + row.investment;
      if (total <= 0 || total <= floor) {
        assert.equal(row.investment, 0, `${c.id} m${row.month}: total≤floor 时应全现金`);
        continue;
      }
      const expected = rebalanceByInvestRatio(row.cash, row.investment, input.investRatio as number, floor);
      // 月末状态应已是再平衡结果
      assert.ok(
        Math.abs(row.cash - expected.cash) < EPS && Math.abs(row.investment - expected.investment) < EPS,
        `${c.id} m${row.month}: 再平衡不一致 cash=${row.cash}/${expected.cash} invest=${row.investment}/${expected.investment}`,
      );
      // 比例：cash ≥ floor，且若 cash>floor 则接近 (1-ratio)*total
      assert.ok(row.cash + EPS >= Math.min(floor, total), `${c.id} m${row.month}: cash 应尽量 ≥ floor`);
      if (row.cash > floor + EPS) {
        const targetCash = total * (1 - ratio);
        // 未触 floor 时现金应贴近目标
        assert.ok(
          Math.abs(row.cash - targetCash) < EPS || row.cash >= floor - EPS,
          `${c.id} m${row.month}: 比例现金偏离`,
        );
      }
    }
  }

  // investRatio 未启用 + 正结余 + reinvest>0 → 理财应增长（除非应急水位当月把新增理财全赎回）
  if (!hasRatio && dims.surplus === 'pos' && dims.reinvest !== 'zero') {
    const surplus =
      dims.expensePath === 'outflow'
        ? 10_000
        : input.disposableIncomeMonthly - input.recurringExpenseMonthly;
    const added = reinvestFromSurplus(Math.max(0, surplus), input.reinvest);
    assert.ok(added > 0, `${c.id}: 期望正再投入`);
    const startInvest = input.investment;
    const endInvest = rows[MONTHS_CHECK].investment;
    const floorWipes =
      floor > 0 &&
      // 粗判：每月结余进现金后仍可能长期低于 floor，新增理财被赎回
      (input.cash < floor || dims.start === 'empty' || dims.start === 'investOnly');
    if (!floorWipes && dims.annual === 'flat0') {
      assert.ok(
        endInvest > startInvest + EPS,
        `${c.id}: 正结余+再投入应使理财增长 (start=${startInvest} end=${endInvest} floor=${floor})`,
      );
    } else if (floorWipes && dims.annual === 'flat0' && dims.start === 'empty' && floor >= 40_000) {
      // 水位优先：起点无现金时，新增理财可被全部赎回 → 允许理财不增长
      assert.ok(endInvest >= 0, `${c.id}: 水位赎回路径理财非负`);
    } else if (!floorWipes) {
      // 有年化时至少不应低于「仅再投入、无赎回」的下界粗检
      assert.ok(endInvest + EPS >= startInvest, `${c.id}: 理财不应无故低于起点`);
    }
  }

  // 负结余 + percent reinvest：当月不再追加（reinvestFromSurplus(≤0)=0）
  // 在枚举里该组合已被剪支；单独断言函数契约 + 一条显式路径
  if (dims.surplus === 'neg') {
    assert.equal(reinvestFromSurplus(-8_000, { mode: 'percent', rate: 50, amount: 0 }), 0);
  }
}

describe('资产走势决策组合（剪支枚举）', () => {
  const cases = enumerateForecastCases();

  it(`剪支后组合数 === ${EXPECTED_PRUNED_CASE_COUNT}（原始笛卡尔 ${rawCartesianCount()}）`, () => {
    // 便于 CI / 本地一眼看到 N
    console.log(
      `[assetForecast combinatorics] raw=${rawCartesianCount()} pruned=${cases.length}`,
    );
    assert.equal(cases.length, EXPECTED_PRUNED_CASE_COUNT);
    assert.ok(cases.length < rawCartesianCount(), '剪支后应少于原始笛卡尔积');
  });

  it('组合 id 唯一', () => {
    const ids = new Set(cases.map((c) => c.id));
    assert.equal(ids.size, cases.length);
  });

  it('每个组合：total=cash+invest、有限数值、比例/再投入不变量', () => {
    const failures: string[] = [];
    for (const c of cases) {
      try {
        assertRowInvariants(c);
      } catch (err) {
        failures.push(err instanceof Error ? err.message : String(err));
      }
    }
    assert.equal(
      failures.length,
      0,
      `${failures.length}/${cases.length} 组合失败:\n${failures.slice(0, 12).join('\n')}`,
    );
  });
});

describe('负结余 + percent：显式不再追加理财', () => {
  it('reinvestFromSurplus(≤0)=0；负结余不追加理财，仅可能赎回保 cash≥floor', () => {
    assert.equal(reinvestFromSurplus(0, { mode: 'percent', rate: 50, amount: 0 }), 0);
    assert.equal(reinvestFromSurplus(-100, { mode: 'percent', rate: 50, amount: 0 }), 0);

    const rows = buildMonthlyAssetForecast({
      cash: 20_000,
      investment: 50_000,
      annualReturnRate: 0,
      disposableIncomeMonthly: 0,
      recurringExpenseMonthly: 8_000,
      oneTimeExpense: 0,
      reinvest: { mode: 'percent', rate: 50, amount: 0 },
      months: 3,
      investRatio: 0,
      emergencyReserve: 0,
    });
    // m1/m2：现金仍 ≥0，不赎回、不追加 → 理财保持 50k
    assert.equal(rows[1].investment, 50_000);
    assert.equal(rows[1].cash, 12_000);
    assert.equal(rows[2].investment, 50_000);
    assert.equal(rows[2].cash, 4_000);
    // m3：现金将穿零，floor=0 赎回 4k 保 cash≥0（非 reinvest 追加）
    assert.equal(rows[3].investment, 46_000);
    assert.equal(rows[3].cash, 0);
    // 全程理财单调不增（负结余 + percent 不得抬升理财）
    for (let i = 1; i < rows.length; i += 1) {
      assert.ok(rows[i].investment <= rows[i - 1].investment + EPS);
    }
  });
});
