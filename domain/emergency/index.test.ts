/**
 * 应急资金：开关、按月/固定双模式、准备金计算与落盘
 * 需求：资产配置内可选应急；关闭=不参与；按月=月数×月支出
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_EMERGENCY,
  emergencyReserve,
  emergencyToProfile,
  parseEmergencySetting,
  switchEmergencyMode,
} from './index';

describe('parseEmergencySetting', () => {
  it('缺省 → 关闭 + 按月 0', () => {
    assert.deepEqual(parseEmergencySetting({}), DEFAULT_EMERGENCY);
  });

  it('旧画像仅有 emergencyMonths>0 → 启用按月', () => {
    assert.deepEqual(parseEmergencySetting({ emergencyMonths: 6 }), {
      enabled: true,
      mode: 'months',
      months: 6,
      amount: 0,
    });
  });

  it('显式关闭优先于旧月数', () => {
    assert.equal(parseEmergencySetting({ emergencyEnabled: false, emergencyMonths: 6 }).enabled, false);
  });

  it('固定金额模式', () => {
    assert.deepEqual(
      parseEmergencySetting({ emergencyEnabled: true, emergencyMode: 'amount', emergencyAmount: 50000 }),
      { enabled: true, mode: 'amount', months: 0, amount: 50000 },
    );
  });
});

describe('emergencyReserve', () => {
  it('关闭 → 0（不参与）', () => {
    assert.equal(emergencyReserve({ ...DEFAULT_EMERGENCY, months: 6 }, 10000), 0);
  });

  it('按月 = 月数 × 月支出', () => {
    assert.equal(
      emergencyReserve({ enabled: true, mode: 'months', months: 3, amount: 0 }, 8000),
      24000,
    );
  });

  it('固定金额直出', () => {
    assert.equal(
      emergencyReserve({ enabled: true, mode: 'amount', months: 6, amount: 12000 }, 8000),
      12000,
    );
  });
});

describe('switchEmergencyMode / toProfile', () => {
  it('按月→固定用当前准备金作初值', () => {
    const next = switchEmergencyMode(
      { enabled: true, mode: 'months', months: 3, amount: 0 },
      'amount',
      10000,
    );
    assert.equal(next.mode, 'amount');
    assert.equal(next.amount, 30000);
  });

  it('emergencyToProfile 仅启用时写 emergencyEnabled', () => {
    assert.deepEqual(
      emergencyToProfile({ enabled: false, mode: 'months', months: 0, amount: 0 }),
      { emergencyMode: 'months', emergencyMonths: 0, emergencyAmount: 0 },
    );
    assert.equal(
      emergencyToProfile({ enabled: true, mode: 'amount', months: 0, amount: 1 }).emergencyEnabled,
      true,
    );
  });
});
