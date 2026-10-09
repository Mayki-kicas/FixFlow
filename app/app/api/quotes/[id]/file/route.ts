import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, canManageTicket } from '@/lib/session';
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

  const quote = await prisma.quote.findUnique({
    where: { id },
    select: { id: true, ticketId: true, fileStorageKey: true, fileName: true, contentType: true },
  });

  if (!quote || !quote.fileStorageKey) {
    return new Response('Devis introuvable', { status: 404 });
  }

  // Utilise le contrôle d'accès centralisé (ADMIN/MANAGER, ou abonné du ticket).
  if (!(await canManageTicket(quote.ticketId))) {
    return new Response('Acces refuse', { status: 403 });
  }

  const body = await getObject(quote.fileStorageKey);
  if (!body) {
    return new Response('Fichier de devis indisponible', { status: 404 });
  }

  const safeFilename = sanitizeFileName((quote.fileName && quote.fileName.trim()) || `devis-${quote.id}.pdf`);

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      'Content-Type': quote.contentType || 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
