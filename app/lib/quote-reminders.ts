import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { createNotificationsForUsers } from '@/lib/notifications-core';

// NOTE: pas 'use server'. Appelé par le cron (route /api/notifications/due/dispatch).

// Faut-il relancer le prestataire pour ce devis ?
// - pas d'échéance => non
// - échéance non dépassée => non
// - dépassée + jamais relancé => oui
// - dépassée + déjà relancé => oui seulement si l'intervalle de cadence est écoulé
export function shouldSendQuoteReminder(params: {
  quoteDeadline: Date | null;
  lastRemindedAt: Date | null;
  intervalMs: number;
  now?: Date;
}): boolean {
  const now = params.now ?? new Date();
  if (!params.quoteDeadline) return false;
  if (params.quoteDeadline.getTime() > now.getTime()) return false;
  if (!params.lastRemindedAt) return true;
  return now.getTime() - params.lastRemindedAt.getTime() >= params.intervalMs;
}

function dateDayKey(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Relance les prestataires dont le devis (REQUESTED) a dépassé son échéance SLA,
// selon une cadence configurable (QUOTE_REMINDER_INTERVAL_DAYS). Email au presta +
// notification interne aux abonnés, avec suivi anti-spam sur le devis.
export async function dispatchQuoteReminders() {
  const now = new Date();
  const intervalDays = Number(process.env.QUOTE_REMINDER_INTERVAL_DAYS || 2);
  const intervalMs = (Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : 2) * 24 * 60 * 60 * 1000;

  const quotes = await prisma.quote.findMany({
    where: {
      status: 'REQUESTED',
      ticket: {
        isArchived: false,
        status: { isFinal: false },
        quoteDeadline: { not: null, lt: now },
      },
    },
    select: {
      id: true,
      lastRemindedAt: true,
      maintainer: { select: { name: true, email: true } },
      ticket: { select: { id: true, ticketNumber: true, title: true, quoteDeadline: true } },
    },
  });

  // Valideurs (ADMIN/MANAGER) : prévenus des dépassements SLA en plus des abonnés.
  const reviewers = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] } },
    select: { id: true },
  });
  const reviewerIds = reviewers.map((r) => r.id);

  let reminded = 0;

  for (const quote of quotes) {
    if (
      !shouldSendQuoteReminder({
        quoteDeadline: quote.ticket.quoteDeadline,
        lastRemindedAt: quote.lastRemindedAt,
        intervalMs,
        now,
      })
    ) {
      continue;
    }

    const deadlineLabel = quote.ticket.quoteDeadline?.toLocaleDateString('fr-FR') ?? '';

    // 1) Relance email au prestataire (si on a son email).
    if (quote.maintainer?.email) {
      try {
        await sendEmail({
          to: quote.maintainer.email,
          subject: `[Relance devis] Ticket #${quote.ticket.ticketNumber}`,
          text:
            `Bonjour ${quote.maintainer.name},\n\n` +
            `Nous sommes toujours en attente de votre devis pour le ticket #${quote.ticket.ticketNumber} ` +
            `(${quote.ticket.title}). L'echeance${deadlineLabel ? ` du ${deadlineLabel}` : ''} est depassee.\n\n` +
            `Merci de nous transmettre votre devis au plus vite.\n\nCordialement.`,
        });
      } catch (error) {
        console.error('[quote-reminder] envoi email prestataire echoue', error);
      }
    }

    // 2) Notification interne aux abonnés du ticket (dé-dup 1x/jour/devis).
    const subscribers = await prisma.ticketSubscription.findMany({
      where: { ticketId: quote.ticket.id },
      select: { userId: true },
    });
    await createNotificationsForUsers({
      userIds: [...new Set([...subscribers.map((s) => s.userId), ...reviewerIds])],
      type: 'SYSTEM',
      title: 'Devis en retard',
      message:
        `Le devis du ticket #${quote.ticket.ticketNumber} n'a pas ete recu (echeance depassee).` +
        (quote.maintainer?.email ? ' Une relance a ete envoyee au prestataire.' : ''),
      link: `/tickets/${quote.ticket.id}`,
      dedupeKey: `quote-reminder:${quote.id}:${dateDayKey(now)}`,
    });

    await prisma.quote.update({
      where: { id: quote.id },
      data: { lastRemindedAt: now, reminderCount: { increment: 1 } },
    });
    reminded += 1;
  }

  return { reminded };
}
