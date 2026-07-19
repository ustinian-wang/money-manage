export type SnapshotChangePath =
    | 'grossMonthlySalary'
    | 'otherMonthlyIncome'
    | 'parentSupportMonthly'
    | 'livingExpenseMonthly'
    | 'cashAssets'
    | 'investmentAssets'
    | 'investmentReturnRate'
    | 'installmentConsumptions';

export interface SnapshotChange {
    id: string;
    path: SnapshotChangePath;
    value: number | string;
    mode?: 'set' | 'add' | 'remove';
    note?: string;
}

export interface FinancialSnapshot {
    id: string;
    name: string;
    effectiveDate: string;
    effectiveMonth?: string;
    changes: SnapshotChange[];
    createdAt: string;
    updatedAt: string;
    confirmedNegativeAssets?: boolean;
}

export interface SimulationOptions {
    asOfDate?: string;
    horizonYears?: number;
    horizonMonths?: number;
}

export interface SnapshotState {
    grossMonthlySalary: number;
    otherMonthlyIncome: number;
    parentSupportMonthly: number;
    livingExpenseMonthly: number;
    cashAssets: number;
    investmentAssets: number;
    investmentReturnRate: number;
    committedDownPayments: number;
}

export interface SnapshotRiskReport {
    blocked: boolean;
    requiresConfirmation: boolean;
    negativeMonths: string[];
    minimumCashAssets: number;
    minimumAvailableAssets: number;
    comparedWith?: FinancialSnapshot;
    messages: string[];
}
