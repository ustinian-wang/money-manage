import type { TaxDeductionKey } from '../../types/tax';

export type GuangdongCityTier = 'guangzhou-shenzhen' | 'other-guangdong';

export interface SystemDeductionRule {
    key: Exclude<TaxDeductionKey, 'basic'>;
    label: string;
    enabledByDefault: boolean;
    amountMode: 'monthly' | 'annual' | 'threshold';
    standardAmount: number;
    selectable: true;
    requiresQualification: true;
    ruleVersion: string;
    notes: string;
}

// Amounts are rule inputs, not user-entered tax amounts. Update by tax-rule version.
export const GUANGDONG_SYSTEM_DEDUCTIONS: Record<GuangdongCityTier, SystemDeductionRule[]> = {
    'guangzhou-shenzhen': [
        { key: 'rent', label: '住房租金', enabledByDefault: false, amountMode: 'monthly', standardAmount: 1500, selectable: true, requiresQualification: true, ruleVersion: '2026-v1', notes: '租房且符合城市及住房条件后可勾选。' },
        { key: 'elderlySupport', label: '赡养老人', enabledByDefault: false, amountMode: 'monthly', standardAmount: 2000, selectable: true, requiresQualification: true, ruleVersion: '2026-v1', notes: '与父母上交现金支出独立，需按赡养关系及分摊口径勾选。' },
    ],
    'other-guangdong': [
        { key: 'rent', label: '住房租金', enabledByDefault: false, amountMode: 'monthly', standardAmount: 1100, selectable: true, requiresQualification: true, ruleVersion: '2026-v1', notes: '租房且符合城市及住房条件后可勾选。' },
        { key: 'elderlySupport', label: '赡养老人', enabledByDefault: false, amountMode: 'monthly', standardAmount: 2000, selectable: true, requiresQualification: true, ruleVersion: '2026-v1', notes: '与父母上交现金支出独立，需按赡养关系及分摊口径勾选。' },
    ],
};

export function getSystemDeductions(cityTier: GuangdongCityTier): SystemDeductionRule[] {
    return GUANGDONG_SYSTEM_DEDUCTIONS[cityTier].map((rule) => ({ ...rule }));
}

export function calculateSystemDeduction(rule: SystemDeductionRule, checked: boolean, allocationRate = 100) {
    const rate = Math.min(100, Math.max(0, allocationRate));
    const monthlyAmount = checked ? rule.standardAmount * rate / 100 : 0;
    return { key: rule.key, label: rule.label, checked, deductionRate: rate, monthlyAmount, annualAmount: monthlyAmount * 12, ruleVersion: rule.ruleVersion };
}
