'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { TICKET_MANAGER_ROLES, canManageTicketLifecycle } from '@/lib/access-policy';
import { requireAuth } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { FailureCodeType } from '@prisma/client';

const TYPES = new Set<FailureCodeType>(['FAILURE', 'CAUSE', 'REMEDY']);

export async function createFailureCode(type: FailureCodeType, label: string) {
  const user = await requireRole(['ADMIN', 'MANAGER']);
  if (!TYPES.has(type)) throw new Error('Type invalide');
  const clean = label?.trim();
  if (!clean || clean.length > 120) throw new Error('Libellé invalide');
  try {
    const code = await prisma.failureCode.create({ data: { type, label: clean } });
    revalidatePath('/backoffice/codes-defaut');
    await logAudit({ actorId: user.id, entity: 'FAILURE_CODE', entityId: code.id, action: 'FAILURE_CODE_CREATED', changes: { type, label: clean } });
    return { id: code.id };
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
      throw new Error('Ce code existe déjà');
    }
    throw error;
  }
}

export async function deleteFailureCode(id: string) {
  const user = await requireRole(['ADMIN', 'MANAGER']);
  await prisma.failureCode.delete({ where: { id } });
  revalidatePath('/backoffice/codes-defaut');
  await logAudit({ actorId: user.id, entity: 'FAILURE_CODE', entityId: id, action: 'FAILURE_CODE_DELETED' });
  return { ok: true };
}

export async function getFailureCodes() {
  await requireAuth();
  return prisma.failureCode.findMany({
    orderBy: [{ type: 'asc' }, { label: 'asc' }],
    select: { id: true, type: true, label: true },
  });
}

// Renseigne le diagnostic d'un OT. null = efface. Les codes doivent être du bon type.
export async function setTicketDiagnosis(
  ticketId: string,
  input: { failureCodeId?: string | null; causeCodeId?: string | null; remedyCodeId?: string | null },
) {
  const user = await requireAuth();
  if (!canManageTicketLifecycle(user.role)) throw new Error('Permissions insuffisantes');

  const checks: [string | null | undefined, FailureCodeType][] = [
    [input.failureCodeId, 'FAILURE'],
    [input.causeCodeId, 'CAUSE'],
    [input.remedyCodeId, 'REMEDY'],
  ];
  for (const [id, type] of checks) {
    if (id) {
      const code = await prisma.failureCode.findUnique({ where: { id }, select: { type: true } });
      if (!code || code.type !== type) throw new Error('Code de diagnostic invalide');
    }
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      failureCodeId: input.failureCodeId === undefined ? undefined : input.failureCodeId || null,
      causeCodeId: input.causeCodeId === undefined ? undefined : input.causeCodeId || null,
      remedyCodeId: input.remedyCodeId === undefined ? undefined : input.remedyCodeId || null,
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
  await logAudit({ actorId: user.id, entity: 'TICKET', entityId: ticketId, ticketId, action: 'TICKET_DIAGNOSIS_SET', changes: { ...input } });
  return { ok: true };
}
