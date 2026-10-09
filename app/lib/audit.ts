import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type LogAuditInput = {
  actorId: string;
  entity: string;
  entityId: string;
  action: string;
  ticketId?: string | null;
  changes?: Record<string, unknown> | null;
};

export async function logAudit(input: LogAuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        ticketId: input.ticketId ?? null,
        changes: (input.changes ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
