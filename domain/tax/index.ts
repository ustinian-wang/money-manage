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

/** 月度预扣累进税率档（与 UI 纳税区间表同源） */
export type TaxMonthlyBracket = {
    range: string;
    min: number;
    max: number;
    rate: number;
    quick: number;
};

export const TAX_MONTHLY_BRACKETS: readonly TaxMonthlyBracket[] = [
    { range: '不超过 3,000', min: 0, max: 3000, rate: 3, quick: 0 },
    { range: '3,000 - 12,000', min: 3000, max: 12000, rate: 10, quick: 210 },
    { range: '12,000 - 25,000', min: 12000, max: 25000, rate: 20, quick: 1410 },
    { range: '25,000 - 35,000', min: 25000, max: 35000, rate: 25, quick: 2660 },
    { range: '35,000 - 55,000', min: 35000, max: 55000, rate: 30, quick: 4410 },
    { range: '55,000 - 80,000', min: 55000, max: 80000, rate: 35, quick: 7160 },
    { range: '超过 80,000', min: 80000, max: Number.POSITIVE_INFINITY, rate: 45, quick: 15160 },
];

export type TaxBracketSliceRow = {
    range: string;
    rate: number;
    quick: number;
    /** 当前应纳税所得额落在本档的税额（未命中则为 0） */
    sliceTax: number;
    isCurrent: boolean;
};

function monthlyBase(input: TaxDeductionInput | undefined): number {
    if (!input) return 0;
    return nonNegative(input.deductionBaseMonthly ?? (input.deductionBaseAnnual || 0) / 12);
}

/** 按月应纳税所得额命中税率档 */
export function findTaxMonthlyBracket(monthlyTaxableIncome: number): TaxMonthlyBracket {
    const taxable = nonNegative(monthlyTaxableIncome);
    return TAX_MONTHLY_BRACKETS.find((b) => taxable <= b.max) ?? TAX_MONTHLY_BRACKETS[TAX_MONTHLY_BRACKETS.length - 1];
}

/**
 * 月度个税估算：应纳税所得额 × 税率 − 速算扣除数
 * 与 TAX_MONTHLY_BRACKETS 全档对齐（含 35% / 45%）
 */
export function estimateMonthlyTaxFromTaxable(monthlyTaxableIncome: number, marginalTaxRate?: number): number {
    const taxable = nonNegative(monthlyTaxableIncome);
    if (marginalTaxRate !== undefined) return taxable * clampRate(marginalTaxRate) / 100;
    const bracket = findTaxMonthlyBracket(taxable);
    return Math.max(0, taxable * bracket.rate / 100 - bracket.quick);
}

/**
 * 当前应纳税所得额在各累进档的实际税额（分档示意）
 * 各档 sliceTax 之和 = estimateMonthlyTaxFromTaxable(taxable)
 */
export function buildTaxBracketSliceRows(monthlyTaxableIncome: number): TaxBracketSliceRow[] {
    const taxable = nonNegative(monthlyTaxableIncome);
    const current = findTaxMonthlyBracket(taxable);
    return TAX_MONTHLY_BRACKETS.map((bracket) => {
        const sliceBase = Math.max(0, Math.min(taxable, bracket.max) - bracket.min);
        return {
            range: bracket.range,
            rate: bracket.rate,
            quick: bracket.quick,
            sliceTax: sliceBase * bracket.rate / 100,
            isCurrent: bracket.range === current.range,
        };
    });
}

function estimateTax(monthlyTaxableIncome: number, marginalTaxRate?: number): number {
    return estimateMonthlyTaxFromTaxable(monthlyTaxableIncome, marginalTaxRate);
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
