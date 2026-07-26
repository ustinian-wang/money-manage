/**
 * 应急/现金：备用金=现金；往年÷12 月均 × 应急月数；select「应急月数」↔ mode=months
 * 产品：现金行 select 默认/应急月数 + 二级应急设置
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_EMERGENCY,
  annualFromMonthly,
  applyAnnualSpendPlan,
  applyMonthsPlan,
  cashFromMonths,
  enableMonthsPlan,
  emergencyReserve,
  emergencyToProfile,
  monthlyFromAnnual,
  monthsFromCash,
  parseEmergencySetting,
  resolvePlanMonthly,
  switchEmergencyMode,
  syncSettingFromCash,
} from './index';

describe('parseEmergencySetting', () => {
  it('缺省 → 关闭 + 直接填现金 0', () => {
    assert.deepEqual(parseEmergencySetting({}), DEFAULT_EMERGENCY);
  });

  it('旧画像仅有 emergencyMonths>0 → 启用按月', () => {
    assert.deepEqual(parseEmergencySetting({ emergencyMonths: 6 }), {
      enabled: true,
      mode: 'months',
      months: 6,
      amount: 0,
      annualSpend: 0,
    });
  });

  it('显式关闭优先于旧月数', () => {
    assert.equal(parseEmergencySetting({ emergencyEnabled: false, emergencyMonths: 6 }).enabled, false);
  });

  it('旧固定金额模式仍可解析', () => {
    assert.deepEqual(
      parseEmergencySetting({ emergencyEnabled: true, emergencyMode: 'amount', emergencyAmount: 50000 }),
      { enabled: true, mode: 'amount', months: 0, amount: 50000, annualSpend: 0 },
    );
  });

  it('解析 emergencyAnnualSpend', () => {
    assert.equal(
      parseEmergencySetting({ emergencyAnnualSpend: 120000, emergencyMode: 'months', emergencyMonths: 3 }).annualSpend,
      120000,
    );
  });
});

describe('往年支出 ÷12 月均', () => {
  it('monthlyFromAnnual：往年总额÷12 四舍五入到元', () => {
    assert.equal(monthlyFromAnnual(120000), 10000);
    assert.equal(monthlyFromAnnual(100000), 8333);
    assert.equal(monthlyFromAnnual(0), 0);
  });

  it('annualFromMonthly：本月×12 作种子', () => {
    assert.equal(annualFromMonthly(8000), 96000);
  });

  it('resolvePlanMonthly：有往年用÷12，否则回退本月支出', () => {
    assert.equal(resolvePlanMonthly(120000, 5000), 10000);
    assert.equal(resolvePlanMonthly(0, 5000), 5000);
  });

  it('applyAnnualSpendPlan：改往年 → 月均×月数 → 现金（封顶总资产）', () => {
    const { cash, setting } = applyAnnualSpendPlan(
      { ...DEFAULT_EMERGENCY, mode: 'months', months: 3, annualSpend: 0 },
      120000,
      100000,
    );
    assert.equal(setting.annualSpend, 120000);
    assert.equal(cash, 30000);
    assert.equal(setting.months, 3);
  });
});

describe('现金 ↔ 月数换算', () => {
  it('monthsFromCash：现金 ÷ 月支出，0.5 步进', () => {
    assert.equal(monthsFromCash(24000, 8000), 3);
    assert.equal(monthsFromCash(10000, 8000), 1.5);
    assert.equal(monthsFromCash(5000, 0), 0);
  });

  it('cashFromMonths：月数 × 月支出', () => {
    assert.equal(cashFromMonths(3, 8000), 24000);
    assert.equal(cashFromMonths(1.5, 8000), 12000);
  });

  it('syncSettingFromCash：写 amount 镜像并反算 months', () => {
    const next = syncSettingFromCash(
      { ...DEFAULT_EMERGENCY, mode: 'amount' },
      24000,
      8000,
    );
    assert.equal(next.amount, 24000);
    assert.equal(next.months, 3);
  });

  it('applyMonthsPlan：月数→现金，并被总资产封顶', () => {
    const { cash, setting } = applyMonthsPlan(
      { ...DEFAULT_EMERGENCY, enabled: true, mode: 'months', months: 0 },
      6,
      10000,
      40000,
    );
    // 6×10000=60000 > 总资产 40000 → 现金 40000，月数反算 4
    assert.equal(cash, 40000);
    assert.equal(setting.months, 4);
    assert.equal(setting.amount, 40000);
  });

  it('applyMonthsPlan：未超总资产时现金=月数×支出', () => {
    const { cash, setting } = applyMonthsPlan(
      { ...DEFAULT_EMERGENCY, mode: 'months' },
      3,
      8000,
      100000,
    );
    assert.equal(cash, 24000);
    assert.equal(setting.months, 3);
  });
});

describe('emergencyReserve = 现金', () => {
  it('有 cash 参数时直接返回现金（忽略旧开关）', () => {
    assert.equal(
      emergencyReserve({ ...DEFAULT_EMERGENCY, mode: 'months', months: 6 }, 10000, 50000),
      50000,
    );
  });

  it('无 cash 时按 mode 兜底', () => {
    assert.equal(
      emergencyReserve({ ...DEFAULT_EMERGENCY, enabled: true, mode: 'amount', amount: 12000 }, 8000),
      12000,
    );
    assert.equal(
      emergencyReserve({ ...DEFAULT_EMERGENCY, enabled: true, mode: 'months', months: 3, annualSpend: 96000 }, 0),
      24000,
    );
  });
});

describe('select 应急月数 / toProfile', () => {
  it('enableMonthsPlan：缺往年时用本月×12 播种，反算月数', () => {
    const next = enableMonthsPlan(
      { ...DEFAULT_EMERGENCY, mode: 'amount' },
      8000,
      16000,
    );
    assert.equal(next.mode, 'months');
    assert.equal(next.annualSpend, 96000);
    assert.equal(next.months, 2);
    assert.equal(next.amount, 16000);
  });

  it('切到 amount：现金不变，months 反算', () => {
    const next = switchEmergencyMode(
      { ...DEFAULT_EMERGENCY, enabled: true, mode: 'months', months: 3, annualSpend: 120000 },
      'amount',
      0,
      30000,
    );
    assert.equal(next.mode, 'amount');
    assert.equal(next.amount, 30000);
    assert.equal(next.months, 3);
  });

  it('emergencyToProfile 镜像现金与往年；months 模式写 emergencyEnabled', () => {
    assert.deepEqual(
      emergencyToProfile({ ...DEFAULT_EMERGENCY }, 0),
      { emergencyMode: 'amount', emergencyMonths: 0, emergencyAmount: 0, emergencyAnnualSpend: 0 },
    );
    const profile = emergencyToProfile(
      { ...DEFAULT_EMERGENCY, mode: 'months', months: 3, annualSpend: 120000 },
      24000,
    );
    assert.equal(profile.emergencyEnabled, true);
    assert.equal(profile.emergencyAmount, 24000);
    assert.equal(profile.emergencyAnnualSpend, 120000);
  });
});

describe('与理财联动（现金+理财=总资产）', () => {
  it('月数规划现金后，理财=总资产−现金', () => {
    const total = 100000;
    const { cash } = applyMonthsPlan(
      { ...DEFAULT_EMERGENCY, mode: 'months', annualSpend: 120000 },
      3,
      monthlyFromAnnual(120000),
      total,
    );
    const invest = total - cash;
    assert.equal(cash, 30000);
    assert.equal(invest, 70000);
    assert.equal(cash + invest, total);
  });
});
