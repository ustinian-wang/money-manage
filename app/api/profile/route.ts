import { NextResponse } from 'next/server';
import { requireUser } from '../../../lib/auth/session';
import { readState, writeState } from '../../../lib/persistence/fileStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const auth = await requireUser(request);
    if ('error' in auth) return auth.error;
    return NextResponse.json(await readState(auth.user.id));
}

export async function PUT(request: Request) {
    const auth = await requireUser(request);
    if ('error' in auth) return auth.error;
    const payload = await request.json();
    try {
        const expectedRevision = typeof payload.revision === 'number' ? payload.revision : undefined;
        const state = payload.state ?? payload;
        return NextResponse.json(await writeState(auth.user.id, state, expectedRevision));
    } catch (error) {
        if ((error as { code?: string }).code === 'REVISION_CONFLICT') {
            return NextResponse.json({ error: 'revision_conflict', state: (error as { current?: unknown }).current }, { status: 409 });
        }
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
