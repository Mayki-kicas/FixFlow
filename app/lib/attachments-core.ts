import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { validateAttachmentBytes, validateAttachmentMeta } from '@/lib/security';
import { buildAttachmentKey, putObject } from '@/lib/storage';
import { AttachmentType } from '@prisma/client';

// NOTE: pas 'use server'. Stockage des pièces jointes (validation taille + magic bytes,
// écriture hors base) partagé entre la création de ticket et la création de demande.
export async function storeUploadedFiles(
  files: File[],
  target: { ticketId?: string; demandeId?: string },
  uploadedById: string,
) {
  for (const file of files) {
    if (!file || !file.size) continue;
    validateAttachmentMeta({
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      context: 'ticket',
    });
    let type: AttachmentType = 'OTHER';
    if (file.type.startsWith('image/')) type = 'PHOTO';
    else if (file.type === 'application/pdf') type = 'PDF';
    const buffer = Buffer.from(await file.arrayBuffer());
    validateAttachmentBytes(buffer);
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
        uploadedById,
        ticketId: target.ticketId ?? null,
        demandeId: target.demandeId ?? null,
      },
    });
  }
}
