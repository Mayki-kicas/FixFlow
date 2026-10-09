import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { getObject } from '@/lib/storage';

// Sert le rendu d'un plan d'étage. Lecture ouverte à tout utilisateur authentifié
// (la visionneuse est accessible à tous).
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

  const plan = await prisma.floorPlan.findUnique({
    where: { id },
    select: { svgStorageKey: true, contentType: true },
  });

  if (!plan?.svgStorageKey) {
    return new Response('Plan indisponible', { status: 404 });
  }

  const body = await getObject(plan.svgStorageKey);
  if (!body) {
    return new Response('Plan indisponible', { status: 404 });
  }

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      'Content-Type': plan.contentType || 'image/svg+xml',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
