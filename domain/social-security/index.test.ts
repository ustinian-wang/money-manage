/**
 * 社保公积金：开关、分基数、个人/企业费率、负担占比
 * 场景：无五险一金 / 自定义五险基数 / 公积金与五险分基数
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    calcSocialBurdenSharePct,
    calculateSocialSecurity,
    resolveContributionBase,
    resolveHousingFundBase,
    resolveInsuranceBase,
} from './index';

describe('resolveContributionBase 缴费基数', () => {
    it('缺省跟工资并钳到上限', () => {
        assert.equal(resolveContributionBase(16667, null), 16667);
        assert.equal(resolveContributionBase(50000, undefined), 31000);
    });

    it('自定义优先；非法自定义回退按工资', () => {
        assert.equal(resolveContributionBase(20000, 12000), 12000);
        assert.equal(resolveContributionBase(20000, -100), 0);
        assert.equal(resolveContributionBase(20000, Number.NaN), 20000);
    });

    it('五险/公积金别名同实现；各自独立解析', () => {
        assert.equal(resolveInsuranceBase(20000, 10000), 10000);
        // 只改五险自定义时，公积金仍跟工资
        assert.equal(resolveHousingFundBase(20000, null), 20000);
        assert.equal(resolveHousingFundBase(20000, 18000), 18000);
    });
});

describe('calculateSocialSecurity 社保', () => {
    it('按独立费率计算个人与企业金额', () => {
        const result = calculateSocialSecurity({
            contributionBase: 20000,
            rates: { housingFund: { personal: 12, company: 5 } },
        });
        const housing = result.items.find((item) => item.item === 'housingFund');
        assert.ok(housing);
        assert.equal(housing.personalRate, 12);
        assert.equal(housing.personalAmount, 2400);
        assert.equal(housing.companyRate, 5);
        assert.equal(housing.companyAmount, 1000);
        assert.equal(result.housingFundBase, 20000);
        assert.equal(result.socialEnabled, true);
    });

    it('缺省费率走默认，非法基数钳为 0', () => {
        const result = calculateSocialSecurity({ contributionBase: -1, rates: {} });
        assert.equal(result.contributionBase, 0);
        assert.equal(result.items.length, 6);
        assert.equal(result.personalTotal, 0);
    });

    // 场景1：关闭缴纳 → 全 0；费率行仍保留便于 UI 展示
    it('socialEnabled=false 时个人与企业金额均为 0', () => {
        const result = calculateSocialSecurity({
            contributionBase: 20000,
            housingFundBase: 18000,
            socialEnabled: false,
            rates: { housingFund: { personal: 12, company: 5 } },
        });
        assert.equal(result.socialEnabled, false);
        assert.equal(result.personalTotal, 0);
        assert.equal(result.companyTotal, 0);
        assert.equal(result.totalContribution, 0);
        assert.ok(result.items.every((item) => item.personalAmount === 0 && item.companyAmount === 0));
        // 基数仍记录，便于重新开启
        assert.equal(result.contributionBase, 20000);
        assert.equal(result.housingFundBase, 18000);
    });

    // 场景3：五险按指定基数，公积金按另一基数（如税前工资）
    it('公积金与五险可用不同基数', () => {
        const result = calculateSocialSecurity({
            contributionBase: 10000, // 五险
            housingFundBase: 20000, // 公积金跟税前
            rates: {},
        });
        const pension = result.items.find((item) => item.item === 'pension');
        const housing = result.items.find((item) => item.item === 'housingFund');
        assert.ok(pension && housing);
        assert.equal(pension.contributionBase, 10000);
        assert.equal(pension.personalAmount, 800); // 8%
        assert.equal(housing.contributionBase, 20000);
        assert.equal(housing.personalAmount, 1000); // 5%
        assert.equal(result.contributionBase, 10000);
        assert.equal(result.housingFundBase, 20000);
    });

    // 旧调用：仅 contributionBase → 公积金跟五险
    it('未传 housingFundBase 时公积金跟五险基数', () => {
        const result = calculateSocialSecurity({ contributionBase: 12000, rates: {} });
        const housing = result.items.find((item) => item.item === 'housingFund');
        assert.equal(result.housingFundBase, 12000);
        assert.equal(housing?.contributionBase, 12000);
    });
});

// 占比 = (个人+企业) / (税前工资+企业)；分母不含个税
describe('calcSocialBurdenSharePct 双方负担占比', () => {
    it('分子个人+企业，分母工资+企业', () => {
        // (2000+3000)/(10000+3000) = 5000/13000
        assert.equal(calcSocialBurdenSharePct({ salary: 10000, personalTotal: 2000, companyTotal: 3000 }), (5000 / 13000) * 100);
    });

    it('工资为 0 时分母仅企业；企业为 0 时分母仅工资', () => {
        assert.equal(calcSocialBurdenSharePct({ salary: 0, personalTotal: 100, companyTotal: 400 }), (500 / 400) * 100);
        assert.equal(calcSocialBurdenSharePct({ salary: 8000, personalTotal: 1000, companyTotal: 0 }), (1000 / 8000) * 100);
    });

    it('工资与企业均为 0 时返回 null；关闭缴纳时占比为 0', () => {
        assert.equal(calcSocialBurdenSharePct({ salary: 0, personalTotal: 0, companyTotal: 0 }), null);
        assert.equal(calcSocialBurdenSharePct({ salary: -1, personalTotal: 100, companyTotal: 0 }), null);
        assert.equal(calcSocialBurdenSharePct({ salary: 10000, personalTotal: 0, companyTotal: 0 }), 0);
    });
});
