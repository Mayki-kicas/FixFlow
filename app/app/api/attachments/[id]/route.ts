import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, canManageTicket } from '@/lib/session';
import { isDemandeReviewer, canReviewDemandeLocation, getManagedLocationIds } from '@/lib/demande-review';
import { sanitizeFileName } from '@/lib/security';
import { getObject } from '@/lib/storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return new Response('Non authentifie', { status: 401 });
  }

  const { id } = await params;

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      fileName: true,
      description: true,
      contentType: true,
      storageKey: true,
      uploadedById: true,
      ticketId: true,
      chatMessage: {
        select: {
          ticketId: true,
        },
      },
      demande: {
        select: { requesterId: true, locationId: true },
      },
    },
  });

  if (!attachment || !attachment.storageKey) {
    return new Response('Piece jointe introuvable', { status: 404 });
  }

  const relatedTicketId = attachment.ticketId || attachment.chatMessage?.ticketId;
  if (!relatedTicketId && !attachment.demande) {
    return new Response('Piece jointe invalide', { status: 400 });
  }

  // Accès : l'auteur du fichier, ou l'accès au ticket rattaché, ou — pour une PJ de
  // demande — l'auteur de la demande / un valideur responsable du site (ADMIN, ou
  // manager du site concerné).
  let allowed = attachment.uploadedById === user.id;
  if (!allowed && relatedTicketId) {
    allowed = await canManageTicket(relatedTicketId);
  }
  if (!allowed && attachment.demande) {
    if (attachment.demande.requesterId === user.id) {
      allowed = true;
    } else if (isDemandeReviewer(user.role)) {
      const managed = user.role === 'ADMIN' ? [] : await getManagedLocationIds(user.id);
      allowed = canReviewDemandeLocation(user.role, managed, attachment.demande.locationId);
    }
  }
  if (!allowed) {
    return new Response('Acces refuse', { status: 403 });
  }

  const filename =
    (attachment.fileName && attachment.fileName.trim()) ||
    (attachment.description && attachment.description.trim()) ||
    `attachment-${attachment.id}`;
  const safeFilename = sanitizeFileName(filename);

  const contentType = attachment.contentType || 'application/octet-stream';
  const disposition = attachment.type === 'PHOTO' ? 'inline' : 'attachment';

  // Lit le binaire depuis le stockage objet. Fichier possiblement supprimé (nettoyage
  // des vieux fichiers) → getObject renvoie null → 404 propre, jamais d'exception.
  const body = await getObject(attachment.storageKey);
  if (!body) {
    return new Response('Piece jointe indisponible (fichier supprime)', { status: 404 });
  }

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `${disposition}; filename="${safeFilename}"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
