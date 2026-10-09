'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { canManageTicket, requireAuth } from '@/lib/session';
import { AttachmentType } from '@prisma/client';
import crypto from 'node:crypto';
import { getAttachmentLimits, validateAttachmentBytes, validateAttachmentMeta } from '@/lib/security';
import { buildAttachmentKey, deleteObject, putObject } from '@/lib/storage';

export async function uploadAttachment(formData: FormData) {
  const user = await requireAuth();

  const file = formData.get('file') as File;
  const ticketId = formData.get('ticketId') as string | null;
  const chatMessageId = formData.get('chatMessageId') as string | null;
  const description = formData.get('description') as string | null;

  if (!file) {
    throw new Error('Aucun fichier fourni');
  }
  if (!ticketId && !chatMessageId) {
    throw new Error('Aucun ticket cible');
  }

  const { maxBytes } = getAttachmentLimits();
  validateAttachmentMeta({
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    context: 'ticket',
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
  if (buffer.byteLength > maxBytes) {
    throw new Error('Fichier trop volumineux');
  }
  validateAttachmentBytes(buffer);

  // Contrôle d'accès sur CHAQUE ticket que la pièce jointe va toucher : le ticket
  // cible ET le ticket du message de chat visé. Vérifier un seul des deux (quand les
  // deux sont fournis) permettait d'attacher un fichier au message d'un ticket non
  // autorisé en passant en plus un ticketId accessible (IDOR en écriture).
  const ticketsToCheck = new Set<string>();
  if (ticketId) {
    ticketsToCheck.add(ticketId);
  }
  if (chatMessageId) {
    const message = await prisma.chatMessage.findUnique({
      where: { id: chatMessageId },
      select: { ticketId: true },
    });
    if (!message) {
      throw new Error('Message introuvable');
    }
    ticketsToCheck.add(message.ticketId);
  }

  if (ticketsToCheck.size === 0) {
    throw new Error('Aucun ticket cible');
  }

  for (const targetTicketId of ticketsToCheck) {
    const allowed = await canManageTicket(targetTicketId);
    if (!allowed) {
      throw new Error('Acces refuse');
    }
  }

  const contentType = file.type || 'application/octet-stream';

  // Écrit le binaire sur le stockage objet (hors base), puis crée l'entrée.
  const attachmentId = crypto.randomUUID();
  const storageKey = buildAttachmentKey(attachmentId);
  await putObject(storageKey, buffer);

  const attachment = await prisma.attachment.create({
    data: {
      id: attachmentId,
      type,
      url: `/api/attachments/${attachmentId}`,
      description: description || file.name,
      fileName: file.name,
      contentType,
      storageKey,
      uploadedById: user.id,
      ticketId,
      chatMessageId,
    },
    // select (et non include) pour NE PAS renvoyer `content` (Buffer/Uint8Array)
    // au client : non sérialisable vers un Client Component, et inutile (le binaire
    // se récupère via l'URL /api/attachments/[id]).
    select: {
      id: true,
      type: true,
      url: true,
      description: true,
      fileName: true,
      contentType: true,
      uploadedById: true,
      ticketId: true,
      chatMessageId: true,
      createdAt: true,
      uploadedBy: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  if (ticketId) {
    revalidatePath(`/tickets/${ticketId}`);
  }

  return attachment;
}

export async function deleteAttachment(id: string) {
  const user = await requireAuth();

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      uploadedById: true,
      ticketId: true,
      url: true,
      storageKey: true,
    },
  });

  if (!attachment) {
    throw new Error('Pièce jointe introuvable');
  }

  // Seul l'auteur ou un admin/manager peut supprimer
  if (
    attachment.uploadedById !== user.id &&
    user.role !== 'ADMIN' &&
    user.role !== 'MANAGER'
  ) {
    throw new Error('Permissions insuffisantes');
  }

  await prisma.attachment.delete({
    where: { id },
  });

  // Supprime aussi l'objet du stockage (best-effort ; ignore s'il n'existe pas).
  if (attachment.storageKey) {
    await deleteObject(attachment.storageKey);
  }

  if (attachment.ticketId) {
    revalidatePath(`/tickets/${attachment.ticketId}`);
  }
}
