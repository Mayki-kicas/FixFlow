'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/session';
import { canUserAccessTicket } from '@/lib/visibility';
import { TICKET_MANAGER_ROLES } from '@/lib/access-policy';
import { logAudit } from '@/lib/audit';
import { QuoteStatus } from '@prisma/client';

export type TicketQuote = {
  id: string;
  status: QuoteStatus;
  reference: string | null;
  amountCents: number | null;
  currency: string;
  requestedAt: Date;
  receivedAt: Date | null;
  validUntil: Date | null;
  decidedAt: Date | null;
  notes: string | null;
  hasFile: boolean;
  maintainerName: string | null;
};

export async function getQuotesForTicket(ticketId: string): Promise<TicketQuote[]> {
  const user = await requireAuth();
  if (!(await canUserAccessTicket(user, ticketId))) {
    throw new Error('Accès refusé');
  }

  const quotes = await prisma.quote.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      reference: true,
      amountCents: true,
      currency: true,
      requestedAt: true,
      receivedAt: true,
      validUntil: true,
      decidedAt: true,
      notes: true,
      fileStorageKey: true,
      maintainer: { select: { name: true } },
    },
  });

  // On ne renvoie pas la clé de stockage au client : juste un booléen de présence.
  return quotes.map(({ fileStorageKey, maintainer, ...q }) => ({
    ...q,
    hasFile: !!fileStorageKey,
    maintainerName: maintainer?.name ?? null,
  }));
}

async function decideQuote(quoteId: string, decision: 'ACCEPTED' | 'REJECTED', notes?: string) {
  const user = await requireRole(TICKET_MANAGER_ROLES);

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { id: true, ticketId: true, status: true, reference: true },
  });
  if (!quote) {
    throw new Error('Devis introuvable');
  }
  if (quote.status !== 'RECEIVED') {
    throw new Error('Seul un devis reçu peut être accepté ou refusé');
  }

  // Claim atomique : seule la première décision concurrente passe (anti double-traitement).
  const claim = await prisma.quote.updateMany({
    where: { id: quoteId, status: 'RECEIVED' },
    data: {
      status: decision,
      decidedAt: new Date(),
      decidedByUserId: user.id,
      notes: notes?.trim() || null,
    },
  });
  if (claim.count === 0) {
    throw new Error('Ce devis a déjà été traité');
  }

  // Confort : à l'acceptation, on reporte la référence du devis sur le ticket (champ legacy).
  if (decision === 'ACCEPTED' && quote.reference) {
    await prisma.ticket.update({
      where: { id: quote.ticketId },
      data: { quoteNumber: quote.reference },
    });
  }

  revalidatePath(`/tickets/${quote.ticketId}`);
  await logAudit({
    actorId: user.id,
    entity: 'QUOTE',
    entityId: quoteId,
    ticketId: quote.ticketId,
    action: decision === 'ACCEPTED' ? 'QUOTE_ACCEPTED' : 'QUOTE_REJECTED',
    changes: { notes: notes?.trim() || null },
  });

  return { status: decision };
}

export async function acceptQuote(quoteId: string, notes?: string) {
  return decideQuote(quoteId, 'ACCEPTED', notes);
}

export async function rejectQuote(quoteId: string, notes?: string) {
  return decideQuote(quoteId, 'REJECTED', notes);
}
