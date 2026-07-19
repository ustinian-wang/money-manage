import type { PersistedState } from './types';

export const LOCAL_STATE_KEY = 'money-manage:state';
export const LOCAL_REVISION_KEY = 'money-manage:local-revision';

export function createAutosave(options: { apiPath?: string; debounceMs?: number } = {}) {
    const apiPath = options.apiPath ?? '/api/profile';
    const debounceMs = options.debounceMs ?? 300;
    let timer: ReturnType<typeof setTimeout> | undefined;
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
        const state = latest;
        pending = fetch(apiPath, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state, revision: state.revision }), keepalive: true })
            .then((response) => { if (!response.ok) throw new Error(`Autosave failed (${response.status})`); })
            .finally(() => { pending = undefined; });
        return pending;
    };

    const schedule = (state: PersistedState) => {
        saveLocal(state);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { timer = undefined; void flush(); }, debounceMs);
    };

    const bindLifecycle = () => {
        if (typeof window === 'undefined') return () => undefined;
        const flushOnHide = () => { if (timer) clearTimeout(timer); void flush(); };
        window.addEventListener('pagehide', flushOnHide);
        return () => window.removeEventListener('pagehide', flushOnHide);
    };

    const onInput = (state: PersistedState) => schedule(state);
    const onBlur = (state: PersistedState) => { saveLocal(state); return flush(); };
    const onChange = (state: PersistedState) => { saveLocal(state); return flush(); };

    return { schedule, flush, onInput, onBlur, onChange, bindLifecycle, get pending() { return pending; } };
}
