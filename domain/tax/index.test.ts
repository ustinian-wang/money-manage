/**
 * 个税 / 工资到手：专项附加扣除、父母上交与税基分离、payroll 合并
 * 需求：广东个税口径 · parentSupport 不进扣除；累进分档税额示意
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildTaxBracketSliceRows,
    calculateParentSupportExpense,
    calculatePayrollTax,
    calculateTax,
    estimateMonthlyTaxFromTaxable,
    findTaxMonthlyBracket,
} from './index';

describe('estimateMonthlyTaxFromTaxable / 分档税额', () => {
    // 速算扣除与分档累加应对齐；命中档标记唯一
    it('分档税额之和等于速算公式，并标记当前档', () => {
        const taxable = 15000;
        const rows = buildTaxBracketSliceRows(taxable);
        const sliceSum = rows.reduce((sum, row) => sum + row.sliceTax, 0);
        assert.equal(estimateMonthlyTaxFromTaxable(taxable), 15000 * 0.2 - 1410);
        assert.ok(Math.abs(sliceSum - estimateMonthlyTaxFromTaxable(taxable)) < 1e-9);
        assert.equal(findTaxMonthlyBracket(taxable).rate, 20);
        assert.equal(rows.filter((row) => row.isCurrent).length, 1);
        assert.equal(rows.find((row) => row.isCurrent)?.range, '12,000 - 25,000');
    });

    it('高档含 35%/45%，与税率表全档一致', () => {
        assert.equal(estimateMonthlyTaxFromTaxable(60000), 60000 * 0.35 - 7160);
        assert.equal(estimateMonthlyTaxFromTaxable(90000), 90000 * 0.45 - 15160);
        assert.equal(findTaxMonthlyBracket(90000).rate, 45);
    });
});

describe('calculateTax 个税', () => {
    it('返回扣除比例、税基、月/年额与估减税额', () => {
        const result = calculateTax({
            grossMonthlyIncome: 20000,
            personalSocialSecurityMonthly: 2000,
            deductions: {
                rent: { enabled: true, deductionRate: 100, deductionBaseMonthly: 1500 },
                elderlySupport: { enabled: true, deductionRate: 50, deductionBaseMonthly: 2000 },
            },
        });
        const elderly = result.deductions.find((item) => item.key === 'elderlySupport');
        assert.ok(elderly);
        assert.equal(elderly.deductionRate, 50);
        assert.equal(elderly.deductionBaseMonthly, 2000);
        assert.equal(elderly.actualMonthlyAmount, 1000);
        assert.equal(elderly.actualAnnualAmount, 12000);
        assert.ok((elderly.estimatedMonthlyTaxReduction || 0) > 0);
        assert.equal(result.estimatedAnnualTax, result.estimatedMonthlyTax * 12);
    });

    it('父母上交现金不进税前扣除', () => {
        const withoutElderly = calculateTax({
            grossMonthlyIncome: 20000,
            personalSocialSecurityMonthly: 2000,
            deductions: {},
        });
        const withParentCashflow = calculateTax({
            grossMonthlyIncome: 20000,
            personalSocialSecurityMonthly: 2000,
            deductions: {},
        });
        assert.equal(withParentCashflow.estimatedMonthlyTax, withoutElderly.estimatedMonthlyTax);
        assert.equal(withParentCashflow.parentSupportExcludedFromDeductions, true);
        assert.equal(calculateParentSupportExpense({ mode: 'fixed', fixedMonthlyAmount: 3000 }, 20000), 3000);
        assert.equal(calculateParentSupportExpense({ mode: 'percentage', incomePercentage: 10 }, 20000), 2000);
    });

    it('工资到手 = 税前 − 个人五险一金 − 个税', () => {
        const result = calculatePayrollTax({
            grossMonthlyIncome: 20000,
            personalSocialSecurityMonthly: 3100,
            companySocialSecurityMonthly: 5740,
            deductions: {},
            systemDeductionSelections: {
                rent: { enabled: true, monthlyAmount: 1500, allocationRate: 100 },
                elderlySupport: { enabled: true, monthlyAmount: 2000, allocationRate: 50 },
            },
        });
        assert.equal(result.personalFiveInsuranceAndHousingFund, 3100);
        assert.equal(
            result.actualTakeHomePay,
            result.grossMonthlyIncome - 3100 - result.estimatedMonthlyTax,
        );
        assert.equal(result.companySocialSecurityMonthly, 5740);
        assert.equal(
            result.deductions.find((item) => item.key === 'elderlySupport')?.actualMonthlyAmount,
            1000,
        );
    });
});
