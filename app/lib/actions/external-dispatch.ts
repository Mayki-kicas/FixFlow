'use server';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit';
import { buildIntegrationSignatureHeader } from '@/lib/integration-auth';

type DispatchInput = {
  ticketId: string;
  maintainerId: string;
  phoneSnapshot?: string;
  note?: string;
};

// ingestExternalFeedback a été déplacé vers @/lib/external-feedback (module non
// 'use server') pour qu'il ne soit pas exposé comme server action appelable.

export async function dispatchTicketToExternalApp(input: DispatchInput) {
  const actor = await requireRole(['ADMIN', 'MANAGER']);

  const [ticket, maintainer] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id: input.ticketId },
      include: {
        equipment: true,
        team: true,
        location: true,
        requester: { select: { id: true, displayName: true } },
      },
    }),
    prisma.maintainer.findUnique({
      where: { id: input.maintainerId },
      select: { id: true, name: true, email: true, contact: true },
    }),
  ]);

  if (!ticket) throw new Error('Ticket introuvable');
  if (!maintainer) throw new Error('Mainteneur introuvable');

  const dispatch = await prisma.externalDispatch.create({
    data: {
      ticketId: ticket.id,
      maintainerId: maintainer.id,
      phoneSnapshot: input.phoneSnapshot || maintainer.contact || null,
      dispatchedByUserId: actor.id,
      dispatchedAt: new Date(),
      status: 'PENDING',
    },
  });

  // Le dispatch vaut demande de devis : on ouvre un devis "demandé" rattaché au
  // dispatch et au prestataire. Il sera complété (RECEIVED) à l'ingestion du devis.
  const quote = await prisma.quote.create({
    data: {
      ticketId: ticket.id,
      maintainerId: maintainer.id,
      dispatchId: dispatch.id,
      status: 'REQUESTED',
      requestedAt: dispatch.dispatchedAt,
    },
  });

  const endpointBase = process.env.EXTERNAL_MAINTAINER_API_URL;
  const token = process.env.INTEGRATION_SHARED_TOKEN;
  if (!endpointBase || !token) {
    await prisma.externalDispatch.update({
      where: { id: dispatch.id },
      data: {
        status: 'ERROR',
        lastError: 'EXTERNAL_MAINTAINER_API_URL ou INTEGRATION_SHARED_TOKEN manquant',
      },
    });
    throw new Error('Configuration integration externe incomplète');
  }

  const payload = {
    dispatchId: dispatch.id,
    sourceTicketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    description: ticket.description,
    teamName: ticket.team.name,
    locationName: ticket.location?.name || 'Global',
    equipmentName: ticket.equipment.name,
    equipmentRef: ticket.equipment.refCode,
    requestedBy: {
      id: ticket.requester.id,
      name: ticket.requester.displayName,
    },
    targetMaintainer: {
      id: maintainer.id,
      name: maintainer.name,
      phone: input.phoneSnapshot || maintainer.contact || '',
      email: maintainer.email || '',
    },
    dispatchedAt: dispatch.dispatchedAt.toISOString(),
    note: input.note || '',
    // Devis attendu : identifiant + échéance (SLA priorité) pour cadrer le prestataire.
    quote: {
      quoteId: quote.id,
      deadline: ticket.quoteDeadline ? ticket.quoteDeadline.toISOString() : null,
    },
  };

  // Corps brut + timestamp figés pour que la signature couvre exactement ce qui est envoyé.
  const rawBody = JSON.stringify(payload);
  const timestamp = `${Date.now()}`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
    'idempotency-key': dispatch.id,
    'x-request-timestamp': timestamp,
    'x-request-nonce': dispatch.id,
  };
  // H2 : signe le dispatch sortant si un secret de signature est configuré.
  const signatureHeader = buildIntegrationSignatureHeader(rawBody, timestamp);
  if (signatureHeader) {
    headers['x-signature'] = signatureHeader;
  }

  try {
    const response = await fetch(`${endpointBase.replace(/\/$/, '')}/integration/v1/dispatch`, {
      method: 'POST',
      headers,
      body: rawBody,
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Dispatch HTTP ${response.status}: ${text.slice(0, 300)}`);
    }

    const result = (await response.json()) as { externalTicketId?: string; status?: string };
    await prisma.externalDispatch.update({
      where: { id: dispatch.id },
      data: {
        status: 'SENT',
        externalTicketId: result.externalTicketId || null,
        lastError: null,
      },
    });

    await logAudit({
      actorId: actor.id,
      entity: 'EXTERNAL_DISPATCH',
      entityId: dispatch.id,
      ticketId: ticket.id,
      action: 'EXTERNAL_DISPATCH_SENT',
      changes: {
        maintainerId: maintainer.id,
        externalTicketId: result.externalTicketId || null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Dispatch failed';
    await prisma.externalDispatch.update({
      where: { id: dispatch.id },
      data: {
        status: 'ERROR',
        lastError: message,
      },
    });
    throw error;
  } finally {
    revalidatePath(`/tickets/${ticket.id}`);
  }

  return dispatch.id;
}
