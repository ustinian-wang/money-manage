/**
 * 登录/注册后空账号绑定：云端有数据用云端；注册写默认画像；登录可确认绑定访客草稿
 * 从主页 handleAuthed 抽出，供 /login · /register 复用
 */
import { resolveGuestProfile, loadGuestDraft } from '../persistence/guestDraft';

export type AuthBindMeta = { from: 'login' | 'register' };

export type BindEmptyAccountResult =
  | { status: 'has_server'; revision: number }
  | { status: 'bound'; revision: number }
  | { status: 'skipped' }
  | { status: 'error' };

/** 登录空账号：绑定访客草稿确认文案（供 ConfirmDialog） */
export const EMPTY_LOGIN_BIND_MESSAGE =
  '该账号云端暂无数据。是否将当前访客/本机草稿绑定到此账号？\n选「取消」则保留空账号（页面继续用当前示例/草稿，但不上传）。';

/** 主页点「注册」前确认：新账号用默认数据，不认领访客草稿 */
export const REGISTER_DEFAULT_DATA_MESSAGE =
  '新账号将使用系统默认数据起步，不会把当前访客测算草稿绑定到账号。\n访客草稿仍仅保存在本机。是否继续注册？';

type BindOpts = {
  /**
   * 登录空账号二次确认（ConfirmDialog / 测试注入）。
   * 支持同步或 Promise；未提供则 skipped（不上传）。
   */
  confirmEmptyLogin?: () => boolean | Promise<boolean>;
  /** 覆盖本机草稿读取（测试用；仅登录绑定） */
  readDraft?: () => Record<string, unknown> | null;
  /** 覆盖注册默认画像（测试用） */
  defaultProfile?: () => Record<string, unknown>;
  fetchImpl?: typeof fetch;
};

function readLocalDraft(): Record<string, unknown> | null {
  // 认领始终读访客键，不读登录用户本机缓存
  return loadGuestDraft();
}

/** 新注册账号默认画像（轻演示默认，非当前访客草稿） */
export function defaultNewAccountProfile(): Record<string, unknown> {
  return { ...resolveGuestProfile(null).profile };
}

/** 空账号：注册写入默认画像，或登录确认后 PUT 访客草稿 */
export async function bindEmptyAccountAfterAuth(
  meta: AuthBindMeta,
  opts: BindOpts = {},
): Promise<BindEmptyAccountResult> {
  const fetchFn = opts.fetchImpl ?? fetch;
  try {
    const response = await fetchFn('/api/profile');
    if (!response.ok) return { status: 'error' };
    const state = await response.json();
    const hasServer = state?.profile && Object.keys(state.profile).length > 0;
    if (hasServer) {
      return { status: 'has_server', revision: Number(state.revision) || 0 };
    }

    let toBind: Record<string, unknown>;
    if (meta.from === 'register') {
      // 注册：始终默认数据，绝不绑定当前访客草稿
      toBind = (opts.defaultProfile ?? defaultNewAccountProfile)();
    } else {
      const confirm = opts.confirmEmptyLogin;
      if (!confirm) return { status: 'skipped' };
      const ok = await confirm();
      if (!ok) return { status: 'skipped' };
      toBind = { ...((opts.readDraft ?? readLocalDraft)() || {}) };
    }

    // ponytail: 剥离旧草稿 snapshots；云端固定空数组兼容 schema
    const { snapshots: _ignored, ...rest } = toBind;
    const put = await fetchFn('/api/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision: 0, state: { profile: rest, snapshots: [], scenarios: [] } }),
    });
    if (!put.ok) return { status: 'error' };
    const next = await put.json().catch(() => ({}));
    return { status: 'bound', revision: Number(next?.revision) || 0 };
  } catch {
    return { status: 'error' };
  }
}
