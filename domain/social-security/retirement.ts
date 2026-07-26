import type { RetirementIdentity, RetirementResult, RetirementRule, RetirementTimelinePoint, SocialInsurancePlanningConfig } from '../../types/retirement';
import { getCitySocialBasePreset } from './city-bases';

// 广州上下限/默认与 city-bases 同源，避免快捷表与规则表漂移
const gzBase = getCitySocialBasePreset('guangzhou')!;

export const GUANGZHOU_SOCIAL_RULE_2026 = {
    city: 'guangzhou' as const,
    ruleVersion: 'guangzhou-2026-v1',
    minimumContributionYears: 20,
    defaultContributionBase: gzBase.base,
    minContributionBase: gzBase.min ?? gzBase.base,
    maxContributionBase: gzBase.max ?? gzBase.base,
};

const OLD_RETIREMENT_AGE: Record<RetirementIdentity, number> = {
    male: 60 * 12,
    female_cadre: 55 * 12,
    female_worker: 50 * 12,
};

/**
 * The 2025 reform raises the statutory age by one month per two birth months,
 * capped at the new maximum. The table is kept behind a rule version so a
 * future policy update does not silently rewrite existing plans.
 */
function retirementAgeMonths(identity: RetirementIdentity, birthDate: string): number {
    const birth = parseDate(birthDate, 'birthDate');
    const birthMonth = birth.getUTCFullYear() * 12 + birth.getUTCMonth();
    const reformMonth = 1965 * 12;
    const monthsAfterStart = Math.max(0, birthMonth - reformMonth);
    const increase = Math.min(36, Math.floor(monthsAfterStart / 2));
    const maximum = identity === 'male' ? 63 * 12 : identity === 'female_cadre' ? 58 * 12 : 55 * 12;
    const age = Math.min(maximum, OLD_RETIREMENT_AGE[identity] + increase);
    return age;
}

export const RETIREMENT_RULES: Record<string, RetirementRule> = {
    'guangzhou-2026-v1': {
        ...GUANGZHOU_SOCIAL_RULE_2026,
        defaultContributionYears: 20,
        retirementAgeMonths,
    },
};

function parseDate(value: string, field: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError(`${field} must use YYYY-MM-DD`);
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || isoDate(date) !== value) throw new RangeError(`${field} is not a valid date`);
    return date;
}

function addMonths(date: Date, months: number): Date {
    const next = new Date(date);
    next.setUTCMonth(next.getUTCMonth() + months);
    return next;
}

function isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function calculateRetirement(config: SocialInsurancePlanningConfig): RetirementResult {
    const birthDate = parseDate(config.birthDate, 'birthDate');
    const insuranceStartDate = parseDate(config.insuranceStartDate, 'insuranceStartDate');
    const rule = RETIREMENT_RULES[config.ruleVersion || GUANGZHOU_SOCIAL_RULE_2026.ruleVersion];
    if (!rule) throw new RangeError(`Unknown retirement rule version: ${config.ruleVersion}`);
    const retirementAgeMonths = rule.retirementAgeMonths(config.identity, config.birthDate);
    const retirementDate = addMonths(birthDate, retirementAgeMonths);
    const requestedMonths = Math.max(0, Math.round((config.plannedContributionYears || rule.defaultContributionYears) * 12));
    const availableBeforeRetirement = Math.max(0, Math.floor((retirementDate.getTime() - insuranceStartDate.getTime()) / (30.4375 * 24 * 60 * 60 * 1000)));
    const contributionMonths = Math.min(requestedMonths, availableBeforeRetirement);
    const contributionEndDate = addMonths(insuranceStartDate, contributionMonths);
    const base = Math.min(rule.maxContributionBase, Math.max(rule.minContributionBase, config.contributionBase || GUANGZHOU_SOCIAL_RULE_2026.defaultContributionBase));
    return { retirementDate: isoDate(retirementDate), contributionEndDate: isoDate(contributionEndDate), contributionMonths, contributionYears: contributionMonths / 12, contributionBase: base, ruleVersion: rule.ruleVersion, retirementAgeMonths };
}

export function buildRetirementTimeline(config: SocialInsurancePlanningConfig, startDate: string, horizonMonths = 360): RetirementTimelinePoint[] {
    if (!config.enabled) return [];
    parseDate(startDate, 'startDate');
    if (!Number.isInteger(horizonMonths) || horizonMonths < 0) throw new RangeError('horizonMonths must be a non-negative integer');
    const result = calculateRetirement(config);
    return Array.from({ length: horizonMonths }, (_, index) => {
        const date = addMonths(new Date(`${startDate}T00:00:00Z`), index);
        const month = isoDate(date).slice(0, 7);
        const beforeRetirement = month < result.retirementDate.slice(0, 7);
        return { month, beforeRetirement, socialInsuranceEnabled: beforeRetirement, contributionBase: beforeRetirement ? result.contributionBase : 0 };
    });
}
