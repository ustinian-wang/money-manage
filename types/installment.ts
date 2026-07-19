export type InstallmentCategory =
    | 'general'
    | 'housing'
    | 'commercial'
    | 'provident_fund'
    | 'car'
    | 'credit_card'
    | 'other';

export type RepaymentMode =
    | 'equal_principal_interest'
    | 'equal_principal'
    | 'fixed_payment';

export type InterestStructureMode = 'single' | 'combined' | 'segmented';
export type InstallmentTermUnit = 'month' | 'year';

export interface InstallmentTerm {
    value: number;
    unit: InstallmentTermUnit;
}

export function termToMonths(term: InstallmentTerm): number {
    return Math.round(term.value * (term.unit === 'year' ? 12 : 1));
}

export type InterestPlanType =
    | 'general'
    | 'commercial'
    | 'provident_fund'
    | 'credit_card'
    | 'other';

export interface InterestPlan {
    id: string;
    type: InterestPlanType;
    name: string;
    principal: number;
    annualRate: number;
    term?: number;
    termMonths?: number;
    startMonth?: number;
    endMonth?: number;
    repaymentMode?: RepaymentMode;
    fixedMonthlyPayment?: number;
}

export interface RepaymentSummary {
    monthlyPayment: number;
    totalInterest: number;
    totalRepayment: number;
    schedule: RepaymentMonth[];
}

export interface InterestStructure {
    mode: InterestStructureMode;
    repaymentMode?: RepaymentMode;
    plans: InterestPlan[];
}

export interface DownPayment {
    mode: 'amount' | 'ratio';
    amount?: number;
    ratio?: number;
}

export interface InstallmentConsumption {
    id: string;
    name: string;
    category: InstallmentCategory;
    totalPrice: number;
    downPayment: DownPayment;
    termMonths?: number;
    term?: InstallmentTerm;
    financingAmount?: number;
    interestStructure: InterestStructure;
    startMonth?: string;
    enabled?: boolean;
}

export interface RepaymentEntry {
    month: number;
    payment: number;
    principal: number;
    interest: number;
    remainingPrincipal: number;
    planId: string;
}

export type RepaymentMonth = RepaymentEntry;

export interface InstallmentSummary {
    financingAmount?: number;
    monthlyPayment: number;
    totalInterest: number;
    totalRepayment: number;
    schedule: RepaymentEntry[];
}
