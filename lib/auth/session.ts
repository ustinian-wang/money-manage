/**
 * 会话 cookie 解析 / 下发（HttpOnly）
 */
import { NextResponse } from 'next/server';
import {
    SESSION_COOKIE,
    SESSION_TTL_SEC,
    destroySession,
    getSessionUser,
    type PublicUser,
} from './store';

export function readSessionToken(request: Request): string | null {
    const header = request.headers.get('cookie') || '';
    const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
    return match ? decodeURIComponent(match[1]!) : null;
}

export async function requireUser(request: Request): Promise<
    { user: PublicUser; token: string } | { error: NextResponse }
> {
    const token = readSessionToken(request);
    const user = await getSessionUser(token);
    if (!user || !token) {
        return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
    }
    return { user, token };
}

export function attachSessionCookie(response: NextResponse, token: string): NextResponse {
    const secure = process.env.NODE_ENV === 'production';
    response.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_TTL_SEC,
        secure,
    });
    return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
    response.cookies.set(SESSION_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
        secure: process.env.NODE_ENV === 'production',
    });
    return response;
}

export async function logoutFromRequest(request: Request): Promise<NextResponse> {
    const token = readSessionToken(request);
    await destroySession(token);
    return clearSessionCookie(NextResponse.json({ ok: true }));
}
