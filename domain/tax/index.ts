import type {
    PayrollTaxInput,
    PayrollTaxResult,
    TaxCalculation,
    TaxDeductionBreakdown,
    TaxDeductionInput,
    TaxDeductionKey,
    TaxInput,
} from '../../types/tax';

const DEDUCTION_KEYS: Exclude<TaxDeductionKey, 'basic'>[] = [
    'rent', 'elderlySupport', 'childrenEducation', 'continuingEducation',
    'housingLoanInterest', 'seriousMedical', 'infantCare',
];

const clampRate = (value: number | undefined): number => Math.min(100, Math.max(0, Number.isFinite(value) ? value as number : 0));
const nonNegative = (value: number | undefined): number => Number.isFinite(value) ? Math.max(0, value as number) : 0;

function monthlyBase(input: TaxDeductionInput | undefined): number {
    if (!input) return 0;
    return nonNegative(input.deductionBaseMonthly ?? (input.deductionBaseAnnual || 0) / 12);
}

function estimateTax(monthlyTaxableIncome: number, marginalTaxRate?: number): number {
    const taxable = nonNegative(monthlyTaxableIncome);
    if (marginalTaxRate !== undefined) return taxable * clampRate(marginalTaxRate) / 100;
    if (taxable <= 3000) return taxable * 0.03;
    if (taxable <= 12000) return taxable * 0.1 - 210;
    if (taxable <= 25000) return taxable * 0.2 - 1410;
    if (taxable <= 35000) return taxable * 0.25 - 2660;
    return taxable * 0.3 - 4410;
}

export function calculateTax(input: TaxInput): TaxCalculation {
    const gross = nonNegative(input.grossMonthlyIncome);
    const social = nonNegative(input.personalSocialSecurityMonthly);
    const basic: TaxDeductionBreakdown = {
        key: 'basic', enabled: true, deductionRate: 100, deductionBaseMonthly: 5000,
        actualMonthlyAmount: 5000, actualAnnualAmount: 60000, estimatedMonthlyTaxReduction: 0,
    };
    const configured = DEDUCTION_KEYS.map((key) => {
        const config = input.deductions[key];
        const rate = clampRate(config?.deductionRate);
        const base = monthlyBase(config);
        return { key, enabled: config?.enabled !== false && !!config, deductionRate: rate, deductionBaseMonthly: base,
            actualMonthlyAmount: config?.enabled === false ? 0 : base * rate / 100,
            actualAnnualAmount: config?.enabled === false ? 0 : base * rate / 100 * 12,
            estimatedMonthlyTaxReduction: 0 };
    });
    const before = Math.max(0, gross - social - basic.actualMonthlyAmount);
    const all = [basic, ...configured];
    const total = all.reduce((sum, item) => sum + item.actualMonthlyAmount, 0);
    const after = Math.max(0, gross - social - total);
    const taxBefore = estimateTax(before, input.marginalTaxRate);
    const taxAfter = estimateTax(after, input.marginalTaxRate);
    configured.forEach((item) => { item.estimatedMonthlyTaxReduction = Math.max(0, taxBefore - estimateTax(Math.max(0, before - item.actualMonthlyAmount), input.marginalTaxRate)); });
    basic.estimatedMonthlyTaxReduction = Math.max(0, estimateTax(gross - social, input.marginalTaxRate) - taxBefore);
    const monthlyTax = taxAfter;
    return { grossMonthlyIncome: gross, taxableIncomeBeforeDeductions: before, totalMonthlyDeductions: total,
        taxableIncomeAfterDeductions: after, estimatedMonthlyTax: monthlyTax, estimatedAnnualTax: monthlyTax * 12,
        estimatedMonthlyNetIncome: gross - social - monthlyTax, deductions: all, parentSupportExcludedFromDeductions: true };
}

export function calculateParentSupportExpense(
    expense: { mode: 'fixed' | 'percentage'; fixedMonthlyAmount?: number; incomePercentage?: number },
    taxableIncome: number,
): number {
    if (expense.mode === 'percentage') return nonNegative(taxableIncome) * clampRate(expense.incomePercentage) / 100;
    return nonNegative(expense.fixedMonthlyAmount);
}

/** Calculates the payroll view: tax, employee deductions, and take-home pay. */
export function calculatePayrollTax(input: PayrollTaxInput): PayrollTaxResult {
    const otherIncome = nonNegative(input.otherTaxableMonthlyIncome);
    const selectedDeductions = { ...input.deductions };
    Object.entries(input.systemDeductionSelections || {}).forEach(([key, selection]) => {
        if (!selection) return;
        selectedDeductions[key as Exclude<TaxDeductionKey, 'basic'>] = {
            enabled: selection.enabled,
            deductionRate: selection.allocationRate ?? 100,
            deductionBaseMonthly: selection.monthlyAmount,
        };
    });
    const result = calculateTax({
        ...input,
        grossMonthlyIncome: nonNegative(input.grossMonthlyIncome) + otherIncome,
        deductions: selectedDeductions,
    });
    const personal = nonNegative(input.personalSocialSecurityMonthly);
    const company = nonNegative(input.companySocialSecurityMonthly);
    const gross = result.grossMonthlyIncome;
    const actualTakeHomePay = Math.max(0, gross - personal - result.estimatedMonthlyTax);
    return {
        ...result,
        totalTaxableIncome: gross,
        personalSocialSecurityMonthly: personal,
        companySocialSecurityMonthly: company,
        personalFiveInsuranceAndHousingFund: personal,
        actualTakeHomePay,
        employerCost: gross + company,
    };
}
