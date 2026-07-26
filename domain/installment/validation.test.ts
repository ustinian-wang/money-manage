/**
 * 分期入参校验：非负、期数、首付上限、fixed_payment
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    assertNonNegative,
    toMonthCount,
    validateConsumption,
    validateInterestPlan,
} from './validation';
import type { InstallmentConsumption, InterestPlan } from '../../types/installment';

const plan = (overrides: Partial<InterestPlan> = {}): InterestPlan => ({
    id: 'p1',
    name: 'plan',
    type: 'general',
    principal: 1000,
    annualRate: 0,
    termMonths: 12,
    repaymentMode: 'equal_principal_interest',
    ...overrides,
});

const consumption = (overrides: Partial<InstallmentConsumption> = {}): InstallmentConsumption => ({
    id: 'c1',
    name: 't',
    category: 'general',
    totalPrice: 1000,
    downPayment: { mode: 'amount', amount: 0 },
    termMonths: 12,
    interestStructure: { mode: 'single', plans: [plan()] },
    ...overrides,
});

describe('installment validation', () => {
    test('toMonthCount / assertNonNegative', () => {
        assert.equal(toMonthCount(2, 'year'), 24);
        assert.equal(toMonthCount(NaN), 0);
        assert.throws(() => assertNonNegative(-1, 'x'), /non-negative/);
    });

    test('validateInterestPlan 拒绝非法期数与零固定还款', () => {
        assert.throws(() => validateInterestPlan(plan({ termMonths: 0 })), /termMonths/);
        assert.throws(
            () => validateInterestPlan(plan({ repaymentMode: 'fixed_payment', fixedMonthlyPayment: 0 })),
            /fixedMonthlyPayment/,
        );
    });

    test('validateConsumption 拒绝超首付与非法比例', () => {
        assert.throws(
            () => validateConsumption(consumption({ downPayment: { mode: 'amount', amount: 1001 } })),
            /down payment/,
        );
        assert.throws(
            () => validateConsumption(consumption({ downPayment: { mode: 'ratio', ratio: 101 } })),
            /ratio/,
        );
        validateConsumption(consumption()); // 合法不抛
    });
});
