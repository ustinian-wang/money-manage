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
    /** 五险缴费基数（养老/医疗/失业/工伤/生育） */
    contributionBase: number;
    /**
     * 公积金缴费基数；缺省跟 contributionBase（旧调用兼容）。
     * 页面层缺省跟工资：只改五险时公积金仍按工资解析后再传入。
     */
    housingFundBase?: number;
    /** 是否缴纳五险一金；false 时个人/企业金额均为 0（个税无社保扣减） */
    socialEnabled?: boolean;
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
    housingFundBase: number;
    socialEnabled: boolean;
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
    housingFundBase: number;
    socialEnabled: boolean;
    breakdown: SocialSecurityBreakdown[];
    personalTotal: number;
    companyTotal: number;
    totalContribution: number;
}
