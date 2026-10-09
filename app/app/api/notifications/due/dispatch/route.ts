import { NextRequest, NextResponse } from 'next/server';
import { dispatchDueDateReminderNotificationsInternal } from '@/lib/notifications-core';
import { dispatchQuoteReminders } from '@/lib/quote-reminders';
import { generateDuePreventiveTickets, notifyExpiringCertificates } from '@/lib/maintenance-core';
import { notifyLowStockParts } from '@/lib/parts-core';
import { isValidCronToken } from '@/lib/integration-auth';

export async function POST(request: NextRequest) {
  if (!isValidCronToken(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Un seul timer quotidien couvre : rappels d'échéance ticket + relances devis
    // prestataire + génération des OT préventifs + alertes certificats.
    const [dueDate, quoteReminders, preventive, certificates, lowStock] = await Promise.all([
      dispatchDueDateReminderNotificationsInternal(),
      dispatchQuoteReminders(),
      generateDuePreventiveTickets(),
      notifyExpiringCertificates(),
      notifyLowStockParts(),
    ]);
    return NextResponse.json({ ...dueDate, ...quoteReminders, preventive, certificates, lowStock });
  } catch (error) {
    // Ne pas exposer le détail interne (Prisma/DB) au client.
    console.error('[cron] due/dispatch failed', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
