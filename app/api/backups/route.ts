import { NextResponse } from 'next/server';
import { requireUser } from '../../../lib/auth/session';
import { listBackups } from '../../../lib/persistence/fileStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const auth = await requireUser(request);
    if ('error' in auth) return auth.error;
    return NextResponse.json({ backups: await listBackups(auth.user.id) });
}
