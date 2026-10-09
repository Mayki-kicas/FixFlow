import { NextRequest, NextResponse } from 'next/server';
import { processPendingNotificationEmailJobs } from '@/lib/notifications-core';
import { isValidCronToken } from '@/lib/integration-auth';

export async function POST(request: NextRequest) {
  if (!isValidCronToken(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = typeof body?.limit === 'number' ? Math.max(1, Math.min(200, body.limit)) : 30;

  try {
    const result = await processPendingNotificationEmailJobs(limit);
    return NextResponse.json(result);
  } catch (error) {
    // Ne pas exposer le détail interne (Prisma/DB) au client.
    console.error('[cron] email-queue/process failed', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

