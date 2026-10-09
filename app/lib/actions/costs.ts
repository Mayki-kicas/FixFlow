'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { TICKET_MANAGER_ROLES } from '@/lib/access-policy';
import { logAudit } from '@/lib/audit';
import { CostLineType } from '@prisma/client';

const ALLOWED_COST_TYPES = new Set<CostLineType>(['PART', 'EXTERNAL', 'OTHER']);

export async function addWorkLog(input: {
  ticketId: string;
  minutes: number;
  performedAt?: Date | null;
  note?: string | null;
}) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  if (!input.ticketId) throw new Error('OT requis');
  if (!Number.isInteger(input.minutes) || input.minutes <= 0 || input.minutes > 100000) {
    throw new Error('Durée invalide');
  }

  const log = await prisma.workLog.create({
    data: {
      ticketId: input.ticketId,
      userId: user.id,
      minutes: input.minutes,
      performedAt: input.performedAt ?? new Date(),
      note: input.note?.trim() || null,
    },
    select: { id: true },
  });

  revalidatePath(`/tickets/${input.ticketId}`);
  await logAudit({ actorId: user.id, entity: 'WORK_LOG', entityId: log.id, ticketId: input.ticketId, action: 'WORK_LOG_ADDED', changes: { minutes: input.minutes } });
  return { id: log.id };
}

export async function deleteWorkLog(id: string) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  const log = await prisma.workLog.delete({ where: { id }, select: { ticketId: true } });
  revalidatePath(`/tickets/${log.ticketId}`);
  await logAudit({ actorId: user.id, entity: 'WORK_LOG', entityId: id, ticketId: log.ticketId, action: 'WORK_LOG_DELETED' });
  return { ok: true };
}

export async function addCostLine(input: {
  ticketId: string;
  type: CostLineType;
  label: string;
  amountCents: number;
  quantity?: number;
}) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  if (!input.ticketId) throw new Error('OT requis');
  const label = input.label?.trim();
  if (!label) throw new Error('Libellé requis');
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) throw new Error('Montant invalide');
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Quantité invalide');
  const type = ALLOWED_COST_TYPES.has(input.type) ? input.type : 'OTHER';

  const line = await prisma.costLine.create({
    data: { ticketId: input.ticketId, type, label, amountCents: input.amountCents, quantity, createdById: user.id },
    select: { id: true },
  });

  revalidatePath(`/tickets/${input.ticketId}`);
  await logAudit({ actorId: user.id, entity: 'COST_LINE', entityId: line.id, ticketId: input.ticketId, action: 'COST_LINE_ADDED', changes: { type, amountCents: input.amountCents, quantity } });
  return { id: line.id };
}

export async function deleteCostLine(id: string) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  const line = await prisma.costLine.delete({ where: { id }, select: { ticketId: true } });
  revalidatePath(`/tickets/${line.ticketId}`);
  await logAudit({ actorId: user.id, entity: 'COST_LINE', entityId: id, ticketId: line.ticketId, action: 'COST_LINE_DELETED' });
  return { ok: true };
}
