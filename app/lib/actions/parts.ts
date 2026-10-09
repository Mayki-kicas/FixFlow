'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { TICKET_MANAGER_ROLES } from '@/lib/access-policy';
import { logAudit } from '@/lib/audit';

function isP2002(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002';
}

export type PartInput = {
  reference: string;
  name: string;
  unit?: string | null;
  unitPriceCents?: number | null;
  reorderPoint?: number | null;
};

function sanitizePart(input: Partial<PartInput>) {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) out.name = input.name.trim();
  if (input.unit !== undefined) out.unit = input.unit?.trim() || null;
  if (input.unitPriceCents !== undefined) {
    if (input.unitPriceCents === null) out.unitPriceCents = null;
    else {
      const c = Math.trunc(input.unitPriceCents);
      if (!Number.isFinite(c) || c < 0) throw new Error('Prix invalide');
      out.unitPriceCents = c;
    }
  }
  if (input.reorderPoint !== undefined) {
    if (input.reorderPoint === null) out.reorderPoint = null;
    else {
      const r = Math.trunc(input.reorderPoint);
      if (!Number.isInteger(r) || r < 0) throw new Error('Seuil invalide');
      out.reorderPoint = r;
    }
  }
  return out;
}

export async function createPart(input: PartInput) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  const reference = input.reference?.trim();
  const name = input.name?.trim();
  if (!reference || reference.length > 80) throw new Error('Référence invalide');
  if (!name || name.length > 160) throw new Error('Nom invalide');
  try {
    const part = await prisma.part.create({ data: { reference, name, ...sanitizePart(input) } });
    revalidatePath('/backoffice/pieces');
    await logAudit({ actorId: user.id, entity: 'PART', entityId: part.id, action: 'PART_CREATED', changes: { reference } });
    return { id: part.id };
  } catch (error) {
    if (isP2002(error)) throw new Error('Cette référence existe déjà');
    throw error;
  }
}

export async function updatePart(id: string, input: Partial<PartInput>) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  await prisma.part.update({ where: { id }, data: sanitizePart(input) });
  revalidatePath('/backoffice/pieces');
  await logAudit({ actorId: user.id, entity: 'PART', entityId: id, action: 'PART_UPDATED' });
  return { ok: true };
}

export async function deletePart(id: string) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  await prisma.part.delete({ where: { id } });
  revalidatePath('/backoffice/pieces');
  await logAudit({ actorId: user.id, entity: 'PART', entityId: id, action: 'PART_DELETED' });
  return { ok: true };
}

// Entrée en stock (réception) : qty > 0.
export async function receiveStock(partId: string, qty: number, note?: string | null) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('Quantité invalide');
  await prisma.$transaction([
    prisma.stockMovement.create({ data: { partId, delta: qty, reason: 'ENTRY', byUserId: user.id, note: note?.trim() || null } }),
    prisma.part.update({ where: { id: partId }, data: { stockQty: { increment: qty } } }),
  ]);
  revalidatePath('/backoffice/pieces');
  await logAudit({ actorId: user.id, entity: 'PART', entityId: partId, action: 'STOCK_ENTRY', changes: { qty } });
  return { ok: true };
}

// Ajustement d'inventaire : delta peut être positif ou négatif.
export async function adjustStock(partId: string, delta: number, note?: string | null) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  if (!Number.isInteger(delta) || delta === 0) throw new Error('Ajustement invalide');
  await prisma.$transaction([
    prisma.stockMovement.create({ data: { partId, delta, reason: 'ADJUSTMENT', byUserId: user.id, note: note?.trim() || null } }),
    prisma.part.update({ where: { id: partId }, data: { stockQty: { increment: delta } } }),
  ]);
  revalidatePath('/backoffice/pieces');
  await logAudit({ actorId: user.id, entity: 'PART', entityId: partId, action: 'STOCK_ADJUSTMENT', changes: { delta } });
  return { ok: true };
}

// Consommation d'une pièce sur un OT : décrémente le stock + crée une ligne de coût.
export async function consumePartOnTicket(ticketId: string, partId: string, qty: number) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  if (!ticketId) throw new Error('OT requis');
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('Quantité invalide');

  const part = await prisma.part.findUnique({ where: { id: partId }, select: { reference: true, name: true, unitPriceCents: true } });
  if (!part) throw new Error('Pièce introuvable');

  await prisma.$transaction([
    prisma.stockMovement.create({ data: { partId, delta: -qty, reason: 'CONSUMPTION', ticketId, byUserId: user.id } }),
    prisma.part.update({ where: { id: partId }, data: { stockQty: { decrement: qty } } }),
    prisma.costLine.create({
      data: {
        ticketId,
        type: 'PART',
        label: `${part.name} (${part.reference})`,
        amountCents: part.unitPriceCents ?? 0,
        quantity: qty,
        createdById: user.id,
      },
    }),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/backoffice/pieces');
  await logAudit({ actorId: user.id, entity: 'PART', entityId: partId, ticketId, action: 'PART_CONSUMED', changes: { qty } });
  return { ok: true };
}

export async function getParts() {
  await requireRole(TICKET_MANAGER_ROLES);
  return prisma.part.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, reference: true, name: true, unit: true, unitPriceCents: true, stockQty: true, reorderPoint: true },
  });
}

// Liste pour la consommation sur un OT (pièces en stock en tête).
export async function getPartsForConsumption() {
  await requireRole(TICKET_MANAGER_ROLES);
  return prisma.part.findMany({
    orderBy: [{ name: 'asc' }],
    select: { id: true, reference: true, name: true, unit: true, unitPriceCents: true, stockQty: true },
  });
}
