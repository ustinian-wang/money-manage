import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRepaymentSchedule, calculateCombinedLoan, calculatePayment, calculateConsumption } from './calculator.ts';

const plan = (overrides = {}) => ({ id: 'p1', type: 'general' as const, name: '普通分期', principal: 10000, annualRate: 0, term: 10, ...overrides });

test('支持零利率等额本息', () => assert.equal(calculatePayment(12000, 0, 12, 'equal_principal_interest'), 1000));

test('等额本息逐月还款并归零本金', () => {
    const result = calculateCombinedLoan([plan({ annualRate: 12, term: 10 })], 10000);
    assert.equal(result.schedule.length, 10);
    assert.ok(Math.abs(result.schedule.at(-1)!.remainingPrincipal) < 0.01);
    assert.ok(result.totalInterest > 0);
});

test('等额本金每期本金相同', () => {
    const rows = buildRepaymentSchedule([plan({ term: 4, repaymentMode: 'equal_principal' })], 10000);
    assert.deepEqual(rows.map((row) => row.principal), [2500, 2500, 2500, 2500]);
});

test('固定月供支持剩余本金计划', () => {
    const rows = buildRepaymentSchedule([plan({ annualRate: 12, term: 36, repaymentMode: 'fixed_payment', fixedMonthlyPayment: 500 })], 10000);
    assert.ok(rows.length > 12);
    assert.ok(rows.at(-1)!.remainingPrincipal < 0.01);
});

test('组合商业贷款和公积金贷款', () => {
    const result = calculateCombinedLoan([plan({ id: 'commercial', type: 'commercial', principal: 7000, annualRate: 4.2 }), plan({ id: 'fund', type: 'provident_fund', principal: 3000, annualRate: 2.85 })], 10000);
    assert.equal(result.schedule.length, 20);
    assert.ok(result.monthlyPayment > 0);
});

test('本金不匹配时拒绝组合方案', () => assert.throws(() => calculateCombinedLoan([plan({ principal: 9000 })], 10000), /本金合计/));

test('多段利率按开始和结束月份生成计划', () => {
    const rows = buildRepaymentSchedule([plan({ principal: 5000, term: 6, startMonth: 1, endMonth: 3 }), plan({ id: 'p2', principal: 5000, term: 3, startMonth: 4, endMonth: 6 })], 10000);
    assert.deepEqual(rows.map((row) => row.month), [1, 2, 3, 4, 5, 6]);
});

test('全款消费没有分期计划', () => {
    const result = calculateConsumption({ id: 'cash', name: '全款', category: 'general', totalPrice: 1000, downPayment: { mode: 'amount', amount: 1000, ratio: 100 }, term: { value: 12, unit: 'month' }, interestStructure: { mode: 'single', repaymentMode: 'equal_principal_interest', plans: [] } });
    assert.deepEqual(result.schedule, []);
});

test('分期期限按年输入时换算为月份', () => {
    const result = calculateConsumption({
        id: 'yearly', name: '三年分期', category: 'general', totalPrice: 12000,
        downPayment: { mode: 'amount', amount: 0 }, term: { value: 3, unit: 'year' },
        interestStructure: {
            mode: 'single', repaymentMode: 'equal_principal_interest',
            plans: [plan({ principal: 12000, term: 36 })],
        },
    });
    assert.equal(result.schedule.length, 36);
});
