import type { InstallmentConsumption, InstallmentSummary, RepaymentEntry } from '../../types/installment';
import { calculatePlanSchedule } from './calculators';
import { resolveTermMonths, validateConsumption } from './validation';

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function monthKey(date: string): string {
    if (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(date)) throw new RangeError(`invalid installment date: ${date}`);
    return date.slice(0, 7);
}

function monthDifference(start: string, end: string): number {
    const [sy, sm] = monthKey(start).split('-').map(Number);
    const [ey, em] = monthKey(end).split('-').map(Number);
    return (ey - sy) * 12 + em - sm;
}

export function resolveEffectiveTermMonths(consumption: InstallmentConsumption, retirementDate?: string): number {
    const requested = resolveTermMonths(consumption.term, consumption.termMonths);
    const start = consumption.startDate ?? consumption.startMonth;
    const end = consumption.followRetirement ? retirementDate : consumption.endDate;
    if (!start || !end) return requested;
    return Math.max(0, Math.min(requested, monthDifference(start, end) + 1));
}

export function withEffectiveTerm(consumption: InstallmentConsumption, retirementDate?: string): InstallmentConsumption {
    const effective = resolveEffectiveTermMonths(consumption, retirementDate);
    const requested = resolveTermMonths(consumption.term, consumption.termMonths);
    if (effective === requested) return consumption;
    return {
        ...consumption,
        termMonths: effective,
        term: { value: effective, unit: 'month' },
        interestStructure: {
            ...consumption.interestStructure,
            plans: consumption.interestStructure.plans.map((plan) => ({
                ...plan,
                termMonths: Math.min(plan.termMonths ?? plan.term ?? effective, effective),
                term: undefined,
                endMonth: Math.min(plan.endMonth ?? effective, effective),
            })),
        },
    };
}

export { calculateEqualPrincipalInterestPayment, calculatePlanSchedule, resolveMonthlyRate } from './calculators';
export { resolveTermMonths, toMonthCount, validateConsumption, validateInterestPlan } from './validation';

export function calculateDownPayment(consumption: InstallmentConsumption): number {
    validateConsumption(consumption);
    const { downPayment, totalPrice } = consumption;
    return roundMoney(downPayment.mode === 'ratio'
        ? totalPrice * (downPayment.ratio ?? 0) / 100
        : (downPayment.amount ?? 0));
}

export function calculateFinancingAmount(consumption: InstallmentConsumption): number {
    return roundMoney(consumption.financingAmount ?? consumption.totalPrice - calculateDownPayment(consumption));
}

export function buildRepaymentSchedule(consumption: InstallmentConsumption): RepaymentEntry[] {
    validateConsumption(consumption);
    if (!consumption.enabled && consumption.enabled !== undefined) return [];
    const financingAmount = calculateFinancingAmount(consumption);
    const plans = consumption.interestStructure.plans;
    if (financingAmount === 0 || plans.length === 0) return [];
    const planPrincipal = plans.reduce((sum, plan) => sum + plan.principal, 0);
    if (Math.abs(planPrincipal - financingAmount) > 0.01) {
        throw new RangeError(`interest plan principal total ${planPrincipal} does not match financing amount ${financingAmount}`);
    }
    return plans.flatMap(calculatePlanSchedule).sort((a, b) => a.month - b.month || a.planId.localeCompare(b.planId));
}

export function buildEffectiveRepaymentSchedule(consumption: InstallmentConsumption, retirementDate?: string): RepaymentEntry[] {
    return buildRepaymentSchedule(withEffectiveTerm(consumption, retirementDate));
}

export function summarizeInstallmentConsumption(consumption: InstallmentConsumption): InstallmentSummary {
    const schedule = buildRepaymentSchedule(consumption);
    const financingAmount = calculateFinancingAmount(consumption);
    const totalInterest = roundMoney(schedule.reduce((sum, entry) => sum + entry.interest, 0));
    const totalRepayment = roundMoney(schedule.reduce((sum, entry) => sum + entry.payment, 0));
    const firstMonth = schedule[0]?.month;
    const monthlyPayment = firstMonth === undefined
        ? 0
        : roundMoney(schedule.filter((entry) => entry.month === firstMonth).reduce((sum, entry) => sum + entry.payment, 0));
    return { financingAmount, monthlyPayment, totalInterest, totalRepayment, schedule };
}

export function calculateMonthlyPayments(consumption: InstallmentConsumption): Map<number, number> {
    const payments = new Map<number, number>();
    for (const entry of buildRepaymentSchedule(consumption)) {
        payments.set(entry.month, roundMoney((payments.get(entry.month) ?? 0) + entry.payment));
    }
    return payments;
}

export function getInstallmentTermMonths(consumption: InstallmentConsumption): number {
    return resolveTermMonths(consumption.term, consumption.termMonths);
}
