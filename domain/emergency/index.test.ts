/**
 * 应急/现金：默认 cashDirect 与应急 monthsPlan 分存；
 * select 切换只改 mode + 生效现金，另一套原样保留。
 * 产品：现金行 select 默认/应急月数 + 二级应急设置
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_EMERGENCY,
  activeCash,
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
  type EmergencySetting,
} from './index';

describe('parseEmergencySetting', () => {
  it('缺省 → 关闭 + 默认模式空套', () => {
    assert.deepEqual(parseEmergencySetting({}), DEFAULT_EMERGENCY);
  });

  it('旧画像仅有 emergencyMonths>0 → 启用按月；两套现金同起点', () => {
    assert.deepEqual(parseEmergencySetting({ emergencyMonths: 6 }), {
      enabled: true,
      mode: 'months',
      cashDirect: 0,
      monthsPlan: { months: 6, annualSpend: 0, cash: 0 },
    });
  });

  it('显式关闭优先于旧月数', () => {
    assert.equal(parseEmergencySetting({ emergencyEnabled: false, emergencyMonths: 6 }).enabled, false);
  });

  it('旧固定金额 → cashDirect；兼容 emergencyAmount', () => {
    assert.deepEqual(
      parseEmergencySetting({ emergencyEnabled: true, emergencyMode: 'amount', emergencyAmount: 50000 }),
      {
        enabled: true,
        mode: 'amount',
        cashDirect: 50000,
        monthsPlan: { months: 0, annualSpend: 0, cash: 50000 },
      },
    );
  });

  it('解析 emergencyAnnualSpend 进 monthsPlan', () => {
    assert.equal(
      parseEmergencySetting({ emergencyAnnualSpend: 120000, emergencyMode: 'months', emergencyMonths: 3 }).monthsPlan.annualSpend,
      120000,
    );
  });

  it('新字段 emergencyCashDirect / emergencyMonthsCash 分存优先', () => {
    const parsed = parseEmergencySetting({
      emergencyMode: 'amount',
      emergencyCashDirect: 50000,
      emergencyMonthsCash: 30000,
      emergencyMonths: 3,
      emergencyAnnualSpend: 120000,
      cash: 50000,
    });
    assert.equal(parsed.cashDirect, 50000);
    assert.equal(parsed.monthsPlan.cash, 30000);
    assert.equal(parsed.monthsPlan.months, 3);
    assert.equal(parsed.mode, 'amount');
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

  it('applyAnnualSpendPlan：改往年 → 月均×月数重算金额；往年=用户值', () => {
    const { cash, setting } = applyAnnualSpendPlan(
      {
        ...DEFAULT_EMERGENCY,
        mode: 'months',
        cashDirect: 50000,
        monthsPlan: { months: 3, annualSpend: 0, cash: 0 },
      },
      120000,
      100000,
    );
    assert.equal(setting.monthsPlan.annualSpend, 120000);
    assert.equal(cash, 30000);
    assert.equal(setting.monthsPlan.months, 3);
    assert.equal(setting.monthsPlan.cash, 30000);
    assert.equal(setting.cashDirect, 30000);
  });

  it('改金额不回写往年支出；改往年支出会更新金额（保持月数）', () => {
    const base = {
      ...DEFAULT_EMERGENCY,
      mode: 'months' as const,
      cashDirect: 30000,
      monthsPlan: { months: 3, annualSpend: 120000, cash: 30000 },
    };
    const afterCash = syncSettingFromCash(base, 40000, 10000);
    assert.equal(afterCash.monthsPlan.annualSpend, 120000);
    assert.equal(afterCash.monthsPlan.months, 4);
    assert.equal(afterCash.monthsPlan.cash, 40000);

    const afterAnnual = applyAnnualSpendPlan(base, 240000, 1000000);
    assert.equal(afterAnnual.setting.monthsPlan.annualSpend, 240000);
    assert.equal(afterAnnual.setting.monthsPlan.months, 3);
    assert.equal(afterAnnual.cash, 60000);
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

  it('syncSettingFromCash：改金额写两侧并反推月数，不改往年支出', () => {
    const next = syncSettingFromCash(
      {
        ...DEFAULT_EMERGENCY,
        mode: 'amount',
        cashDirect: 10000,
        monthsPlan: { months: 6, annualSpend: 120000, cash: 60000 },
      },
      24000,
      8000,
    );
    assert.equal(next.cashDirect, 24000);
    assert.equal(next.monthsPlan.cash, 24000);
    assert.equal(next.monthsPlan.months, 3);
    assert.equal(next.monthsPlan.annualSpend, 120000);
  });

  it('syncSettingFromCash months：改金额同步 cashDirect，不改往年支出', () => {
    const next = syncSettingFromCash(
      {
        ...DEFAULT_EMERGENCY,
        mode: 'months',
        cashDirect: 50000,
        monthsPlan: { months: 3, annualSpend: 96000, cash: 24000 },
      },
      16000,
      8000,
    );
    assert.equal(next.cashDirect, 16000);
    assert.equal(next.monthsPlan.cash, 16000);
    assert.equal(next.monthsPlan.months, 2);
    assert.equal(next.monthsPlan.annualSpend, 96000);
  });

  it('applyMonthsPlan：月数→现金封顶；回写 cashDirect；不改往年支出', () => {
    const { cash, setting } = applyMonthsPlan(
      {
        ...DEFAULT_EMERGENCY,
        enabled: true,
        mode: 'months',
        cashDirect: 50000,
        monthsPlan: { months: 0, annualSpend: 120000, cash: 0 },
      },
      6,
      10000,
      40000,
    );
    // 6×10000=60000 > 总资产 40000 → 现金 40000，月数反算 4
    assert.equal(cash, 40000);
    assert.equal(setting.monthsPlan.months, 4);
    assert.equal(setting.monthsPlan.cash, 40000);
    assert.equal(setting.cashDirect, 40000);
    assert.equal(setting.monthsPlan.annualSpend, 120000);
  });

  it('applyMonthsPlan：未超总资产时现金=月数×支出；回写 cashDirect', () => {
    const { cash, setting } = applyMonthsPlan(
      {
        ...DEFAULT_EMERGENCY,
        mode: 'months',
        cashDirect: 10000,
        monthsPlan: { months: 0, annualSpend: 96000, cash: 0 },
      },
      3,
      8000,
      100000,
    );
    assert.equal(cash, 24000);
    assert.equal(setting.monthsPlan.months, 3);
    assert.equal(setting.cashDirect, 24000);
    assert.equal(setting.monthsPlan.annualSpend, 96000);
  });
});

describe('emergencyReserve = 当前 mode 现金', () => {
  it('有 cash 参数时直接返回现金', () => {
    assert.equal(
      emergencyReserve(
        { ...DEFAULT_EMERGENCY, mode: 'months', monthsPlan: { months: 6, annualSpend: 0, cash: 0 } },
        10000,
        50000,
      ),
      50000,
    );
  });

  it('无 cash 时按 activeCash（当前 mode）', () => {
    assert.equal(
      emergencyReserve(
        { ...DEFAULT_EMERGENCY, enabled: true, mode: 'amount', cashDirect: 12000 },
        8000,
      ),
      12000,
    );
    assert.equal(
      emergencyReserve(
        {
          ...DEFAULT_EMERGENCY,
          enabled: true,
          mode: 'months',
          cashDirect: 99999,
          monthsPlan: { months: 3, annualSpend: 96000, cash: 24000 },
        },
        0,
      ),
      24000,
    );
  });
});

describe('分存：select 切换互不覆盖', () => {
  it('activeCash 跟随 mode', () => {
    const setting = {
      ...DEFAULT_EMERGENCY,
      mode: 'amount' as const,
      cashDirect: 50000,
      monthsPlan: { months: 3, annualSpend: 120000, cash: 30000 },
    };
    assert.equal(activeCash(setting), 50000);
    assert.equal(activeCash({ ...setting, mode: 'months' }), 30000);
  });

  it('切到 amount：只改 mode，monthsPlan 原样', () => {
    const plan = { months: 3, annualSpend: 120000, cash: 30000 };
    const next = switchEmergencyMode(
      { ...DEFAULT_EMERGENCY, enabled: true, mode: 'months', cashDirect: 50000, monthsPlan: plan },
      'amount',
      0,
    );
    assert.equal(next.mode, 'amount');
    assert.equal(next.cashDirect, 50000);
    assert.deepEqual(next.monthsPlan, plan);
  });

  it('enableMonthsPlan：已有应急套时只切 mode，不覆盖 monthsPlan / cashDirect', () => {
    const plan = { months: 3, annualSpend: 120000, cash: 30000 };
    const next = enableMonthsPlan(
      { ...DEFAULT_EMERGENCY, mode: 'amount', cashDirect: 50000, monthsPlan: plan },
      8000,
      50000,
    );
    assert.equal(next.mode, 'months');
    assert.equal(next.cashDirect, 50000);
    assert.deepEqual(next.monthsPlan, plan);
  });

  it('enableMonthsPlan：空应急套不写往年支出，月数反算自 cashDirect', () => {
    const next = enableMonthsPlan(
      { ...DEFAULT_EMERGENCY, mode: 'amount', cashDirect: 16000 },
      8000,
    );
    assert.equal(next.mode, 'months');
    assert.equal(next.monthsPlan.annualSpend, 0);
    assert.equal(next.monthsPlan.months, 2);
    assert.equal(next.monthsPlan.cash, 16000);
    assert.equal(next.cashDirect, 16000);
  });

  it('往返切换：切 mode 保留分存；规划后金额两侧一致且不改往年', () => {
    let setting: EmergencySetting = {
      ...DEFAULT_EMERGENCY,
      mode: 'amount' as const,
      cashDirect: 50000,
      monthsPlan: { months: 0, annualSpend: 96000, cash: 0 },
    };
    setting = enableMonthsPlan(setting, 8000);
    assert.equal(setting.mode, 'months');
    const planned = applyMonthsPlan(setting, 3, monthlyFromAnnual(setting.monthsPlan.annualSpend), 200000);
    setting = planned.setting;
    assert.equal(setting.monthsPlan.cash, 24000);
    assert.equal(setting.cashDirect, 24000);
    assert.equal(setting.monthsPlan.annualSpend, 96000);
    setting = switchEmergencyMode(setting, 'amount', 8000);
    assert.equal(setting.mode, 'amount');
    assert.equal(activeCash(setting), 24000);
    setting = enableMonthsPlan(setting, 8000);
    assert.equal(setting.mode, 'months');
    assert.equal(activeCash(setting), 24000);
  });

  it('emergencyToProfile 写出分存字段；compat emergencyAmount=生效现金', () => {
    assert.deepEqual(
      emergencyToProfile({ ...DEFAULT_EMERGENCY }),
      {
        emergencyMode: 'amount',
        emergencyCashDirect: 0,
        emergencyMonths: 0,
        emergencyMonthsCash: 0,
        emergencyAmount: 0,
        emergencyAnnualSpend: 0,
      },
    );
    const profile = emergencyToProfile(
      {
        ...DEFAULT_EMERGENCY,
        mode: 'months',
        cashDirect: 50000,
        monthsPlan: { months: 3, annualSpend: 120000, cash: 24000 },
      },
    );
    assert.equal(profile.emergencyEnabled, true);
    assert.equal(profile.emergencyCashDirect, 50000);
    assert.equal(profile.emergencyMonthsCash, 24000);
    assert.equal(profile.emergencyAmount, 24000);
    assert.equal(profile.emergencyAnnualSpend, 120000);
  });
});

describe('与理财联动（现金+理财=总资产）', () => {
  it('月数规划现金后，理财=总资产−现金', () => {
    const total = 100000;
    const { cash } = applyMonthsPlan(
      {
        ...DEFAULT_EMERGENCY,
        mode: 'months',
        monthsPlan: { months: 0, annualSpend: 120000, cash: 0 },
      },
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
