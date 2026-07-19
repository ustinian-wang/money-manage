import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildRepaymentSchedule,
    calculateDownPayment,
    calculateFinancingAmount,
    calculateMonthlyPayments,
    summarizeInstallmentConsumption,
    getInstallmentTermMonths,
} from './index.ts';
import { termToMonths, type InstallmentConsumption, type InterestPlan } from '../../types/installment.ts';

test('converts installment terms expressed in months or years', () => {
    assert.equal(termToMonths({ value: 36, unit: 'month' }), 36);
    assert.equal(termToMonths({ value: 3, unit: 'year' }), 36);
    assert.equal(getInstallmentTermMonths(consumption({ term: { value: 2, unit: 'year' }, termMonths: undefined })), 24);
});

const plan = (overrides: Partial<InterestPlan> = {}): InterestPlan => ({
    id: 'plan-1', type: 'general', name: '普通分期', principal: 10000,
    annualRate: 0, termMonths: 10, repaymentMode: 'equal_principal_interest', ...overrides,
});
const consumption = (overrides: Partial<InstallmentConsumption> = {}): InstallmentConsumption => ({
    id: 'consumption-1', name: '测试消费', category: 'general', totalPrice: 10000,
    downPayment: { mode: 'amount', amount: 0 }, termMonths: 10,
    interestStructure: { mode: 'single', plans: [plan()] }, ...overrides,
});

test('calculates down payment by amount and ratio', () => {
    assert.equal(calculateDownPayment(consumption({ downPayment: { mode: 'amount', amount: 1200 } })), 1200);
    assert.equal(calculateDownPayment(consumption({ downPayment: { mode: 'ratio', ratio: 20 } })), 2000);
    assert.equal(calculateFinancingAmount(consumption({ downPayment: { mode: 'ratio', ratio: 20 } })), 8000);
});

test('calculates zero-interest equal principal and interest schedule', () => {
    const result = summarizeInstallmentConsumption(consumption());
    assert.equal(result.monthlyPayment, 1000);
    assert.equal(result.totalInterest, 0);
    assert.equal(result.totalRepayment, 10000);
    assert.equal(result.schedule.length, 10);
    assert.equal(result.schedule.at(-1)?.remainingPrincipal, 0);
});

test('calculates equal principal payments with declining interest', () => {
    const result = summarizeInstallmentConsumption(consumption({ interestStructure: {
        mode: 'single', plans: [plan({ annualRate: 12, repaymentMode: 'equal_principal' })],
    } }));
    assert.ok((result.schedule[0]?.payment ?? 0) > (result.schedule[9]?.payment ?? 0));
    assert.ok(result.totalInterest > 0);
    assert.equal(result.schedule.at(-1)?.remainingPrincipal, 0);
});

test('supports fixed monthly payment and truncates final payment', () => {
    const result = summarizeInstallmentConsumption(consumption({ totalPrice: 1000, interestStructure: {
        mode: 'single', plans: [plan({ principal: 1000, termMonths: 3, repaymentMode: 'fixed_payment', fixedMonthlyPayment: 400 })],
    }, termMonths: 3 }));
    assert.equal(result.schedule.length, 3);
    assert.equal(result.schedule.at(-1)?.payment, 200);
    assert.equal(result.schedule.at(-1)?.remainingPrincipal, 0);
});

test('aggregates commercial and provident fund combination loan', () => {
    const result = summarizeInstallmentConsumption(consumption({
        totalPrice: 100000, termMonths: 12,
        interestStructure: { mode: 'combined', plans: [
            plan({ id: 'commercial', type: 'commercial', name: '商业贷款', principal: 60000, annualRate: 6, termMonths: 12 }),
            plan({ id: 'provident', type: 'provident_fund', name: '公积金贷款', principal: 40000, annualRate: 3, termMonths: 12 }),
        ] },
    }));
    assert.equal(result.schedule.filter((entry) => entry.month === 1).length, 2);
    assert.ok(result.monthlyPayment > 0);
    assert.ok(result.totalInterest > 0);
    assert.equal(calculateMonthlyPayments(consumption({
        totalPrice: 100000, termMonths: 12,
        interestStructure: { mode: 'combined', plans: [
            plan({ id: 'commercial', principal: 60000, annualRate: 6, termMonths: 12 }), plan({ id: 'provident', principal: 40000, annualRate: 3, termMonths: 12 }),
        ] },
    })).size, 12);
});

test('supports segmented rates through separate plan schedules', () => {
    const result = summarizeInstallmentConsumption(consumption({
        interestStructure: { mode: 'segmented', plans: [
            plan({ id: 'intro', principal: 5000, termMonths: 5, annualRate: 0, startMonth: 1, endMonth: 5 }),
            plan({ id: 'later', principal: 5000, termMonths: 5, annualRate: 12, startMonth: 6, endMonth: 10 }),
        ] },
    }));
    assert.equal(result.schedule[0]?.month, 1);
    assert.equal(result.schedule.at(-1)?.month, 10);
    assert.ok(result.totalInterest > 0);
});

test('rejects invalid down payment and unmatched plan principals', () => {
    assert.throws(() => calculateDownPayment(consumption({ downPayment: { mode: 'amount', amount: 10001 } })), RangeError);
    assert.throws(() => buildRepaymentSchedule(consumption({ interestStructure: { mode: 'single', plans: [plan({ principal: 9999 })] } })), /does not match/);
});

test('converts installment years to months consistently', () => {
    const yearly = consumption({
        termMonths: undefined,
        term: { value: 3, unit: 'year' },
        interestStructure: { mode: 'single', plans: [plan({ termMonths: undefined, term: 3 * 12 })] },
    });
    assert.equal(getInstallmentTermMonths(yearly), 36);
    assert.equal(summarizeInstallmentConsumption(yearly).schedule.length, 36);
});
