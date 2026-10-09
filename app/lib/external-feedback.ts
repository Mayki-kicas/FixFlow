import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit';
import { Prisma } from '@prisma/client';

// NOTE: ce module n'est volontairement PAS marqué 'use server'.
// L'ingestion de feedback externe ne doit être atteignable QUE via la route API
// /api/integration/v1/feedback (authentifiée par token d'intégration), et jamais
// exposée comme server action appelable depuis un navigateur.

type FeedbackAttachment = {
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
};

export type FeedbackPayload = {
  dispatchId: string;
  externalTicketId: string;
  externalMessageId: string;
  maintainer: {
    id: string;
    name: string;
  };
  message: string;
  attachments?: FeedbackAttachment[];
  createdAt: string;
};

export async function ingestExternalFeedback(payload: FeedbackPayload) {
  const dispatch = await prisma.externalDispatch.findUnique({
    where: { id: payload.dispatchId },
    include: {
      ticket: true,
    },
  });

  if (!dispatch) {
    throw new Error('Dispatch introuvable');
  }

  // Idempotence / anti-rejeu : si ce message externe a déjà été traité, on ne
  // recrée pas de message de chat (le token + timestamp restent vérifiés en amont
  // par la route ; ceci empêche un rejeu dans la fenêtre de fraîcheur de dupliquer).
  const existingEvent = await prisma.externalFeedbackEvent.findUnique({
    where: { externalMessageId: payload.externalMessageId },
    select: { id: true, ingestionStatus: true },
  });
  if (existingEvent?.ingestionStatus === 'PROCESSED') {
    return { status: 'ALREADY_INGESTED', internalEventId: existingEvent.id };
  }

  const event = await prisma.externalFeedbackEvent.upsert({
    where: { externalMessageId: payload.externalMessageId },
    create: {
      dispatchId: dispatch.id,
      externalMessageId: payload.externalMessageId,
      payloadJson: payload as unknown as Prisma.InputJsonValue,
      ingestionStatus: 'RECEIVED',
    },
    update: {
      payloadJson: payload as unknown as Prisma.InputJsonValue,
    },
  });

  try {
    await prisma.chatMessage.create({
      data: {
        ticketId: dispatch.ticketId,
        authorId: dispatch.ticket.requesterId,
        content: `[Retour mainteneur externe - ${payload.maintainer.name}] ${payload.message}`,
      },
    });

    await prisma.externalFeedbackEvent.update({
      where: { id: event.id },
      data: {
        ingestionStatus: 'PROCESSED',
        processedAt: new Date(),
        errorMessage: null,
      },
    });

    await logAudit({
      actorId: dispatch.dispatchedByUserId,
      entity: 'EXTERNAL_FEEDBACK',
      entityId: event.id,
      ticketId: dispatch.ticketId,
      action: 'EXTERNAL_FEEDBACK_INGESTED',
      changes: {
        externalMessageId: payload.externalMessageId,
        attachmentCount: payload.attachments?.length || 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Feedback ingestion failed';
    await prisma.externalFeedbackEvent.update({
      where: { id: event.id },
      data: {
        ingestionStatus: 'REJECTED',
        errorMessage: message,
      },
    });
    throw error;
  } finally {
    revalidatePath(`/tickets/${dispatch.ticketId}`);
  }

  return { status: 'INGESTED', internalEventId: event.id };
}
