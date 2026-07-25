import { NextResponse } from 'next/server';
import { attachSessionCookie } from '../../../../lib/auth/session';
import { checkRateLimit, createSession, registerUser } from '../../../../lib/auth/store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local';
    if (!(await checkRateLimit(`register:${ip}`, 8, 15 * 60))) {
        return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
    }
    let body: { username?: string; email?: string; password?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: '无效请求体' }, { status: 400 });
    }
    const result = await registerUser({
        username: String(body.username || ''),
        email: String(body.email || ''),
        password: String(body.password || ''),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    const token = await createSession(result.user.id);
    console.info('auth register ok', { userId: result.user.id });
    return attachSessionCookie(NextResponse.json({ user: result.user }), token);
}
