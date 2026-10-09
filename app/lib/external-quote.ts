import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit';
import { putObject } from '@/lib/storage';
import { createNotificationsForUsers } from '@/lib/notifications-core';
import { getAttachmentLimits, validateAttachmentBytes } from '@/lib/security';

// NOTE: module volontairement PAS 'use server'. L'ingestion de devis externe ne doit
// être atteignable QUE via la route API /api/integration/v1/quote (token + HMAC),
// jamais exposée comme server action.

export type ExternalQuotePayload = {
  dispatchId: string;
  externalQuoteId: string; // idempotence / anti-rejeu
  maintainer?: { id?: string; name?: string };
  reference?: string;
  amountCents?: number; // montant HT en centimes
  currency?: string;
  validUntil?: string; // ISO
  file?: { base64: string; fileName: string; mimeType: string };
  createdAt: string;
};

export async function ingestExternalQuote(payload: ExternalQuotePayload) {
  // Idempotence : un devis déjà ingéré (même externalQuoteId) n'est pas retraité.
  const existing = await prisma.quote.findUnique({
    where: { externalQuoteId: payload.externalQuoteId },
    select: { id: true },
  });
  if (existing) {
    return { status: 'ALREADY_INGESTED' as const, quoteId: existing.id };
  }

  // On rattache le devis reçu à la demande (Quote REQUESTED) ouverte par le dispatch.
  const dispatch = await prisma.externalDispatch.findUnique({
    where: { id: payload.dispatchId },
    select: {
      id: true,
      ticketId: true,
      dispatchedByUserId: true,
      ticket: { select: { ticketNumber: true } },
      quotes: {
        where: { status: 'REQUESTED' },
        orderBy: { requestedAt: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!dispatch) {
    return { status: 'DISPATCH_NOT_FOUND' as const };
  }
  const targetQuote = dispatch.quotes[0];
  if (!targetQuote) {
    // Pas de demande de devis en attente (déjà reçue, ou dispatch sans devis) :
    // condition métier, pas une erreur serveur -> l'appelant renvoie un 409.
    return { status: 'NO_PENDING_QUOTE' as const };
  }

  // Fichier PDF optionnel : validé (taille + signature binaire) puis stocké hors base.
  let fileStorageKey: string | null = null;
  let fileName: string | null = null;
  let contentType: string | null = null;
  if (payload.file?.base64) {
    const buffer = Buffer.from(payload.file.base64, 'base64');
    const { maxBytes } = getAttachmentLimits();
    if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) {
      throw new Error('Fichier de devis invalide (taille)');
    }
    validateAttachmentBytes(buffer); // rejette un fichier déguisé (magic bytes)
    fileStorageKey = `quotes/${targetQuote.id}-${crypto.randomUUID()}`;
    await putObject(fileStorageKey, buffer);
    fileName = payload.file.fileName || 'devis.pdf';
    // Type figé sur une liste blanche : on ne fait pas confiance au MIME du prestataire.
    const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    const declared = (payload.file.mimeType || '').toLowerCase();
    contentType = ALLOWED.has(declared) ? declared : 'application/pdf';
  }

  const amountCents =
    typeof payload.amountCents === 'number' && Number.isFinite(payload.amountCents) && payload.amountCents >= 0
      ? Math.round(payload.amountCents)
      : null;

  const quote = await prisma.quote.update({
    where: { id: targetQuote.id },
    data: {
      status: 'RECEIVED',
      externalQuoteId: payload.externalQuoteId,
      reference: payload.reference?.trim() || null,
      amountCents,
      // Devise validée (ISO-4217 = 3 lettres) sinon EUR : un code malformé ferait planter
      // Intl.NumberFormat (RangeError) et donc la page ticket.
      currency: /^[A-Za-z]{3}$/.test((payload.currency || '').trim())
        ? payload.currency!.trim().toUpperCase()
        : 'EUR',
      validUntil: payload.validUntil ? new Date(payload.validUntil) : null,
      receivedAt: new Date(),
      fileStorageKey,
      fileName,
      contentType,
    },
  });

  // Notifier les abonnés du ticket qu'un devis est arrivé.
  const subscribers = await prisma.ticketSubscription.findMany({
    where: { ticketId: dispatch.ticketId },
    select: { userId: true },
  });
  await createNotificationsForUsers({
    userIds: subscribers.map((s) => s.userId),
    type: 'SYSTEM',
    title: 'Devis reçu',
    message: `Un devis a été reçu pour le ticket #${dispatch.ticket.ticketNumber}`,
    link: `/tickets/${dispatch.ticketId}`,
  });

  await logAudit({
    actorId: dispatch.dispatchedByUserId,
    entity: 'QUOTE',
    entityId: quote.id,
    ticketId: dispatch.ticketId,
    action: 'QUOTE_RECEIVED',
    changes: { amountCents: quote.amountCents, reference: quote.reference },
  });

  revalidatePath(`/tickets/${dispatch.ticketId}`);
  return { status: 'INGESTED' as const, quoteId: quote.id };
}
