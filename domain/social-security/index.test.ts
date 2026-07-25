/**
 * 社保公积金：个人/企业独立费率、缺省与基数钳制
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateSocialSecurity } from './index';

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
    });

    it('缺省费率走默认，非法基数钳为 0', () => {
        const result = calculateSocialSecurity({ contributionBase: -1, rates: {} });
        assert.equal(result.contributionBase, 0);
        assert.equal(result.items.length, 6);
        assert.equal(result.personalTotal, 0);
    });
});
