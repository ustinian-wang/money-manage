export type ProfileSyncPhase = 'idle' | 'syncing' | 'synced' | 'failed' | 'conflict';

export type ProfileSyncStatus = {
  phase: ProfileSyncPhase;
  at?: string;
  message?: string;
};

export type ProfileSyncState = {
  profile: unknown;
  snapshots: unknown[];
  scenarios: unknown[];
};

type ProfileSyncOptions = {
  apiPath?: string;
  initialRevision?: number;
  fetcher?: typeof fetch;
  onStatus?: (status: ProfileSyncStatus) => void;
};

export function createProfileSyncQueue(options: ProfileSyncOptions = {}) {
  const apiPath = options.apiPath ?? '/api/profile';
  const fetcher = options.fetcher ?? fetch;
  let revision = Math.max(0, options.initialRevision ?? 0);
  let queued: ProfileSyncState | null = null;
  let running = false;
  let conflictRevision: number | null = null;
  let conflictBlocked = false;
  let drainPromise: Promise<void> = Promise.resolve();

  const report = (status: ProfileSyncStatus) => options.onStatus?.(status);

  const drain = async () => {
    if (running) return drainPromise;
    running = true;
    try {
      while (queued) {
        const state = queued;
        queued = null;
        report({ phase: 'syncing' });
        try {
          const response = await fetcher(apiPath, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ revision, state }),
            keepalive: true,
          });
          const payload = await response.json().catch(() => ({})) as {
            revision?: number;
            state?: { revision?: number };
            error?: string;
          };
          if (response.status === 409) {
            const currentRevision = Number(payload.state?.revision);
            conflictRevision = Number.isFinite(currentRevision) ? Math.max(0, currentRevision) : null;
            conflictBlocked = true;
            queued = null;
            report({ phase: 'conflict', message: '云端数据已更新；继续将覆盖云端版本' });
            break;
          }
          if (!response.ok || !Number.isFinite(Number(payload.revision))) {
            queued = null;
            report({ phase: 'failed', message: payload.error || '云端同步失败' });
            break;
          }
          revision = Math.max(0, Number(payload.revision));
          report({ phase: 'synced', at: new Date().toLocaleTimeString('zh-CN') });
        } catch {
          queued = null;
          report({ phase: 'failed', message: '网络异常，数据仅保存在本机' });
          break;
        }
      }
    } finally {
      running = false;
    }
  };

  return {
    enqueue(state: ProfileSyncState) {
      if (conflictBlocked) {
        queued = null;
        report({ phase: 'conflict', message: '云端数据已更新；继续将覆盖云端版本' });
        return Promise.resolve();
      }
      queued = state;
      if (!running) drainPromise = drain();
      return drainPromise;
    },
    flush() {
      if (!running && queued) drainPromise = drain();
      return drainPromise;
    },
    setRevision(nextRevision: number) {
      revision = Math.max(0, Number.isFinite(nextRevision) ? nextRevision : 0);
      conflictRevision = null;
      conflictBlocked = false;
    },
    resolveConflictWithLocal(state: ProfileSyncState) {
      if (!conflictBlocked || conflictRevision == null) {
        report({ phase: 'failed', message: '无法确认云端版本，请刷新后重试' });
        return Promise.resolve();
      }
      revision = conflictRevision;
      conflictRevision = null;
      conflictBlocked = false;
      queued = state;
      if (!running) drainPromise = drain();
      return drainPromise;
    },
    get revision() {
      return revision;
    },
  };
}
