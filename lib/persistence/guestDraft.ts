/**
 * 访客本机草稿：只读写 localStorage，不碰云端
 * 新浏览器 / 清站点数据 → 无草稿 → 回落 LIGHT_DEMO
 */
import { LIGHT_DEMO_ASSETS, LIGHT_DEMO_EXPENSES, type DemoExpenseSeed } from '../demoDefaults';

export const GUEST_PROFILE_KEY = 'money-manage-profile';

export type GuestStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type GuestResolveSource = 'draft' | 'demo';

export type GuestDemoProfile = {
  totalAssets: number;
  cash: number;
  invest: number;
  investRatio: number;
  expenses: DemoExpenseSeed[];
};

/** 写入访客草稿（仅本机） */
export function saveGuestDraft(profile: unknown, storage: GuestStorage = localStorage): void {
  storage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
}

/** 读草稿；无键 / 坏 JSON → null */
export function loadGuestDraft(storage: GuestStorage = localStorage): Record<string, unknown> | null {
  try {
    const raw = storage.getItem(GUEST_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 有草稿用草稿；否则回落轻演示默认 */
export function resolveGuestProfile(raw: Record<string, unknown> | null): {
  source: GuestResolveSource;
  profile: Record<string, unknown> | GuestDemoProfile;
} {
  if (raw) return { source: 'draft', profile: raw };
  return {
    source: 'demo',
    profile: {
      totalAssets: LIGHT_DEMO_ASSETS.totalAssets,
      cash: LIGHT_DEMO_ASSETS.cash,
      invest: LIGHT_DEMO_ASSETS.invest,
      investRatio: LIGHT_DEMO_ASSETS.investRatio,
      expenses: LIGHT_DEMO_EXPENSES.map((row) => ({ ...row })),
    },
  };
}
