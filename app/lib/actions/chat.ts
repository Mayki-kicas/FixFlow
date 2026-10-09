'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { canManageTicket, requireAuth } from '@/lib/session';
import { createNotificationsForUsers } from '@/lib/notifications-core';
import { AttachmentType } from '@prisma/client';
import crypto from 'node:crypto';
import { getAttachmentLimits, validateAttachmentBytes, validateAttachmentMeta } from '@/lib/security';
import { logAudit } from '@/lib/audit';
import { buildAttachmentKey, putObject } from '@/lib/storage';

export type CreateChatMessageInput = {
  ticketId: string;
  content: string;
};

function normalizeForMention(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function extractMentionTokens(content: string) {
  const matches = content.match(/@([a-zA-Z0-9._-]+)/g) || [];
  return Array.from(new Set(matches.map((match) => match.slice(1).toLowerCase())));
}

async function resolveMentionedUserIds(ticketId: string, tokens: string[]) {
  if (tokens.length === 0) return [];

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      requesterId: true,
      subscriptions: { select: { userId: true } },
    },
  });

  if (!ticket) return [];

  const candidateIds = Array.from(
    new Set([ticket.requesterId, ...ticket.subscriptions.map((subscription) => subscription.userId)])
  );

  const candidates = await prisma.user.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true, email: true, displayName: true },
  });

  return candidates
    .filter((candidate) => {
      const emailLocalPart = candidate.email.split('@')[0] || '';
      const candidateKeys = [
        normalizeForMention(candidate.displayName).replace(/\s+/g, '.'),
        normalizeForMention(candidate.displayName).replace(/\s+/g, ''),
        normalizeForMention(emailLocalPart),
      ];
      return tokens.some((token) =>
        candidateKeys.some((key) => key === token || key.includes(token))
      );
    })
    .map((candidate) => candidate.id);
}

async function notifyNewMessage(input: {
  ticketId: string;
  ticketTitle: string;
  requesterId: string;
  authorId: string;
  authorDisplayName: string;
  messageContent: string;
  mentionUserIds?: string[];
  attachmentIds?: string[];
}) {
  const subscriptions = await prisma.ticketSubscription.findMany({
    where: { ticketId: input.ticketId },
    select: { userId: true },
  });

  const recipients = Array.from(
    new Set([
      input.requesterId,
      ...subscriptions.map((subscription) => subscription.userId),
      ...(input.mentionUserIds || []),
    ])
  ).filter((userId) => userId !== input.authorId);

  await createNotificationsForUsers({
    userIds: recipients,
    type: 'NEW_MESSAGE',
    title: 'Nouveau message',
    message: `${input.authorDisplayName} a commente "${input.ticketTitle}"`,
    link: `/tickets/${input.ticketId}`,
    email: {
      messageContent: input.messageContent,
      attachmentIds: input.attachmentIds,
    },
  });
}

export async function createChatMessage(input: CreateChatMessageInput) {
  const user = await requireAuth();

  // Vérifier que le ticket existe et que l'utilisateur y a accès
  const ticket = await prisma.ticket.findUnique({
    where: { id: input.ticketId },
    select: {
      id: true,
      title: true,
      requesterId: true,
    },
  });

  if (!ticket) {
    throw new Error('Ticket introuvable');
  }

  // Vérifier les permissions
  const hasTicketAccess = await canManageTicket(ticket.id);
  if (!hasTicketAccess) {
    throw new Error('Accès refusé');
  }

  const message = await prisma.chatMessage.create({
    data: {
      content: input.content,
      ticketId: input.ticketId,
      authorId: user.id,
    },
    include: {
      author: {
        select: {
          id: true,
          displayName: true,
        },
      },
      attachments: {
        select: {
          id: true,
          type: true,
          url: true,
          description: true,
          createdAt: true,
          uploadedBy: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  await notifyNewMessage({
    ticketId: input.ticketId,
    ticketTitle: ticket.title,
    requesterId: ticket.requesterId,
    authorId: user.id,
    authorDisplayName: user.displayName,
    messageContent: input.content,
    mentionUserIds: await resolveMentionedUserIds(input.ticketId, extractMentionTokens(input.content)),
  });

  await logAudit({
    actorId: user.id,
    entity: 'TICKET',
    entityId: input.ticketId,
    ticketId: input.ticketId,
    action: 'CHAT_MESSAGE_CREATED',
    changes: {
      messageId: message.id,
      hasAttachments: false,
      mentionTokens: extractMentionTokens(input.content),
    },
  });

  revalidatePath(`/tickets/${input.ticketId}`);
  return message;
}

export async function createChatMessageWithAttachments(formData: FormData) {
  const user = await requireAuth();

  const ticketId = formData.get('ticketId') as string;
  const content = formData.get('content') as string;
  const files = formData.getAll('files') as File[];
  const { chatMaxFiles } = getAttachmentLimits();

  if (!ticketId) {
    throw new Error('Ticket ID manquant');
  }
  if (files.length > chatMaxFiles) {
    throw new Error(`Nombre max de pieces jointes depasse (${chatMaxFiles})`);
  }

  // Vérifier que le ticket existe et que l'utilisateur y a accès
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      title: true,
      requesterId: true,
    },
  });

  if (!ticket) {
    throw new Error('Ticket introuvable');
  }

  // Vérifier les permissions
  const hasTicketAccess = await canManageTicket(ticket.id);
  if (!hasTicketAccess) {
    throw new Error('Accès refusé');
  }

  // Créer le message
  const message = await prisma.chatMessage.create({
    data: {
      content: content || '',
      ticketId,
      authorId: user.id,
    },
  });

  // Traiter les fichiers
  if (files.length > 0) {
    for (const file of files) {
      if (!file.size) continue;
      validateAttachmentMeta({
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        context: 'chat',
      });

      // Déterminer le type de fichier
      let type: AttachmentType = 'OTHER';
      if (file.type.startsWith('image/')) {
        type = 'PHOTO';
      } else if (file.type === 'application/pdf') {
        type = 'PDF';
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      validateAttachmentBytes(buffer);

      // Écrit le binaire sur le stockage objet (hors base), puis crée l'entrée.
      const attachmentId = crypto.randomUUID();
      const storageKey = buildAttachmentKey(attachmentId);
      await putObject(storageKey, buffer);

      await prisma.attachment.create({
        data: {
          id: attachmentId,
          type,
          url: `/api/attachments/${attachmentId}`,
          description: file.name,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          storageKey,
          uploadedById: user.id,
          chatMessageId: message.id,
        },
      });
    }
  }

  // Récupérer le message avec ses attachments
  const messageWithAttachments = await prisma.chatMessage.findUnique({
    where: { id: message.id },
    include: {
      author: {
        select: {
          id: true,
          displayName: true,
        },
      },
      attachments: {
        select: {
          id: true,
          type: true,
          url: true,
          description: true,
          createdAt: true,
          uploadedBy: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  const attachmentIds = (messageWithAttachments?.attachments || []).map(
    (attachment) => attachment.id,
  );

  await notifyNewMessage({
    ticketId,
    ticketTitle: ticket.title,
    requesterId: ticket.requesterId,
    authorId: user.id,
    authorDisplayName: user.displayName,
    messageContent: content || '',
    mentionUserIds: await resolveMentionedUserIds(ticketId, extractMentionTokens(content || '')),
    attachmentIds,
  });

  await logAudit({
    actorId: user.id,
    entity: 'TICKET',
    entityId: ticketId,
    ticketId,
    action: 'CHAT_MESSAGE_CREATED',
    changes: {
      messageId: message.id,
      hasAttachments: attachmentIds.length > 0,
      attachmentCount: attachmentIds.length,
      mentionTokens: extractMentionTokens(content || ''),
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
  if (!messageWithAttachments) {
    return null;
  }

  return {
    ...messageWithAttachments,
    attachments: messageWithAttachments.attachments.map((attachment) => ({
      id: attachment.id,
      type: attachment.type,
      url: attachment.url,
      description: attachment.description,
      createdAt: attachment.createdAt,
      uploadedBy: attachment.uploadedBy,
    })),
  };
}

export async function getChatMessages(ticketId: string) {
  await requireAuth();

  // Vérifier l'accès au ticket
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
    },
  });

  if (!ticket) {
    throw new Error('Ticket introuvable');
  }

  // Accès centralisé: BASIC et MAINTAINER doivent être abonnés ou membres de l'équipe.
  // (auparavant seuls les BASIC étaient filtrés → fuite du chat aux MAINTAINER)
  if (!(await canManageTicket(ticketId))) {
    throw new Error('Accès refusé');
  }

  const messages = await prisma.chatMessage.findMany({
    where: { ticketId },
    include: {
      author: {
        select: {
          id: true,
          displayName: true,
        },
      },
      attachments: {
        select: {
          id: true,
          type: true,
          url: true,
          description: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return messages;
}
