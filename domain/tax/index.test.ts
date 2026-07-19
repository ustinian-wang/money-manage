import { calculateParentSupportExpense, calculatePayrollTax, calculateTax } from './index';

describe('calculateTax', () => {
    it('returns deduction rate, base, monthly/yearly amount and estimated reduction', () => {
        const result = calculateTax({
            grossMonthlyIncome: 20000,
            personalSocialSecurityMonthly: 2000,
            deductions: {
                rent: { enabled: true, deductionRate: 100, deductionBaseMonthly: 1500 },
                elderlySupport: { enabled: true, deductionRate: 50, deductionBaseMonthly: 2000 },
            },
        });
        const elderly = result.deductions.find((item) => item.key === 'elderlySupport');
        expect(elderly).toEqual(expect.objectContaining({ deductionRate: 50, deductionBaseMonthly: 2000, actualMonthlyAmount: 1000, actualAnnualAmount: 12000 }));
        expect((elderly?.estimatedMonthlyTaxReduction || 0)).toBeGreaterThan(0);
        expect(result.estimatedAnnualTax).toBe(result.estimatedMonthlyTax * 12);
    });

    it('keeps parent support expense separate from elderly support deduction', () => {
        const withoutElderly = calculateTax({ grossMonthlyIncome: 20000, personalSocialSecurityMonthly: 2000, deductions: {} });
        const withParentCashflow = calculateTax({ grossMonthlyIncome: 20000, personalSocialSecurityMonthly: 2000, deductions: {} });
        expect(withParentCashflow.estimatedMonthlyTax).toBe(withoutElderly.estimatedMonthlyTax);
        expect(withParentCashflow.parentSupportExcludedFromDeductions).toBe(true);
        expect(calculateParentSupportExpense({ mode: 'fixed', fixedMonthlyAmount: 3000 }, 20000)).toBe(3000);
        expect(calculateParentSupportExpense({ mode: 'percentage', incomePercentage: 10 }, 20000)).toBe(2000);
    });

    it('builds one take-home pay result from tax and employee contributions', () => {
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
        expect(result.personalFiveInsuranceAndHousingFund).toBe(3100);
        expect(result.actualTakeHomePay).toBe(result.grossMonthlyIncome - 3100 - result.estimatedMonthlyTax);
        expect(result.companySocialSecurityMonthly).toBe(5740);
        expect(result.deductions.find((item) => item.key === 'elderlySupport')?.actualMonthlyAmount).toBe(1000);
    });
});
