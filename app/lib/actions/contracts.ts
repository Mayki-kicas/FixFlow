'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export type ContractInput = {
  name: string;
  scope?: string | null;
  slaTerms?: string | null;
  startAt?: Date | null;
  endAt?: Date | null;
  costCents?: number | null;
  active?: boolean;
};

function sanitize(input: Partial<ContractInput>) {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n || n.length > 160) throw new Error('Nom de contrat invalide');
    out.name = n;
  }
  if (input.scope !== undefined) out.scope = input.scope?.trim() || null;
  if (input.slaTerms !== undefined) out.slaTerms = input.slaTerms?.trim() || null;
  if (input.startAt !== undefined) out.startAt = input.startAt;
  if (input.endAt !== undefined) out.endAt = input.endAt;
  if (input.costCents !== undefined) {
    if (input.costCents === null) out.costCents = null;
    else {
      const c = Math.trunc(input.costCents);
      if (!Number.isFinite(c) || c < 0) throw new Error('Montant invalide');
      out.costCents = c;
    }
  }
  if (input.active !== undefined) out.active = input.active;
  return out;
}

export async function createContract(maintainerId: string, input: ContractInput) {
  const user = await requireRole(['ADMIN', 'MANAGER']);
  if (!maintainerId) throw new Error('Prestataire requis');
  if (!input.name?.trim()) throw new Error('Nom de contrat requis');

  const contract = await prisma.contract.create({ data: { maintainerId, name: input.name.trim(), ...sanitize(input) } });
  revalidatePath(`/backoffice/maintainers/${maintainerId}`);
  await logAudit({ actorId: user.id, entity: 'CONTRACT', entityId: contract.id, action: 'CONTRACT_CREATED', changes: { maintainerId, name: contract.name } });
  return { id: contract.id };
}

export async function updateContract(id: string, input: Partial<ContractInput>) {
  const user = await requireRole(['ADMIN', 'MANAGER']);
  const contract = await prisma.contract.update({ where: { id }, data: sanitize(input), select: { maintainerId: true } });
  revalidatePath(`/backoffice/maintainers/${contract.maintainerId}`);
  await logAudit({ actorId: user.id, entity: 'CONTRACT', entityId: id, action: 'CONTRACT_UPDATED' });
  return { ok: true };
}

export async function deleteContract(id: string) {
  const user = await requireRole(['ADMIN', 'MANAGER']);
  const contract = await prisma.contract.delete({ where: { id }, select: { maintainerId: true } });
  revalidatePath(`/backoffice/maintainers/${contract.maintainerId}`);
  await logAudit({ actorId: user.id, entity: 'CONTRACT', entityId: id, action: 'CONTRACT_DELETED' });
  return { ok: true };
}

export async function getContractsForMaintainer(maintainerId: string) {
  await requireRole(['ADMIN', 'MANAGER']);
  return prisma.contract.findMany({
    where: { maintainerId },
    orderBy: [{ active: 'desc' }, { endAt: 'asc' }],
    select: { id: true, name: true, scope: true, slaTerms: true, startAt: true, endAt: true, costCents: true, active: true },
  });
}
