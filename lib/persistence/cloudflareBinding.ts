/**
 * 远程 MONEY_DATA（CF KV/R2）绑定
 * - 生产 Worker：全局已注入 __cloudflare-context__，直接用
 * - 本地 next dev：默认不调 wrangler（Windows workerd 会 AV）；CLOUDFLARE_DEV=1 才启用
 */
export type MoneyDataBinding = {
    get(key: string, type?: string): Promise<unknown>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<unknown>;
    delete?(key: string): Promise<unknown>;
    list?(options?: { prefix?: string }): Promise<{ keys?: { name: string }[]; objects?: { key: string }[] }>;
};

const CF_CONTEXT_SYMBOL = Symbol.for('__cloudflare-context__');

function getInjectedMoneyData(): MoneyDataBinding | null {
    const ctx = (globalThis as Record<symbol, { env?: { MONEY_DATA?: MoneyDataBinding } }>)[CF_CONTEXT_SYMBOL];
    return ctx?.env?.MONEY_DATA ?? null;
}

/** 是否允许调用 getCloudflareContext → wrangler getPlatformProxy */
function allowWranglerProxy(): boolean {
    return process.env.CLOUDFLARE_DEV === '1';
}

export async function getMoneyDataBinding(): Promise<MoneyDataBinding | null> {
    const injected = getInjectedMoneyData();
    if (injected) return injected;
    if (!allowWranglerProxy()) return null;
    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const { env } = await getCloudflareContext({ async: true });
        return (env as { MONEY_DATA?: MoneyDataBinding }).MONEY_DATA ?? null;
    } catch {
        return null;
    }
}
