/**
 * 登录/注册后空账号绑定：云端有数据用云端；否则按认领方式写入本机草稿
 * 从主页 handleAuthed 抽出，供 /login · /register 复用
 */
import { emptyClaimProfilePatch, parseClaimMode, type ClaimMode } from '../claimGate';

export type AuthBindMeta = { from: 'login' | 'register'; claimMode?: ClaimMode };

export type BindEmptyAccountResult =
  | { status: 'has_server'; revision: number }
  | { status: 'bound'; revision: number }
  | { status: 'skipped' }
  | { status: 'error' };

type BindOpts = {
  /** 登录空账号二次确认；默认 window.confirm */
  confirmEmptyLogin?: () => boolean;
  /** 覆盖本机草稿读取（测试用） */
  readDraft?: () => Record<string, unknown> | null;
  fetchImpl?: typeof fetch;
};

function readLocalDraft(): Record<string, unknown> | null {
  try {
    const saved = localStorage.getItem('money-manage-profile');
    if (!saved) return null;
    return JSON.parse(saved) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 空账号：注册认领/清空，或登录确认后 PUT */
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

    const draft = (opts.readDraft ?? readLocalDraft)() || {};
    let toBind: Record<string, unknown> = { ...draft };

    if (meta.from === 'register' && parseClaimMode(meta.claimMode) === 'clear') {
      toBind = { ...draft, ...emptyClaimProfilePatch() };
    } else if (meta.from === 'login') {
      const confirm = opts.confirmEmptyLogin
        ?? (() => window.confirm(
          '该账号云端暂无数据。是否将当前访客/本机草稿绑定到此账号？\n选「取消」则保留空账号（页面继续用当前示例/草稿，但不上传）。',
        ));
      if (!confirm()) return { status: 'skipped' };
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
