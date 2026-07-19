import type { InterestPlan, RepaymentEntry } from '../../types/installment';
import { validateInterestPlan } from './validation';

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function resolveMonthlyRate(annualRate: number): number {
    return annualRate / 100 / 12;
}

export function calculateEqualPrincipalInterestPayment(principal: number, annualRate: number, termMonths: number): number {
    if (principal === 0) return 0;
    if (annualRate === 0) return principal / termMonths;
    const monthlyRate = resolveMonthlyRate(annualRate);
    const factor = (1 + monthlyRate) ** termMonths;
    return principal * monthlyRate * factor / (factor - 1);
}

export function calculatePlanSchedule(plan: InterestPlan): RepaymentEntry[] {
    validateInterestPlan(plan);
    if (plan.principal === 0) return [];
    const schedule: RepaymentEntry[] = [];
    let remaining = plan.principal;
    const monthlyRate = resolveMonthlyRate(plan.annualRate);
    const termMonths = plan.termMonths ?? plan.term!;
    const repaymentMode = plan.repaymentMode ?? 'equal_principal_interest';
    const payment = repaymentMode === 'equal_principal_interest'
        ? calculateEqualPrincipalInterestPayment(plan.principal, plan.annualRate, termMonths)
        : repaymentMode === 'equal_principal'
            ? plan.principal / termMonths
            : plan.fixedMonthlyPayment!;
    const principalPerMonth = plan.principal / termMonths;
    const firstMonth = plan.startMonth ?? 1;
    const lastMonth = Math.min(plan.endMonth ?? termMonths, firstMonth + termMonths - 1);

    for (let period = 1; period <= termMonths && remaining > 0.005; period += 1) {
        const interest = remaining * monthlyRate;
        const scheduledPrincipal = repaymentMode === 'equal_principal'
            ? principalPerMonth
            : payment - interest;
        const principal = Math.min(remaining, Math.max(0, scheduledPrincipal));
        const actualPayment = principal + interest;
        remaining = Math.max(0, remaining - principal);
        schedule.push({
            month: firstMonth + period - 1,
            payment: roundMoney(actualPayment),
            principal: roundMoney(principal),
            interest: roundMoney(interest),
            remainingPrincipal: roundMoney(remaining),
            planId: plan.id,
        });
    }
    if (lastMonth < firstMonth + schedule.length - 1) {
        return schedule.slice(0, Math.max(0, lastMonth - firstMonth + 1));
    }
    return schedule;
}
