import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildMonthlyAssetForecast, yearlyTotalsFromMonthly } from './assetForecast';

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
