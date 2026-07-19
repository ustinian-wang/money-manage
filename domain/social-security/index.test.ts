import { calculateSocialSecurity } from './index';

describe('calculateSocialSecurity', () => {
    it('calculates personal and company amounts from independent rates', () => {
        const result = calculateSocialSecurity({
            contributionBase: 20000,
            rates: { housingFund: { personal: 12, company: 5 } },
        });
        const housing = result.items.find((item) => item.item === 'housingFund');
        expect(housing).toEqual(expect.objectContaining({ personalRate: 12, personalAmount: 2400, companyRate: 5, companyAmount: 1000 }));
    });

    it('uses defaults for omitted rates and clamps invalid base values', () => {
        const result = calculateSocialSecurity({ contributionBase: -1, rates: {} });
        expect(result.contributionBase).toBe(0);
        expect(result.items).toHaveLength(6);
        expect(result.personalTotal).toBe(0);
    });
});
