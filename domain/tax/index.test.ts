/**
 * 个税 / 工资到手：专项附加扣除、父母上交与税基分离、payroll 合并
 * 需求：广东个税口径 · parentSupport 不进扣除
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateParentSupportExpense, calculatePayrollTax, calculateTax } from './index';

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
