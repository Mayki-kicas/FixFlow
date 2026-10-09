import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { getObject } from '@/lib/storage';

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

  const equipment = await prisma.equipment.findUnique({
    where: { id },
    select: { photoStorageKey: true, photoContentType: true },
  });

  if (!equipment?.photoStorageKey) {
    return new Response('Photo indisponible', { status: 404 });
  }

  // Fichier possiblement supprimé du disque (nettoyage des vieux fichiers) :
  // getObject renvoie null → 404 propre, jamais d'exception.
  const body = await getObject(equipment.photoStorageKey);
  if (!body) {
    return new Response('Photo indisponible', { status: 404 });
  }

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      'Content-Type': equipment.photoContentType || 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
