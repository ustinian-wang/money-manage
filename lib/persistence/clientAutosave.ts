import type { PersistedState } from './types';

export const LOCAL_STATE_KEY = 'money-manage:state';
export const LOCAL_REVISION_KEY = 'money-manage:local-revision';

/**
 * 本机/云端落盘：仅 blur（及 pagehide）写入；input/change 只更新内存 latest，不写 localStorage。
 * localOnly：永不 PUT（访客）。
 */
export function createAutosave(options: { apiPath?: string; debounceMs?: number; localOnly?: boolean } = {}) {
    const apiPath = options.apiPath ?? '/api/profile';
    // debounceMs 保留兼容；blur 落盘后不再用于按键防抖写盘
    void options.debounceMs;
    const localOnly = options.localOnly === true;
    let latest: PersistedState | undefined;
    let pending: Promise<unknown> | undefined;

    const saveLocal = (state: PersistedState) => {
        latest = state;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
            window.localStorage.setItem(LOCAL_REVISION_KEY, String(state.revision));
        }
    };

    const flush = () => {
        if (!latest || typeof window === 'undefined') return Promise.resolve();
        if (localOnly) return Promise.resolve();
        const state = latest;
        pending = fetch(apiPath, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state, revision: state.revision }), keepalive: true })
            .then((response) => { if (!response.ok) throw new Error(`Autosave failed (${response.status})`); })
            .finally(() => { pending = undefined; });
        return pending;
    };

    /** 仅记最新态，不写盘 */
    const touch = (state: PersistedState) => {
        latest = state;
    };

    const bindLifecycle = () => {
        if (typeof window === 'undefined') return () => undefined;
        const flushOnHide = () => {
            if (latest) saveLocal(latest);
            void flush();
        };
        window.addEventListener('pagehide', flushOnHide);
        return () => window.removeEventListener('pagehide', flushOnHide);
    };

    const onInput = (state: PersistedState) => touch(state);
    const onChange = (state: PersistedState) => touch(state);
    const onBlur = (state: PersistedState) => { saveLocal(state); return flush(); };

    return {
        schedule: touch,
        flush,
        onInput,
        onBlur,
        onChange,
        bindLifecycle,
        get pending() { return pending; },
    };
}
