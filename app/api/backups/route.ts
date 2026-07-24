import { NextResponse } from 'next/server';
import { listBackups } from '../../../lib/persistence/fileStore';

export const dynamic = 'force-dynamic';

export async function GET() { return NextResponse.json({ backups: await listBackups() }); }
