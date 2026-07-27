/**
 * 本机 profile 草稿：只读写 localStorage，不碰云端
 * 键约定：
 * - 访客：`money-manage-profile:guest`（旧键 `money-manage-profile` 首次读时迁移）
 * - 登录：`money-manage-profile:{userId}`
 * 新浏览器 / 清站点数据 → 无草稿 → 回落 LIGHT_DEMO
 */
import { LIGHT_DEMO_ASSETS, LIGHT_DEMO_EXPENSES, type DemoExpenseSeed } from '../demoDefaults';

/** 旧单键（共享设备易串号）；仅作访客迁移源 */
export const LEGACY_PROFILE_KEY = 'money-manage-profile';
/** 访客本机草稿（新约定） */
export const GUEST_PROFILE_KEY = 'money-manage-profile:guest';

export type GuestStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

export type DraftAccessOptions = {
  storage?: GuestStorage;
  /** 登录用户本机缓存；缺省 / 空串 → 访客键 */
  userId?: string | null;
  /** 访客读时把旧键迁到 guest（默认 true） */
  migrateLegacy?: boolean;
};

export type GuestResolveSource = 'draft' | 'demo';

export type GuestDemoProfile = {
  totalAssets: number;
  cash: number;
  invest: number;
  investRatio: number;
  expenses: DemoExpenseSeed[];
};

/** 解析本机 profile 存储键 */
export function resolveProfileStorageKey(userId?: string | null): string {
  if (typeof userId === 'string' && userId.length > 0) {
    return `money-manage-profile:${userId}`;
  }
  return GUEST_PROFILE_KEY;
}

function parseDraft(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 写入本机草稿（访客或指定账号） */
export function saveGuestDraft(profile: unknown, options: DraftAccessOptions = {}): void {
  const storage = options.storage ?? localStorage;
  storage.setItem(resolveProfileStorageKey(options.userId), JSON.stringify(profile));
}

/** 读本机草稿；无键 / 坏 JSON → null。访客可迁移旧键。 */
export function loadGuestDraft(options: DraftAccessOptions = {}): Record<string, unknown> | null {
  const storage = options.storage ?? localStorage;
  const userId = options.userId;
  const key = resolveProfileStorageKey(userId);
  const direct = parseDraft(storage.getItem(key));
  if (direct) return direct;

  // 仅访客：旧单键 → guest 键
  const isGuest = key === GUEST_PROFILE_KEY;
  if (!isGuest || options.migrateLegacy === false) return null;

  const legacy = parseDraft(storage.getItem(LEGACY_PROFILE_KEY));
  if (!legacy) return null;
  storage.setItem(GUEST_PROFILE_KEY, JSON.stringify(legacy));
  storage.removeItem?.(LEGACY_PROFILE_KEY);
  return legacy;
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
