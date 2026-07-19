export type SocialSecurityItem =
    | 'pension'
    | 'medical'
    | 'unemployment'
    | 'workInjury'
    | 'maternity'
    | 'housingFund';

export interface ContributionRates {
    personal: number;
    company: number;
}

export type SocialSecurityRates = Record<SocialSecurityItem, ContributionRates>;

export interface SocialSecurityInput {
    contributionBase: number;
    rates: Partial<SocialSecurityRates>;
}

export interface ContributionBreakdown {
    item: SocialSecurityItem;
    contributionBase: number;
    personalRate: number;
    personalAmount: number;
    companyRate: number;
    companyAmount: number;
}

export interface SocialSecurityCalculation {
    contributionBase: number;
    items: ContributionBreakdown[];
    personalTotal: number;
    companyTotal: number;
    totalContribution: number;
}

export interface SocialSecurityBreakdown {
    key: SocialSecurityItem;
    label: string;
    personal: number;
    company: number;
    personalAmount: number;
    companyAmount: number;
}

export interface SocialSecurityResult {
    contributionBase: number;
    breakdown: SocialSecurityBreakdown[];
    personalTotal: number;
    companyTotal: number;
    totalContribution: number;
}
