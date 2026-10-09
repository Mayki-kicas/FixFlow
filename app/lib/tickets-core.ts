import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { computeQuoteDeadline } from '@/lib/priority';
import { computeCorrectiveDueDate, computeFirstResponseDueAt } from '@/lib/sla';
import { resolveEffectiveSla } from '@/lib/equipment-sla';
import { getAppConfig } from '@/lib/app-config';
import { createNotificationsForUsers } from '@/lib/notifications-core';
import { logAudit } from '@/lib/audit';
import type { Priority, TicketNature } from '@prisma/client';

// NOTE: pas 'use server'. Cœur de création d'un ticket, réutilisé par la déclaration
// directe (requester = acteur) et par la validation d'une demande (requester = auteur
// de la demande, acteur = manager). Ne fait PAS le contrôle d'accès : les appelants
// (Server Actions) s'en chargent.
export type CreateTicketRecordInput = {
  title: string;
  description: string;
  equipmentId: string;
  locationId?: string | null;
  priority?: Priority;
  // CORRECTIVE (incident, défaut) ou IMPROVEMENT (demande améliorative validée).
  nature?: TicketNature;
  // Échéance de résolution explicite. Si absente et nature CORRECTIVE, elle est
  // calculée depuis le SLA (heures) de la catégorie d'équipement.
  dueDate?: Date;
  requesterId: string; // à qui est rattaché le ticket (abonné)
  requesterName: string; // pour le contexte email
  actorId: string; // qui exécute (historique priorité, audit, notif)
  actorName: string; // pour le message de notif
};

export async function createTicketRecord(input: CreateTicketRecordInput) {
  const cleanTitle = input.title.trim();
  const cleanDescription = input.description.trim();
  if (cleanTitle.length < 3 || cleanTitle.length > 160) {
    throw new Error('Titre invalide');
  }
  if (cleanDescription.length < 3 || cleanDescription.length > 5000) {
    throw new Error('Description invalide');
  }

  const equipment = await prisma.equipment.findUnique({
    where: { id: input.equipmentId },
    include: {
      team: { include: { statuses: { orderBy: { order: 'asc' } } } },
      location: true,
      category: true,
    },
  });
  if (!equipment) {
    throw new Error('Équipement introuvable');
  }

  const defaultStatus = equipment.team.statuses[0];
  if (!defaultStatus) {
    throw new Error('Aucun statut disponible pour cette équipe');
  }

  const now = new Date();
  // Config effective : les surcharges de l'équipement écrasent la catégorie.
  const effective = resolveEffectiveSla(equipment, equipment.category);
  const priority = input.priority ?? effective.defaultPriority;
  const nature = input.nature ?? 'CORRECTIVE';
  const quoteDeadline = computeQuoteDeadline(now, priority, effective);

  // SLA correctif (heures) -> échéance de résolution, sauf dueDate explicite.
  const correctiveDueDate =
    nature === 'CORRECTIVE' ? computeCorrectiveDueDate(now, effective.correctiveSlaHours) : null;
  const dueDate = input.dueDate ?? correctiveDueDate ?? null;

  // SLA de prise en charge (triage) : échéance = maintenant + délai global configuré.
  const appConfig = await getAppConfig();
  const firstResponseDueAt = computeFirstResponseDueAt(now, appConfig.firstResponseHours);

  const ticket = await prisma.ticket.create({
    data: {
      title: cleanTitle,
      description: cleanDescription,
      equipmentId: input.equipmentId,
      locationId: input.locationId ?? equipment.locationId,
      teamId: equipment.teamId,
      statusId: defaultStatus.id,
      requesterId: input.requesterId,
      priority,
      nature,
      quoteDeadline,
      dueDate,
      firstResponseDueAt,
      subscriptions: { create: { userId: input.requesterId } },
      priorityChanges: {
        create: {
          changedById: input.actorId,
          fromPriority: null,
          toPriority: priority,
          reason: 'Création du ticket',
        },
      },
    },
    include: { equipment: true, location: true, team: true, status: true, requester: true },
  });

  // Auto-abonner les membres des groupes liés à l'équipe (hors demandeur).
  const groupTeamLinks = await prisma.groupTeam.findMany({
    where: { teamId: equipment.teamId },
    include: { group: { include: { members: { select: { userId: true } } } } },
  });
  const userIds = new Set<string>();
  for (const link of groupTeamLinks) {
    for (const member of link.group.members) {
      if (member.userId !== input.requesterId) {
        userIds.add(member.userId);
      }
    }
  }
  if (userIds.size > 0) {
    await prisma.ticketSubscription.createMany({
      data: Array.from(userIds).map((userId) => ({ ticketId: ticket.id, userId })),
      skipDuplicates: true,
    });
  }

  const autoSubscribers = await prisma.ticketSubscription.findMany({
    where: { ticketId: ticket.id },
    select: { userId: true },
  });

  await createNotificationsForUsers({
    userIds: autoSubscribers.map((s) => s.userId),
    type: 'TICKET_CREATED',
    title: 'Nouveau ticket',
    message: `${input.actorName} a cree "${ticket.title}"`,
    link: `/tickets/${ticket.id}`,
    email: {
      ticketContext: {
        ticketNumber: ticket.ticketNumber,
        ticketTitle: ticket.title,
        teamName: ticket.team.name,
        equipmentName: ticket.equipment.name,
        requesterName: input.requesterName,
      },
    },
  });

  revalidatePath('/tickets');
  await logAudit({
    actorId: input.actorId,
    entity: 'TICKET',
    entityId: ticket.id,
    ticketId: ticket.id,
    action: 'TICKET_CREATED',
    changes: {
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      teamId: ticket.teamId,
      locationId: ticket.locationId,
      equipmentId: ticket.equipmentId,
    },
  });

  return ticket;
}
