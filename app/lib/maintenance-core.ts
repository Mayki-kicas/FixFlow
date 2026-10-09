import { prisma } from '@/lib/prisma';
import { createTicketRecord } from '@/lib/tickets-core';
import { createNotificationsForUsers } from '@/lib/notifications-core';
import { logAudit } from '@/lib/audit';

// --- Helpers purs (testables sans DB) --------------------------------------

// Un plan est "dû" quand son échéance moins le délai d'anticipation est atteinte.
export function isPlanDue(nextDueAt: Date, leadTimeDays: number, now: Date): boolean {
  const trigger = new Date(nextDueAt);
  trigger.setDate(trigger.getDate() - leadTimeDays);
  return trigger.getTime() <= now.getTime();
}

// Plan par compteur : dû quand l'usage depuis le dernier déclenchement atteint l'intervalle.
export function isMeterPlanDue(
  current: number | null | undefined,
  baseline: number | null | undefined,
  interval: number | null | undefined,
): boolean {
  if (current == null || interval == null || !(interval > 0)) return false;
  const base = baseline ?? current;
  return current - base >= interval;
}

// Avance une échéance par pas d'intervalle jusqu'à repasser dans le futur
// (rattrape les occurrences manquées sans générer un OT par occurrence).
export function advanceDueDate(current: Date, intervalDays: number, now: Date): Date {
  const d = new Date(current);
  const step = Math.max(1, intervalDays);
  // Garde-fou contre une boucle infinie si l'intervalle est incohérent.
  let guard = 0;
  while (d.getTime() <= now.getTime() && guard < 100000) {
    d.setDate(d.getDate() + step);
    guard += 1;
  }
  return d;
}

// --- Génération des OT préventifs (DB ; appelé par la route cron) -----------

export async function generateDuePreventiveTickets(now: Date = new Date()) {
  const plans = await prisma.maintenancePlan.findMany({
    where: { active: true },
    include: {
      equipment: { select: { id: true, name: true } },
      createdBy: { select: { id: true, displayName: true } },
      tasks: { orderBy: { order: 'asc' }, select: { label: true, order: true } },
      meter: { select: { readings: { orderBy: { readAt: 'desc' }, take: 1, select: { value: true } } } },
    },
  });

  const created: { ticketId: string; planId: string }[] = [];

  for (const plan of plans) {
    // Détermine si le plan est dû + la date de référence de l'OT + la mise à jour du plan.
    let occurrenceDue: Date;
    let planUpdate: { nextDueAt?: Date; lastGeneratedMeterValue?: number; lastGeneratedAt: Date };

    if (plan.trigger === 'METER') {
      const current = plan.meter?.readings[0]?.value;
      if (!isMeterPlanDue(current, plan.lastGeneratedMeterValue, plan.meterInterval)) continue;
      occurrenceDue = now;
      planUpdate = { lastGeneratedMeterValue: current as number, lastGeneratedAt: now };
    } else {
      if (!plan.nextDueAt || plan.intervalDays == null) continue;
      if (!isPlanDue(plan.nextDueAt, plan.leadTimeDays, now)) continue;
      occurrenceDue = new Date(plan.nextDueAt);
      planUpdate = { nextDueAt: advanceDueDate(plan.nextDueAt, plan.intervalDays, now), lastGeneratedAt: now };
    }

    let ticket;
    try {
      ticket = await createTicketRecord({
        title: plan.name,
        description: plan.description || `Maintenance préventive — ${plan.equipment.name}`,
        equipmentId: plan.equipmentId,
        nature: 'PREVENTIVE',
        priority: plan.priority ?? undefined,
        dueDate: occurrenceDue,
        requesterId: plan.createdByUserId,
        requesterName: plan.createdBy.displayName,
        actorId: plan.createdByUserId,
        actorName: plan.createdBy.displayName,
      });
    } catch (error) {
      console.error(`Préventif: échec de génération pour le plan ${plan.id}`, error);
      continue;
    }

    // Rattache l'OT au plan + instancie la check-list + affecte le mainteneur.
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        maintenancePlanId: plan.id,
        maintainerId: plan.maintainerId ?? undefined,
        teamId: plan.teamId ?? undefined,
        tasks: plan.tasks.length
          ? { create: plan.tasks.map((t) => ({ label: t.label, order: t.order })) }
          : undefined,
      },
    });

    // Avance l'échéance (calendaire) ou le relevé de référence (compteur) — idempotence.
    await prisma.maintenancePlan.update({ where: { id: plan.id }, data: planUpdate });

    await logAudit({
      actorId: plan.createdByUserId,
      entity: 'MAINTENANCE_PLAN',
      entityId: plan.id,
      ticketId: ticket.id,
      action: 'PREVENTIVE_TICKET_GENERATED',
      changes: { ticketNumber: ticket.ticketNumber, occurrenceDue: occurrenceDue.toISOString() },
    });

    created.push({ ticketId: ticket.id, planId: plan.id });
  }

  return { generated: created.length, tickets: created };
}

// --- Alerte certificats expirant bientôt -----------------------------------

export async function notifyExpiringCertificates(withinDays = 30, now: Date = new Date()) {
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + withinDays);

  const docs = await prisma.equipmentDocument.findMany({
    where: { type: 'CERTIFICATE', expiryAt: { not: null, lte: horizon } },
    select: { id: true, label: true, fileName: true, expiryAt: true, equipment: { select: { name: true, refCode: true } } },
  });
  if (docs.length === 0) return { alerted: 0 };

  const recipients = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] } },
    select: { id: true },
  });
  const userIds = recipients.map((r) => r.id);
  if (userIds.length === 0) return { alerted: 0 };

  for (const doc of docs) {
    const when = doc.expiryAt ? new Date(doc.expiryAt) : null;
    const expired = when ? when.getTime() < now.getTime() : false;
    await createNotificationsForUsers({
      userIds,
      type: 'SYSTEM',
      title: expired ? 'Certificat expiré' : 'Certificat bientôt expiré',
      message: `${doc.equipment.name} (${doc.equipment.refCode}) — ${doc.label || doc.fileName}${when ? ` — ${expired ? 'expiré le' : 'expire le'} ${when.toLocaleDateString('fr-FR')}` : ''}`,
      link: '/backoffice/preventif',
    });
  }

  return { alerted: docs.length };
}
