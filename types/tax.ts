export type TaxDeductionKey =
    | 'basic'
    | 'rent'
    | 'elderlySupport'
    | 'childrenEducation'
    | 'continuingEducation'
    | 'housingLoanInterest'
    | 'seriousMedical'
    | 'infantCare';

export interface TaxDeductionInput {
    enabled?: boolean;
    deductionRate: number;
    baseAmount?: number;
    period?: 'monthly' | 'annual';
    deductionBaseMonthly?: number;
    deductionBaseAnnual?: number;
}

export interface TaxDeductionBreakdown {
    key: TaxDeductionKey;
    enabled: boolean;
    deductionRate: number;
    deductionBaseMonthly: number;
    actualMonthlyAmount: number;
    actualAnnualAmount: number;
    estimatedMonthlyTaxReduction: number;
    label?: string;
    baseAmount?: number;
    monthlyDeduction?: number;
    annualDeduction?: number;
    taxableIncomeReduction?: number;
    estimatedTaxReduction?: number;
}

export interface TaxInput {
    grossMonthlyIncome: number;
    personalSocialSecurityMonthly: number;
    deductions: Partial<Record<Exclude<TaxDeductionKey, 'basic'>, TaxDeductionInput>>;
    marginalTaxRate?: number;
}

export interface PayrollTaxInput extends TaxInput {
    otherTaxableMonthlyIncome?: number;
    companySocialSecurityMonthly?: number;
    systemDeductionSelections?: Partial<Record<Exclude<TaxDeductionKey, 'basic'>, {
        enabled: boolean;
        allocationRate?: number;
        monthlyAmount: number;
    }>>;
}

export interface PayrollTaxResult extends TaxCalculation {
    grossMonthlyIncome: number;
    totalTaxableIncome: number;
    personalSocialSecurityMonthly: number;
    companySocialSecurityMonthly: number;
    personalFiveInsuranceAndHousingFund: number;
    actualTakeHomePay: number;
    employerCost: number;
}

export type TaxDeductionsInput = Partial<Record<TaxDeductionKey, TaxDeductionInput>>;

export interface IndividualTaxInput {
    grossMonthlyIncome: number;
    personalSocialSecurityMonthly: number;
    parentSupportMonthly?: number;
    deductions?: TaxDeductionsInput;
}

export interface IndividualTaxResult {
    model: 'individual-monthly-estimate';
    grossMonthlyIncome: number;
    personalSocialSecurityMonthly: number;
    parentSupportMonthly: number;
    parentSupportIsTaxDeductible: false;
    monthlyDeductionTotal: number;
    annualDeductionTotal: number;
    taxableMonthlyIncome: number;
    estimatedMonthlyTax: number;
    estimatedTaxRate: number;
    estimatedMonthlyTaxReduction: number;
    breakdown: TaxDeductionBreakdown[];
    netMonthlyIncome: number;
}

export interface ParentSupportExpense {
    mode: 'fixed' | 'percentage';
    fixedMonthlyAmount?: number;
    incomePercentage?: number;
    includedInCashflow: true;
    includedInTaxDeduction: false;
}

export interface TaxCalculation {
    grossMonthlyIncome: number;
    taxableIncomeBeforeDeductions: number;
    totalMonthlyDeductions: number;
    taxableIncomeAfterDeductions: number;
    estimatedMonthlyTax: number;
    estimatedAnnualTax: number;
    estimatedMonthlyNetIncome: number;
    deductions: TaxDeductionBreakdown[];
    parentSupportExcludedFromDeductions: true;
}
