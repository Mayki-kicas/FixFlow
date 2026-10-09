import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { getObject } from '@/lib/storage';
import { sanitizeFileName } from '@/lib/security';

// Sert un document d'équipement. Lecture pour tout utilisateur authentifié.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
  } catch {
    return new Response('Non authentifie', { status: 401 });
  }

  const { id } = await params;

  const doc = await prisma.equipmentDocument.findUnique({
    where: { id },
    select: { storageKey: true, fileName: true, contentType: true, type: true },
  });
  if (!doc?.storageKey) {
    return new Response('Document introuvable', { status: 404 });
  }

  const body = await getObject(doc.storageKey);
  if (!body) {
    return new Response('Document indisponible (fichier supprime)', { status: 404 });
  }

  const filename = sanitizeFileName((doc.fileName && doc.fileName.trim()) || `document-${id}`);
  const disposition = doc.contentType?.startsWith('image/') || doc.contentType === 'application/pdf' ? 'inline' : 'attachment';

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      'Content-Type': doc.contentType || 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
