/**
 * 城市社保缴费基数快捷表（月，元）
 * 用于退休规划「社保基数」快捷填入；选城市只写入数值，不锁死，仍可手改。
 *
 * ponytail: 非权威政策库。广州对齐本仓库 GUANGZHOU_SOCIAL_RULE_2026；
 * 其余城为合理占位（偏近年人社通告量级）。更新方式：对照各地人社局
 * 「缴费工资基数上下限」通告改 year / base / min / max。
 */

export type CitySocialBasePreset = {
  id: string;
  name: string;
  /** 口径年度（展示用，如 2026） */
  year: number;
  /** 快捷填入「社保基数」的常用值（有上下限时取下限/默认） */
  base: number;
  min?: number;
  max?: number;
};

export const CITY_SOCIAL_BASE_PRESETS: readonly CitySocialBasePreset[] = [
  // 与 retirement.ts GUANGZHOU_SOCIAL_RULE_2026 同源
  { id: 'guangzhou', name: '广州', year: 2026, base: 5510, min: 5510, max: 27534 },
  // 北京 2025.7–2026.6 官方：下限 7162 / 上限 35811
  { id: 'beijing', name: '北京', year: 2026, base: 7162, min: 7162, max: 35811 },
  // ponytail: 上海占位（量级参考近年通告，非公报摘录）
  { id: 'shanghai', name: '上海', year: 2026, base: 7384, min: 7384, max: 36921 },
  // ponytail: 深圳占位（养老下限量级；医保等险种可能不同）
  { id: 'shenzhen', name: '深圳', year: 2026, base: 5284, min: 5284, max: 27549 },
  // ponytail: 杭州 / 成都占位
  { id: 'hangzhou', name: '杭州', year: 2026, base: 4462, min: 4462, max: 22311 },
  { id: 'chengdu', name: '成都', year: 2026, base: 4511, min: 4511, max: 22555 },
];

export const DEFAULT_CITY_SOCIAL_BASE_ID = 'guangzhou';

export function getCitySocialBasePreset(id: string): CitySocialBasePreset | undefined {
  return CITY_SOCIAL_BASE_PRESETS.find((item) => item.id === id);
}

/** 默认社保基数（广州当年常用值） */
export function defaultSocialBase(): number {
  return getCitySocialBasePreset(DEFAULT_CITY_SOCIAL_BASE_ID)?.base ?? 5510;
}

/** 选城市 → 填入用的基数值；未知 id 返回 null */
export function resolveCitySocialBase(id: string): number | null {
  const preset = getCitySocialBasePreset(id);
  if (!preset) return null;
  return preset.base;
}
