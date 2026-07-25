import { logoutFromRequest } from '../../../../lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    console.info('auth logout');
    return logoutFromRequest(request);
}
