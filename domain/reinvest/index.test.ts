/**
 * 闲钱投资：百分比 / 固定月额、旧数据兼容、模式切换默认值
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_REINVEST,
  effectiveInvestRate,
  parseReinvestSetting,
  reinvestFromAnnualSurplus,
  reinvestFromSurplus,
  reinvestToProfile,
  switchReinvestMode,
} from './index';

describe('parseReinvestSetting 兼容', () => {
  it('仅有旧 reinvestRate → percent', () => {
    assert.deepEqual(parseReinvestSetting({ reinvestRate: 40 }), {
      mode: 'percent',
      rate: 40,
      amount: 0,
    });
  });

  it('显式 amount 模式保留月额', () => {
    assert.deepEqual(parseReinvestSetting({ reinvestMode: 'amount', reinvestRate: 30, reinvestAmount: 2500 }), {
      mode: 'amount',
      rate: 30,
      amount: 2500,
    });
  });

  it('缺字段回落默认 percent 30', () => {
    assert.deepEqual(parseReinvestSetting({}), DEFAULT_REINVEST);
  });
});

describe('reinvestFromSurplus / annual', () => {
  it('百分比：结余×rate/100', () => {
    assert.equal(reinvestFromSurplus(10000, { mode: 'percent', rate: 30, amount: 0 }), 3000);
  });

  it('金额：封顶不超过结余', () => {
    assert.equal(reinvestFromSurplus(2000, { mode: 'amount', rate: 30, amount: 5000 }), 2000);
    assert.equal(reinvestFromSurplus(8000, { mode: 'amount', rate: 30, amount: 2500 }), 2500);
  });

  it('结余≤0 → 0', () => {
    assert.equal(reinvestFromSurplus(0, { mode: 'percent', rate: 50, amount: 0 }), 0);
    assert.equal(reinvestFromSurplus(-100, { mode: 'amount', rate: 0, amount: 1000 }), 0);
  });

  it('年结余：金额模式×12 再封顶', () => {
    assert.equal(reinvestFromAnnualSurplus(100000, { mode: 'amount', rate: 0, amount: 2000 }), 24000);
    assert.equal(reinvestFromAnnualSurplus(10000, { mode: 'amount', rate: 0, amount: 2000 }), 10000);
    assert.equal(reinvestFromAnnualSurplus(120000, { mode: 'percent', rate: 25, amount: 0 }), 30000);
  });
});

describe('switchReinvestMode / effectiveInvestRate', () => {
  it('%→金额：用结余×% 作初值', () => {
    const next = switchReinvestMode({ mode: 'percent', rate: 30, amount: 0 }, 'amount', 10000);
    assert.equal(next.mode, 'amount');
    assert.equal(next.amount, 3000);
    assert.equal(next.rate, 30);
  });

  it('金额→%：用金额/结余推比例', () => {
    const next = switchReinvestMode({ mode: 'amount', rate: 30, amount: 2500 }, 'percent', 10000);
    assert.equal(next.mode, 'percent');
    assert.equal(next.rate, 25);
    assert.equal(next.amount, 2500);
  });

  it('effectiveInvestRate 金额模式换算 %', () => {
    assert.equal(effectiveInvestRate(10000, { mode: 'amount', rate: 0, amount: 2500 }), 25);
    assert.equal(effectiveInvestRate(0, { mode: 'amount', rate: 0, amount: 2500 }), 0);
    assert.equal(effectiveInvestRate(10000, { mode: 'percent', rate: 40, amount: 0 }), 40);
  });

  it('reinvestToProfile 扁平字段', () => {
    assert.deepEqual(reinvestToProfile({ mode: 'amount', rate: 30, amount: 1200 }), {
      reinvestMode: 'amount',
      reinvestRate: 30,
      reinvestAmount: 1200,
    });
  });
});
