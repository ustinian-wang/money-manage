import type { ExpenseItem, ExpenseMonthContext } from '../../types/expense';
import { calculateConsumption } from '../installment/calculator';
import { resolveEffectiveTermMonths } from '../installment/index';

function monthDistance(start: string | undefined, current: string): number {
    if (!start) return 0;
    const [sy, sm] = start.split('-').map(Number);
    const [cy, cm] = current.split('-').map(Number);
    if (![sy, sm, cy, cm].every(Number.isFinite)) return 0;
    return (cy - sy) * 12 + cm - sm;
}

function effectiveInstallmentTerm(item: ExpenseItem, context: ExpenseMonthContext): number {
    const installment = item.installment;
    if (!installment) return 0;
    const requested = installment.term
        ? Math.round(installment.term.value * (installment.term.unit === 'year' ? 12 : 1))
        : (installment.termMonths ?? 0);
    const start = installment.startDate ?? item.effectiveDate ?? item.startMonth;
    const end = installment.followRetirement ? context.retirementDate : (installment.endDate ?? item.endDate);
    if (!start || !end) return requested;
    return Math.max(0, Math.min(requested, resolveEffectiveTermMonths({
        id: item.id, name: item.name, category: 'general', totalPrice: installment.totalPrice,
        downPayment: { mode: 'amount', amount: installment.downPaymentAmount },
        termMonths: requested, startDate: start, endDate: end,
        interestStructure: { mode: 'single', plans: [] },
    })));
}

export function calculateExpenseAmount(item: ExpenseItem, context: ExpenseMonthContext): number {
    if (!item.enabled) return 0;
    if (item.effectiveDate && context.month < item.effectiveDate.slice(0, 7)) return 0;
    if (item.endDate && context.month > item.endDate.slice(0, 7)) return 0;
    if (item.paymentMode === 'one_time') return item.startMonth === context.month ? item.amount : 0;
    if (item.paymentMode === 'percentage') {
        const base = item.percentageBase === 'gross_income' ? context.grossIncome : item.percentageBase === 'total_income' ? context.totalIncome : context.netIncome;
        return Math.max(0, base * item.amount / 100);
    }
    if (item.paymentMode === 'installment' && item.installment) {
        const effectiveMonths = effectiveInstallmentTerm(item, context);
        if (effectiveMonths < 1) return 0;
        const startDate = item.installment.startDate ?? item.effectiveDate ?? item.startMonth ?? context.month;
        const plans = item.installment.interestPlans.map((plan) => ({
            id: plan.id,
            type: plan.type,
            name: plan.type,
            principal: plan.principal,
            principalMode: 'amount' as const,
            annualRate: plan.annualRate,
            term: Math.min(plan.termMonths, effectiveMonths),
            startMonth: 1,
            endMonth: Math.min(plan.termMonths, effectiveMonths),
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
            term: { value: effectiveMonths, unit: 'month' },
            interestStructure: { mode: plans.length > 1 ? 'combined' : 'single', repaymentMode: 'equal_principal_interest', plans },
            additionalExpenses: [],
            startDate,
            enabled: item.enabled,
        } as never);
        const period = monthDistance(startDate, context.month) + 1;
        if (period < 1 || period > effectiveMonths) return item.installment.additionalMonthlyAmount && period >= 1 ? item.installment.additionalMonthlyAmount : 0;
        const month = result.schedule.find((row) => row.month === period);
        return (month?.payment || 0) + (item.installment.additionalMonthlyAmount || 0);
    }
    return Math.max(0, item.amount);
}

export function calculateMonthlyExpenses(items: ExpenseItem[], context: ExpenseMonthContext): number {
    return items.reduce((sum, item) => sum + calculateExpenseAmount(item, context), 0);
}
