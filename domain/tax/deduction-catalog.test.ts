/**
 * 广东专项附加扣除目录：城市档位标准额与勾选分摊
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { calculateSystemDeduction, getSystemDeductions } from './deduction-catalog';

describe('deduction-catalog', () => {
    test('广深租金标准高于其他广东城市', () => {
        const gz = getSystemDeductions('guangzhou-shenzhen').find((r) => r.key === 'rent');
        const other = getSystemDeductions('other-guangdong').find((r) => r.key === 'rent');
        assert.ok(gz && other);
        assert.equal(gz.standardAmount, 1500);
        assert.equal(other.standardAmount, 1100);
        // 返回副本，改副本不影响目录
        gz.standardAmount = 1;
        assert.equal(getSystemDeductions('guangzhou-shenzhen').find((r) => r.key === 'rent')?.standardAmount, 1500);
    });

    test('未勾选为 0；勾选按分摊比例计月/年额', () => {
        const rule = getSystemDeductions('guangzhou-shenzhen').find((r) => r.key === 'elderlySupport')!;
        const off = calculateSystemDeduction(rule, false);
        assert.equal(off.monthlyAmount, 0);
        const half = calculateSystemDeduction(rule, true, 50);
        assert.equal(half.monthlyAmount, 1000);
        assert.equal(half.annualAmount, 12000);
    });
});
