import { NextResponse } from 'next/server';
import { readSessionToken } from '../../../../lib/auth/session';
import { getSessionUser } from '../../../../lib/auth/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const user = await getSessionUser(readSessionToken(request));
    if (!user) return NextResponse.json({ user: null });
    return NextResponse.json({ user });
}
