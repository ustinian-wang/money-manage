import { NextResponse } from 'next/server';
import { readState, writeState } from '../../../lib/persistence/fileStore';

export const runtime = 'nodejs';

export async function GET() {
    return NextResponse.json(await readState());
}

export async function PUT(request: Request) {
    const payload = await request.json();
    try {
        const expectedRevision = typeof payload.revision === 'number' ? payload.revision : undefined;
        const state = payload.state ?? payload;
        return NextResponse.json(await writeState(state, expectedRevision));
    } catch (error) {
        if ((error as { code?: string }).code === 'REVISION_CONFLICT') {
            return NextResponse.json({ error: 'revision_conflict', state: (error as { current?: unknown }).current }, { status: 409 });
        }
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
