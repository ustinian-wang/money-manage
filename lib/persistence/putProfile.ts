/**
 * 登录态 PUT /api/profile：串行 + 409 用服务端 revision 重试一次
 * （多 blur 并发时避免 revision 撞车）
 */
export type PutProfileHooks = {
  getRevision: () => number;
  setRevision: (revision: number) => void;
};

type QueueItem = {
  profile: unknown;
  hooks: PutProfileHooks;
};

let tail: Promise<void> = Promise.resolve();
let pending: QueueItem | null = null;
let running = false;

async function putOnce(profile: unknown, revision: number): Promise<Response> {
  return fetch('/api/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ state: { profile }, revision }),
    keepalive: true,
  });
}

async function putWithConflictRetry(profile: unknown, hooks: PutProfileHooks): Promise<void> {
  let revision = hooks.getRevision();
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await putOnce(profile, revision);
    } catch {
      return;
    }
    if (res.ok) {
      const next = await res.json().catch(() => null);
      if (next && typeof next.revision === 'number') hooks.setRevision(next.revision);
      return;
    }
    if (res.status !== 409) return;
    const data = await res.json().catch(() => null) as { state?: { revision?: number } } | null;
    const serverRev = data?.state?.revision;
    if (typeof serverRev !== 'number') return;
    hooks.setRevision(serverRev);
    revision = serverRev;
  }
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (pending) {
      const item = pending;
      pending = null;
      await putWithConflictRetry(item.profile, item.hooks);
    }
  } finally {
    running = false;
    if (pending) await drain();
  }
}

/** 合并连续请求：只 PUT 最新 profile */
export function enqueueProfilePut(profile: unknown, hooks: PutProfileHooks): Promise<void> {
  pending = { profile, hooks };
  tail = tail.then(drain, drain);
  return tail;
}
