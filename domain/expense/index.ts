import type { ExpenseItem, ExpenseMonthContext } from '../../types/expense';
import { calculateConsumption } from '../installment/calculator';

function monthDistance(start: string | undefined, current: string): number {
    if (!start) return 0;
    const [sy, sm] = start.split('-').map(Number);
    const [cy, cm] = current.split('-').map(Number);
    if (![sy, sm, cy, cm].every(Number.isFinite)) return 0;
    return (cy - sy) * 12 + cm - sm;
}

export function calculateExpenseAmount(item: ExpenseItem, context: ExpenseMonthContext): number {
    if (!item.enabled) return 0;
    if (item.paymentMode === 'one_time') return item.startMonth === context.month ? item.amount : 0;
    if (item.paymentMode === 'percentage') {
        const base = item.percentageBase === 'gross_income' ? context.grossIncome : item.percentageBase === 'total_income' ? context.totalIncome : context.netIncome;
        return Math.max(0, base * item.amount / 100);
    }
    if (item.paymentMode === 'installment' && item.installment) {
        const plans = item.installment.interestPlans.map((plan) => ({
            id: plan.id,
            type: plan.type,
            name: plan.type,
            principal: plan.principal,
            principalMode: 'amount' as const,
            annualRate: plan.annualRate,
            term: plan.termMonths,
            startMonth: 1,
            endMonth: plan.termMonths,
            repaymentMode: 'equal_principal_interest' as const,
        }));
        const result = calculateConsumption({
            id: item.id,
            name: item.name,
            category: item.category,
            source: 'planned',
            status: 'active',
            totalPrice: item.installment.totalPrice,
            downPayment: { mode: 'amount', amount: item.installment.downPaymentAmount, ratio: item.installment.totalPrice ? item.installment.downPaymentAmount / item.installment.totalPrice * 100 : 0 },
            financingAmount: plans.reduce((sum, plan) => sum + plan.principal, 0),
            term: { value: item.installment.termMonths, unit: 'month' },
            interestStructure: { mode: plans.length > 1 ? 'combined' : 'single', repaymentMode: 'equal_principal_interest', plans },
            additionalExpenses: [],
            startDate: item.startMonth || context.month,
            enabled: item.enabled,
        } as never);
        const period = monthDistance(item.startMonth, context.month) + 1;
        if (period < 1 || period > item.installment.termMonths) return item.installment.additionalMonthlyAmount && period >= 1 ? item.installment.additionalMonthlyAmount : 0;
        const month = result.schedule.find((row) => row.month === period);
        return (month?.payment || 0) + (item.installment.additionalMonthlyAmount || 0);
    }
    return Math.max(0, item.amount);
}

export function calculateMonthlyExpenses(items: ExpenseItem[], context: ExpenseMonthContext): number {
    return items.reduce((sum, item) => sum + calculateExpenseAmount(item, context), 0);
}
