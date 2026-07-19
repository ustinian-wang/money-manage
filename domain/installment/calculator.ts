import type { InterestPlan, InstallmentConsumption, RepaymentMode, RepaymentMonth, RepaymentSummary } from '../../types/installment.ts';
import { resolveTermMonths } from './validation.ts';

const EPSILON = 0.005;

export function validateInterestPlans(plans: InterestPlan[], financingAmount: number): void {
    if (!Number.isFinite(financingAmount) || financingAmount < 0) throw new Error('融资金额必须是非负数字');
    if (plans.some((p) => { const term = p.term ?? p.termMonths; return !Number.isFinite(p.principal) || p.principal < 0 || p.annualRate < 0 || !Number.isInteger(term) || (term ?? 0) < 1; })) {
        throw new Error('贷款方案包含无效本金、利率或期限');
    }
    const principal = plans.reduce((sum, p) => sum + p.principal, 0);
    if (Math.abs(principal - financingAmount) > EPSILON) throw new Error('贷款方案本金合计必须等于融资金额');
}

export function calculatePayment(principal: number, annualRate: number, term: number, mode: RepaymentMode, fixedMonthlyPayment?: number): number {
    if (principal < 0 || annualRate < 0 || !Number.isInteger(term) || term < 1) throw new Error('贷款参数无效');
    if (mode === 'fixed_payment') {
        if (!Number.isFinite(fixedMonthlyPayment) || fixedMonthlyPayment! < 0) throw new Error('固定月供无效');
        return fixedMonthlyPayment!;
    }
    if (mode === 'equal_principal') return principal / term;
    if (principal === 0) return 0;
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0) return principal / term;
    const factor = (1 + monthlyRate) ** term;
    return principal * monthlyRate * factor / (factor - 1);
}

function buildPlanSchedule(plan: InterestPlan): RepaymentMonth[] {
    const mode = plan.repaymentMode || 'equal_principal_interest';
    const planTerm = plan.term ?? plan.termMonths ?? plan.endMonth ?? 1;
    const term = plan.endMonth || planTerm;
    const start = plan.startMonth || 1;
    const result: RepaymentMonth[] = [];
    let remaining = plan.principal;
    const fixedPayment = calculatePayment(plan.principal, plan.annualRate, planTerm, mode, plan.fixedMonthlyPayment);
    for (let month = start; month <= term && remaining > EPSILON; month += 1) {
        const interest = remaining * plan.annualRate / 100 / 12;
        const principal = mode === 'equal_principal' ? Math.min(remaining, plan.principal / planTerm) : mode === 'fixed_payment' ? Math.min(remaining, Math.max(0, fixedPayment - interest)) : Math.min(remaining, fixedPayment - interest);
        const payment = mode === 'equal_principal' ? principal + interest : Math.min(remaining + interest, fixedPayment);
        remaining = Math.max(0, remaining - principal);
        result.push({ month, payment, principal, interest, remainingPrincipal: remaining, planId: plan.id });
    }
    return result;
}

export function buildRepaymentSchedule(plans: InterestPlan[], financingAmount?: number): RepaymentMonth[] {
    if (financingAmount !== undefined) validateInterestPlans(plans, financingAmount);
    const rows = plans.flatMap(buildPlanSchedule);
    return rows.sort((a, b) => a.month - b.month || a.planId.localeCompare(b.planId));
}

export function calculateInstallment(plan: InterestPlan): RepaymentSummary {
    const schedule = buildPlanSchedule(plan);
    return summarize(schedule);
}

export function calculateCombinedLoan(plans: InterestPlan[], financingAmount: number): RepaymentSummary {
    validateInterestPlans(plans, financingAmount);
    return summarize(buildRepaymentSchedule(plans));
}

export function calculateConsumption(consumption: InstallmentConsumption): RepaymentSummary {
    const amount = consumption.financingAmount ?? Math.max(0, consumption.totalPrice - (consumption.downPayment.amount ?? 0));
    if (amount === 0) return { monthlyPayment: 0, totalInterest: 0, totalRepayment: 0, schedule: [] };
    const termMonths = resolveTermMonths(consumption.term, consumption.termMonths);
    if (termMonths < 1) throw new Error('分期期限必须大于 0');
    return calculateCombinedLoan(consumption.interestStructure.plans, amount);
}

function summarize(schedule: RepaymentMonth[]): RepaymentSummary {
    const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
    const totalRepayment = schedule.reduce((sum, row) => sum + row.payment, 0);
    const monthly = new Map<number, number>();
    schedule.forEach((row) => monthly.set(row.month, (monthly.get(row.month) || 0) + row.payment));
    return { monthlyPayment: monthly.size ? Math.max(...monthly.values()) : 0, totalInterest, totalRepayment, schedule };
}
