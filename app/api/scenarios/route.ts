import { NextResponse } from 'next/server';
import { readState, writeState } from '../../../lib/persistence/fileStore';

export const runtime = 'nodejs';

export async function GET() {
    const state = await readState();
    return NextResponse.json({ scenarios: state.scenarios, revision: state.revision });
}

export async function POST(request: Request) {
    const payload = await request.json();
    const current = await readState();
    const scenario = payload.scenario;
    if (!scenario || !['baseline', 'comparison'].includes(scenario.type) || !Array.isArray(scenario.overrides)) {
        return NextResponse.json({ error: 'Invalid scenario' }, { status: 400 });
    }
    const scenarios = [...current.scenarios.filter((item) => item.id !== scenario.id), scenario];
    return NextResponse.json(await writeState({ ...current, scenarios }, current.revision));
}
