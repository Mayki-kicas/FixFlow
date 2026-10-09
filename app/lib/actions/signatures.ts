'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { canManageTicketLifecycle } from '@/lib/access-policy';
import { buildAttachmentKey, putObject } from '@/lib/storage';
import { logAudit } from '@/lib/audit';

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

// Enregistre une signature d'intervention (PNG data URL) comme pièce jointe photo de l'OT.
export async function addTicketSignature(ticketId: string, dataUrl: string) {
  const user = await requireAuth();
  if (!canManageTicketLifecycle(user.role)) throw new Error('Permissions insuffisantes');
  if (!ticketId) throw new Error('OT requis');

  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec((dataUrl || '').trim());
  if (!match) throw new Error('Signature invalide');
  const buffer = Buffer.from(match[1], 'base64');
  if (buffer.length === 0 || buffer.length > MAX_SIGNATURE_BYTES) throw new Error('Signature invalide');

  const id = crypto.randomUUID();
  const storageKey = buildAttachmentKey(id);
  await putObject(storageKey, buffer);
  await prisma.attachment.create({
    data: {
      id,
      type: 'PHOTO',
      url: `/api/attachments/${id}`,
      description: 'Signature intervention',
      fileName: 'signature.png',
      contentType: 'image/png',
      storageKey,
      uploadedById: user.id,
      ticketId,
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
  await logAudit({ actorId: user.id, entity: 'TICKET', entityId: ticketId, ticketId, action: 'SIGNATURE_ADDED' });
  return { ok: true };
}
