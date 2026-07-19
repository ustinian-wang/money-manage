import {
    ContributionBreakdown,
    SocialSecurityCalculation,
    SocialSecurityInput,
    SocialSecurityItem,
    SocialSecurityRates,
} from '../../types/social-security';

export const DEFAULT_SOCIAL_SECURITY_RATES: SocialSecurityRates = {
    pension: { personal: 8, company: 16 },
    medical: { personal: 2, company: 6 },
    unemployment: { personal: 0.5, company: 0.5 },
    workInjury: { personal: 0, company: 0.4 },
    maternity: { personal: 0, company: 0.8 },
    housingFund: { personal: 5, company: 5 },
};

const ITEMS: SocialSecurityItem[] = [
    'pension',
    'medical',
    'unemployment',
    'workInjury',
    'maternity',
    'housingFund',
];

const nonNegative = (value: number | undefined): number =>
    Number.isFinite(value) ? Math.max(0, value as number) : 0;

export function calculateSocialSecurity(
    input: SocialSecurityInput,
): SocialSecurityCalculation {
    const base = nonNegative(input.contributionBase);
    const items: ContributionBreakdown[] = ITEMS.map((item) => {
        const rates = { ...DEFAULT_SOCIAL_SECURITY_RATES[item], ...(input.rates[item] || {}) };
        const personalRate = nonNegative(rates.personal);
        const companyRate = nonNegative(rates.company);
        return {
            item,
            contributionBase: base,
            personalRate,
            personalAmount: base * personalRate / 100,
            companyRate,
            companyAmount: base * companyRate / 100,
        };
    });
    const personalTotal = items.reduce((sum, item) => sum + item.personalAmount, 0);
    const companyTotal = items.reduce((sum, item) => sum + item.companyAmount, 0);
    return { contributionBase: base, items, personalTotal, companyTotal, totalContribution: personalTotal + companyTotal };
}
