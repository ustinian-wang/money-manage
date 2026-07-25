import type {
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

/** 广州等地常见缴费基数上限（简化估算用；非完整政策表） */
export const DEFAULT_CONTRIBUTION_BASE_CAP = 31000;

const nonNegative = (value: number | undefined): number =>
    Number.isFinite(value) ? Math.max(0, value as number) : 0;

/**
 * 解析月度缴费基数：自定义优先；缺省跟税前工资并钳到 cap。
 * custom 为 null/undefined/NaN 时视为「按工资」。
 * 五险 / 公积金各自调用；互不影响（改五险自定义不会拖动公积金缺省）。
 */
export function resolveContributionBase(
    salary: number,
    custom?: number | null,
    cap = DEFAULT_CONTRIBUTION_BASE_CAP,
): number {
    if (custom != null && Number.isFinite(custom)) return nonNegative(custom);
    return Math.min(nonNegative(salary), nonNegative(cap));
}

/** 五险基数别名（语义更清晰；实现同 resolveContributionBase） */
export const resolveInsuranceBase = resolveContributionBase;

/** 公积金基数别名；缺省跟工资，与五险独立 */
export const resolveHousingFundBase = resolveContributionBase;

export function calculateSocialSecurity(
    input: SocialSecurityInput,
): SocialSecurityCalculation {
    const enabled = input.socialEnabled !== false;
    const insuranceBase = nonNegative(input.contributionBase);
    // 缺省跟五险基数：兼容旧调用只传 contributionBase
    const fundBase = input.housingFundBase != null && Number.isFinite(input.housingFundBase)
        ? nonNegative(input.housingFundBase)
        : insuranceBase;
    const items: ContributionBreakdown[] = ITEMS.map((item) => {
        const rates = { ...DEFAULT_SOCIAL_SECURITY_RATES[item], ...(input.rates[item] || {}) };
        const personalRate = nonNegative(rates.personal);
        const companyRate = nonNegative(rates.company);
        const base = item === 'housingFund' ? fundBase : insuranceBase;
        return {
            item,
            contributionBase: base,
            personalRate,
            personalAmount: enabled ? base * personalRate / 100 : 0,
            companyRate,
            companyAmount: enabled ? base * companyRate / 100 : 0,
        };
    });
    const personalTotal = items.reduce((sum, item) => sum + item.personalAmount, 0);
    const companyTotal = items.reduce((sum, item) => sum + item.companyAmount, 0);
    return {
        contributionBase: insuranceBase,
        housingFundBase: fundBase,
        socialEnabled: enabled,
        items,
        personalTotal,
        companyTotal,
        totalContribution: personalTotal + companyTotal,
    };
}

/**
 * 双方五险一金负担占比（雇佣成本口径，不含个税）
 * 占比 = (个人合计 + 企业合计) / (税前工资 + 企业合计)
 * 分母 ≤ 0 时返回 null（工资与企业均为 0）；关闭缴纳时分子为 0 → 占比 0
 */
export function calcSocialBurdenSharePct(input: {
    salary: number;
    personalTotal: number;
    companyTotal: number;
}): number | null {
    const salary = nonNegative(input.salary);
    const personalTotal = nonNegative(input.personalTotal);
    const companyTotal = nonNegative(input.companyTotal);
    const denominator = salary + companyTotal;
    if (denominator <= 0) return null;
    return ((personalTotal + companyTotal) / denominator) * 100;
}
