import { NextResponse } from 'next/server';
import { listBackups } from '../../../lib/persistence/fileStore';

export const runtime = 'nodejs';

export async function GET() { return NextResponse.json({ backups: await listBackups() }); }
