import { termToMonths, type InstallmentConsumption, type InterestPlan } from '../../types/installment.ts';

export function toMonthCount(value: number, unit: 'month' | 'year' = 'month'): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * (unit === 'year' ? 12 : 1));
}

export function resolveTermMonths(term?: { value: number; unit: 'month' | 'year' }, fallback?: number): number {
    return term ? termToMonths(term) : (fallback ?? 0);
}

export function assertNonNegative(value: number, field: string): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${field} must be a non-negative number`);
    }
}

export function validateInterestPlan(plan: InterestPlan): void {
    assertNonNegative(plan.principal, `${plan.id}.principal`);
    assertNonNegative(plan.annualRate, `${plan.id}.annualRate`);
    const termMonths = plan.termMonths ?? plan.term;
    if (!Number.isInteger(termMonths) || termMonths! <= 0) {
        throw new RangeError(`${plan.id}.termMonths must be a positive integer`);
    }
    if (plan.repaymentMode === 'fixed_payment') {
        assertNonNegative(plan.fixedMonthlyPayment ?? 0, `${plan.id}.fixedMonthlyPayment`);
        if ((plan.fixedMonthlyPayment ?? 0) === 0 && plan.principal > 0) {
            throw new RangeError(`${plan.id}.fixedMonthlyPayment must be greater than zero`);
        }
    }
    const start = plan.startMonth ?? 1;
    const end = plan.endMonth ?? termMonths!;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
        throw new RangeError(`${plan.id} has an invalid month range`);
    }
}

export function validateConsumption(consumption: InstallmentConsumption): void {
    assertNonNegative(consumption.totalPrice, 'totalPrice');
    const downAmount = consumption.downPayment.amount ?? 0;
    const downRatio = consumption.downPayment.ratio ?? 0;
    assertNonNegative(downAmount, 'downPayment.amount');
    if (!Number.isFinite(downRatio) || downRatio < 0 || downRatio > 100) {
        throw new RangeError('downPayment.ratio must be between 0 and 100');
    }
    if (downAmount > consumption.totalPrice) {
        throw new RangeError('down payment cannot exceed total price');
    }
    const termMonths = resolveTermMonths(consumption.term, consumption.termMonths);
    if (!Number.isInteger(termMonths) || termMonths! < 0) {
        throw new RangeError('termMonths must be a non-negative integer');
    }
    for (const plan of consumption.interestStructure.plans) validateInterestPlan(plan);
}
