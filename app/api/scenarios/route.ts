import { NextResponse } from 'next/server';
import { requireUser } from '../../../lib/auth/session';
import { readState, writeState } from '../../../lib/persistence/fileStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const auth = await requireUser(request);
    if ('error' in auth) return auth.error;
    const state = await readState(auth.user.id);
    return NextResponse.json({ scenarios: state.scenarios, revision: state.revision });
}

export async function POST(request: Request) {
    const auth = await requireUser(request);
    if ('error' in auth) return auth.error;
    const payload = await request.json();
    const current = await readState(auth.user.id);
    const scenario = payload.scenario;
    if (!scenario || !['baseline', 'comparison'].includes(scenario.type) || !Array.isArray(scenario.overrides)) {
        return NextResponse.json({ error: 'Invalid scenario' }, { status: 400 });
    }
    const scenarios = [...current.scenarios.filter((item) => item.id !== scenario.id), scenario];
    return NextResponse.json(await writeState(auth.user.id, { ...current, scenarios }, current.revision));
}
