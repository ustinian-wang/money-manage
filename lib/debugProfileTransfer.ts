/**
 * dbg：导出 / 导入用户 profile（复用本机草稿与 PUT 的 profile JSON 形状）
 */
import { loadGuestDraft, saveGuestDraft } from './persistence/guestDraft';

export type ParseImportResult =
  | { ok: true; profile: Record<string, unknown> }
  | { ok: false; error: string };

export type ApplyImportResult =
  | { ok: true; mode: 'guest' | 'user' }
  | { ok: false; error: string };

/** 至少具备其一才视为可导入的财务 profile */
const PROFILE_MARKERS = [
  'schemaVersion',
  'totalAssets',
  'salary',
  'expenses',
  'cash',
  'invest',
] as const;

type LiveProfileProvider = () => Record<string, unknown> | null;

let liveProvider: LiveProfileProvider | null = null;

/** 主页挂载时注册当前 React profile；卸载清空 */
export function registerDebugLiveProfile(provider: LiveProfileProvider | null): void {
  liveProvider = provider;
}

/** 从 API GET / PUT 包装中取出 profile；已是扁平 profile 则原样返回 */
export function unwrapProfilePayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed;
  const obj = parsed as Record<string, unknown>;

  if (obj.state && typeof obj.state === 'object' && !Array.isArray(obj.state)) {
    const state = obj.state as Record<string, unknown>;
    if (state.profile && typeof state.profile === 'object' && !Array.isArray(state.profile)) {
      return state.profile;
    }
  }

  if (obj.profile && typeof obj.profile === 'object' && !Array.isArray(obj.profile)) {
    // PersistedState /api/profile：带 revision/snapshots；或仅 { profile }
    if (
      'revision' in obj
      || 'snapshots' in obj
      || 'scenarios' in obj
      || 'updatedAt' in obj
      || Object.keys(obj).every((k) => k === 'profile' || k === 'schemaVersion')
    ) {
      return obj.profile;
    }
  }

  return parsed;
}

/** 导出到剪贴板用的 profile JSON 文本 */
export function serializeProfileForClipboard(profile: Record<string, unknown>): string {
  return JSON.stringify(profile, null, 2);
}

export function parseImportProfileJson(text: string): ParseImportResult {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    return { ok: false, error: '内容为空，请粘贴导出的 profile JSON' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: '非法 JSON，请粘贴有效的 profile 文本' };
  }

  const unwrapped = unwrapProfilePayload(parsed);
  if (!unwrapped || typeof unwrapped !== 'object' || Array.isArray(unwrapped)) {
    return { ok: false, error: '缺少有效的 profile 对象' };
  }

  const profile = unwrapped as Record<string, unknown>;
  if ('overlays' in profile && 'vv' in profile && 'zIndexContract' in profile) {
    return { ok: false, error: '这是调试环境快照，不是用户财务数据' };
  }

  const hasMarker = PROFILE_MARKERS.some((key) => key in profile);
  if (!hasMarker) {
    return {
      ok: false,
      error: '缺少关键字段（如 schemaVersion / totalAssets / salary / expenses）',
    };
  }

  return { ok: true, profile };
}

async function resolveAuthUserId(): Promise<string | null> {
  try {
    const meRes = await fetch('/api/auth/me');
    if (!meRes.ok) return null;
    const data = (await meRes.json()) as { user?: { id?: string } | null };
    const id = data.user?.id;
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/** 优先主页实时 profile；否则本机草稿 / 云端 */
export async function resolveExportProfile(): Promise<Record<string, unknown> | null> {
  const live = liveProvider?.();
  if (live && typeof live === 'object' && !Array.isArray(live)) return live;

  const userId = await resolveAuthUserId();
  if (userId) {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const state = (await res.json()) as { profile?: Record<string, unknown> };
        if (state?.profile && Object.keys(state.profile).length > 0) return state.profile;
      }
    } catch {
      /* 离线回落本机 */
    }
    return loadGuestDraft({ userId }) ?? loadGuestDraft();
  }
  return loadGuestDraft();
}

async function putProfileOverwrite(
  profile: Record<string, unknown>,
  revision: number,
): Promise<{ ok: true; revision: number } | { ok: false; error: string }> {
  let currentRev = revision;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: { profile }, revision: currentRev }),
      });
    } catch {
      return { ok: false, error: '云端写入失败（网络错误），未改动本机数据' };
    }

    if (res.ok) {
      const next = (await res.json().catch(() => null)) as { revision?: number } | null;
      return {
        ok: true,
        revision: typeof next?.revision === 'number' ? next.revision : currentRev + 1,
      };
    }

    if (res.status !== 409) {
      return { ok: false, error: `云端写入失败 HTTP ${res.status}，未改动本机数据` };
    }

    const data = (await res.json().catch(() => null)) as { state?: { revision?: number } } | null;
    const serverRev = data?.state?.revision;
    if (typeof serverRev !== 'number') {
      return { ok: false, error: '云端 revision 冲突且无法重试，未改动本机数据' };
    }
    currentRev = serverRev;
  }
  return { ok: false, error: '云端 revision 冲突，未改动本机数据' };
}

/**
 * 导入覆盖：先校验（调用方），再写持久化。
 * 登录：先云端成功再写本机；访客：只写本机草稿。
 * 成功后由调用方 reload 以 hydrate UI。
 */
export async function applyImportedProfile(
  profile: Record<string, unknown>,
): Promise<ApplyImportResult> {
  const userId = await resolveAuthUserId();

  if (userId) {
    let revision = 0;
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const state = (await res.json()) as { revision?: number };
        if (typeof state?.revision === 'number') revision = state.revision;
      }
    } catch {
      /* 用 0，冲突时重试 */
    }

    const put = await putProfileOverwrite(profile, revision);
    if (!put.ok) return put;

    saveGuestDraft(profile, { userId });
    return { ok: true, mode: 'user' };
  }

  saveGuestDraft(profile);
  return { ok: true, mode: 'guest' };
}
