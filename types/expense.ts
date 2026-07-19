export type ExpensePaymentMode = 'one_time' | 'fixed_monthly' | 'percentage' | 'installment';
export type ExpenseCategory = 'living' | 'family_support' | 'housing' | 'transport' | 'education' | 'insurance' | 'other';

export interface ExpenseItem {
    id: string;
    name: string;
    category: ExpenseCategory;
    paymentMode: ExpensePaymentMode;
    enabled: boolean;
    amount: number;
    percentageBase?: 'net_income' | 'gross_income' | 'total_income';
    startMonth?: string;
    endMonth?: string;
    installment?: {
        totalPrice: number;
        downPaymentAmount: number;
        termMonths: number;
        interestPlans: Array<{
            id: string;
            type: 'general' | 'commercial' | 'provident_fund' | 'credit_card' | 'other';
            principal: number;
            annualRate: number;
            termMonths: number;
        }>;
        additionalMonthlyAmount?: number;
    };
    createdAt: string;
    updatedAt: string;
}

export interface ExpenseMonthContext {
    month: string;
    grossIncome: number;
    netIncome: number;
    totalIncome: number;
}
