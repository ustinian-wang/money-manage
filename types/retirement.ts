export type RetirementIdentity = 'male' | 'female_cadre' | 'female_worker';

export interface SocialInsurancePlanningConfig {
    enabled: boolean;
    birthDate: string;
    identity: RetirementIdentity;
    insuranceStartDate: string;
    plannedContributionYears: number;
    contributionBase: number;
    ruleVersion?: string;
    city: 'guangzhou';
}

export interface RetirementResult {
    retirementDate: string;
    contributionEndDate: string;
    contributionMonths: number;
    contributionYears: number;
    contributionBase: number;
    ruleVersion: string;
    retirementAgeMonths: number;
}

export interface RetirementTimelinePoint {
    month: string;
    beforeRetirement: boolean;
    socialInsuranceEnabled: boolean;
    contributionBase: number;
}

export interface RetirementRule {
    ruleVersion: string;
    city: 'guangzhou';
    minimumContributionYears: number;
    defaultContributionYears: number;
    minContributionBase: number;
    maxContributionBase: number;
    retirementAgeMonths: (identity: RetirementIdentity, birthDate: string) => number;
}
