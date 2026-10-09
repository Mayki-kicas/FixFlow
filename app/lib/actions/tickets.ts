'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/session';
import { createNotificationsForUsers } from '@/lib/notifications-core';
import { Prisma, Priority, TicketNature } from '@prisma/client';
import { logAudit } from '@/lib/audit';
import { getAttachmentLimits } from '@/lib/security';
import { canUserAccessTicket, ticketVisibilityWhere } from '@/lib/visibility';
import {
  TICKET_MANAGER_ROLES,
  canManageTicketLifecycle,
  canChangeTicketPriority,
  canDeclareTicket,
} from '@/lib/access-policy';
import { computeQuoteDeadline } from '@/lib/priority';
import { createTicketRecord } from '@/lib/tickets-core';
import { storeUploadedFiles } from '@/lib/attachments-core';

export type UpdateTicketInput = {
  id: string;
  title?: string;
  description?: string;
  equipmentId?: string;
  teamId?: string;
  locationId?: string | null;
  statusId?: string;
  maintainerId?: string;
  invoiceNumber?: string;
  quoteNumber?: string;
  closedAt?: Date | null;
  dueDate?: Date | null;
  nature?: TicketNature;
  // Fenêtre d'intervention planifiée (chantier), renseignée à la validation du devis.
  interventionStartAt?: Date | null;
  interventionEndAt?: Date | null;
};

// Déclaration DIRECTE d'un incident (BASIC+, hors MAINTAINER) : un problème concret
// (équipement cassé) devient un ticket immédiatement, sans validation. Les IDÉES /
// suggestions passent, elles, par une Demande validée (cf. lib/actions/demandes.ts).
export async function createTicketWithAttachments(formData: FormData) {
  const user = await requireAuth();
  if (!canDeclareTicket(user.role)) {
    throw new Error('Accès refusé');
  }

  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const equipmentId = String(formData.get('equipmentId') || '').trim();
  const locationId = String(formData.get('locationId') || '').trim() || null;
  const priorityRaw = String(formData.get('priority') || '').trim();
  const priority = (['P1', 'P2', 'P3'] as const).includes(priorityRaw as Priority)
    ? (priorityRaw as Priority)
    : undefined; // undefined => défaut de la catégorie d'équipement
  const files = formData.getAll('files') as File[];
  const { ticketMaxFiles } = getAttachmentLimits();

  if (!title || !description || !equipmentId || !locationId) {
    throw new Error('Veuillez remplir tous les champs obligatoires');
  }
  if (files.length > ticketMaxFiles) {
    throw new Error(`Nombre max de pieces jointes depasse (${ticketMaxFiles})`);
  }

  const ticket = await createTicketRecord({
    title,
    description,
    equipmentId,
    locationId,
    priority,
    requesterId: user.id,
    requesterName: user.displayName,
    actorId: user.id,
    actorName: user.displayName,
  });

  await storeUploadedFiles(files, { ticketId: ticket.id }, user.id);

  revalidatePath(`/tickets/${ticket.id}`);
  return { id: ticket.id };
}

// Valide qu'un statut cible existe et appartient bien à l'équipe du ticket (ou est global).
async function resolveTargetStatus(
  tx: Prisma.TransactionClient,
  statusId: string,
  currentTeamId: string,
) {
  const targetStatus = await tx.ticketStatus.findUnique({
    where: { id: statusId },
    select: { id: true, name: true, teamId: true },
  });
  if (!targetStatus) {
    throw new Error('Statut introuvable');
  }
  if (targetStatus.teamId && targetStatus.teamId !== currentTeamId) {
    throw new Error("Le statut cible n'appartient pas à la même équipe");
  }
  return targetStatus;
}

// Notifie les abonnés (hors auteur) d'un changement de statut. Source unique — était
// dupliqué à l'identique dans updateTicket et updateTicketStatus.
async function notifySubscribersOfStatusChange(params: {
  ticket: {
    id: string;
    ticketNumber: number;
    title: string;
    team?: { name: string } | null;
    equipment?: { name: string } | null;
    requester?: { displayName: string } | null;
  };
  actorId: string;
  previousStatusName: string;
  nextStatusName: string;
}) {
  const subscribers = await prisma.ticketSubscription.findMany({
    where: { ticketId: params.ticket.id },
    select: { userId: true },
  });
  const recipients = Array.from(
    new Set(
      subscribers
        .map((subscription) => subscription.userId)
        .filter((userId) => userId !== params.actorId),
    ),
  );

  await createNotificationsForUsers({
    userIds: recipients,
    type: 'STATUS_CHANGED',
    title: 'Statut du ticket mis a jour',
    message: `${params.previousStatusName} -> ${params.nextStatusName}`,
    link: `/tickets/${params.ticket.id}`,
    email: {
      ticketContext: {
        ticketNumber: params.ticket.ticketNumber,
        ticketTitle: params.ticket.title,
        teamName: params.ticket.team?.name,
        equipmentName: params.ticket.equipment?.name,
        requesterName: params.ticket.requester?.displayName,
      },
      statusContext: {
        previousStatus: params.previousStatusName,
        nextStatus: params.nextStatusName,
      },
    },
  });
}

export async function updateTicket(input: UpdateTicketInput) {
  // Modification d'un ticket (champs administratifs, équipement, statut) réservée
  // à ADMIN/MANAGER — aligné sur la page /tickets/[id]/edit. Sans ce garde,
  // n'importe quel utilisateur authentifié pouvait réécrire n'importe quel ticket.
  const user = await requireRole(TICKET_MANAGER_ROLES);

  // ticketNumber is immutable and ignored if sent by clients. firstRespondedAt is
  // system-managed (posé au 1er changement de statut) : jamais accepté du client.
  const { id, ...data } = input as UpdateTicketInput & { ticketNumber?: number; firstRespondedAt?: Date };
  delete (data as { ticketNumber?: number }).ticketNumber;
  delete data.firstRespondedAt;

  let ticket;
  let statusChangeNotification:
    | { previousStatusName: string; nextStatusName: string }
    | null = null;

  const targetEquipmentId = data.equipmentId;
  if (targetEquipmentId) {
    const currentTicketForEquipment = await prisma.ticket.findUnique({
      where: { id },
      select: {
        equipmentId: true,
      },
    });

    if (!currentTicketForEquipment) {
      throw new Error('Ticket introuvable');
    }

    if (targetEquipmentId !== currentTicketForEquipment.equipmentId) {
      const equipment = await prisma.equipment.findUnique({
        where: { id: targetEquipmentId },
        include: {
          team: {
            include: {
              statuses: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });

      if (!equipment) {
        throw new Error('Equipement introuvable');
      }

      data.teamId = equipment.teamId;
      data.locationId = equipment.locationId;

      if (data.statusId === undefined) {
        const defaultStatus = equipment.team.statuses[0];
        if (!defaultStatus) {
          throw new Error('Aucun statut disponible pour l equipe cible');
        }
        data.statusId = defaultStatus.id;
      }
    }
  }

  if (data.statusId) {
    const nextStatusId = data.statusId;

    const result = await prisma.$transaction(async (tx) => {
      const currentTicket = await tx.ticket.findUnique({
        where: { id },
        select: {
          id: true,
          teamId: true,
          statusId: true,
          firstRespondedAt: true,
          status: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!currentTicket) {
        throw new Error('Ticket introuvable');
      }

      const targetStatus = await resolveTargetStatus(tx, nextStatusId, currentTicket.teamId);

      const statusChanged = currentTicket.statusId !== nextStatusId;
      // Premier changement de statut = ticket pris en charge (SLA de triage tenu).
      if (statusChanged && !currentTicket.firstRespondedAt) {
        data.firstRespondedAt = new Date();
      }
      const updatedTicket = await tx.ticket.update({
        where: { id },
        data,
        include: {
          equipment: true,
          location: true,
          team: true,
          status: true,
          requester: true,
          maintainer: true,
        },
      });

      if (statusChanged) {
        await tx.chatMessage.create({
          data: {
            ticketId: id,
            authorId: user.id,
            content: `Statut modifie: ${currentTicket.status.name} -> ${targetStatus.name}`,
          },
        });
      }

      return {
        updatedTicket,
        statusChanged,
        previousStatusName: currentTicket.status.name,
        nextStatusName: targetStatus.name,
      };
    });

    ticket = result.updatedTicket;
    if (result.statusChanged) {
      statusChangeNotification = {
        previousStatusName: result.previousStatusName,
        nextStatusName: result.nextStatusName,
      };
    }
  } else {
    ticket = await prisma.ticket.update({
      where: { id },
      data,
      include: {
        equipment: true,
        location: true,
        team: true,
        status: true,
        requester: true,
        maintainer: true,
      },
    });
  }

  if (statusChangeNotification) {
    await notifySubscribersOfStatusChange({
      ticket,
      actorId: user.id,
      previousStatusName: statusChangeNotification.previousStatusName,
      nextStatusName: statusChangeNotification.nextStatusName,
    });
  }

  await logAudit({
    actorId: user.id,
    entity: 'TICKET',
    entityId: ticket.id,
    ticketId: ticket.id,
    action: statusChangeNotification ? 'TICKET_STATUS_UPDATED' : 'TICKET_UPDATED',
    changes: {
      ...data,
      statusChange: statusChangeNotification,
    },
  });

  revalidatePath('/tickets');
  revalidatePath(`/tickets/team/${ticket.teamId}`);
  revalidatePath(`/tickets/${id}`);
  return ticket;
}

export async function updateTicketStatus(ticketId: string, statusId: string) {
  const user = await requireAuth();

  // Seuls ADMIN et MANAGER peuvent changer les statuts
  if (!canManageTicketLifecycle(user.role)) {
    throw new Error('Permissions insuffisantes pour modifier le statut');
  }

  const result = await prisma.$transaction(async (tx) => {
    const currentTicket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        teamId: true,
        statusId: true,
        firstRespondedAt: true,
        status: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!currentTicket) {
      throw new Error('Ticket introuvable');
    }

    const targetStatus = await resolveTargetStatus(tx, statusId, currentTicket.teamId);

    if (currentTicket.statusId === statusId) {
      const unchangedTicket = await tx.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        include: {
          status: true,
          team: true,
          equipment: true,
          requester: {
            select: {
              displayName: true,
            },
          },
        },
      });
      return {
        updatedTicket: unchangedTicket,
        statusChanged: false,
        previousStatusName: currentTicket.status.name,
        nextStatusName: targetStatus.name,
      };
    }

    const updatedTicket = await tx.ticket.update({
      where: { id: ticketId },
      // Premier changement de statut = ticket pris en charge (SLA de triage tenu).
      data: { statusId, ...(currentTicket.firstRespondedAt ? {} : { firstRespondedAt: new Date() }) },
      include: {
        status: true,
        team: true,
        equipment: true,
        requester: {
          select: {
            displayName: true,
          },
        },
      },
    });

    await tx.chatMessage.create({
      data: {
        ticketId,
        authorId: user.id,
        content: `Statut modifie: ${currentTicket.status.name} -> ${targetStatus.name}`,
      },
    });

    return {
      updatedTicket,
      statusChanged: true,
      previousStatusName: currentTicket.status.name,
      nextStatusName: targetStatus.name,
    };
  });

  const ticket = result.updatedTicket;

  if (result.statusChanged) {
    await notifySubscribersOfStatusChange({
      ticket,
      actorId: user.id,
      previousStatusName: result.previousStatusName,
      nextStatusName: result.nextStatusName,
    });
  }

  await logAudit({
    actorId: user.id,
    entity: 'TICKET',
    entityId: ticketId,
    ticketId,
    action: 'TICKET_STATUS_UPDATED',
    changes: {
      previousStatus: result.previousStatusName,
      nextStatus: result.nextStatusName,
    },
  });

  revalidatePath('/tickets');
  revalidatePath(`/tickets/team/${ticket.teamId}`);
  revalidatePath(`/tickets/${ticketId}`);
  return ticket;
}

// Redirige un ticket vers une autre équipe/service (« Concerne la maintenance ? NON »
// ou mauvaise équipe). Réassigne l'équipe et repositionne le ticket sur le premier
// statut de l'équipe cible, avec une note traçable. ADMIN/MANAGER.
export async function reassignTicketTeam(ticketId: string, targetTeamId: string, reason?: string) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  const cleanReason = reason?.trim() || null;

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, teamId: true, team: { select: { name: true } } },
    });
    if (!current) throw new Error('Ticket introuvable');
    if (current.teamId === targetTeamId) {
      throw new Error('Le ticket est déjà rattaché à cette équipe');
    }

    const targetTeam = await tx.team.findUnique({
      where: { id: targetTeamId },
      select: { id: true, name: true, statuses: { orderBy: { order: 'asc' }, take: 1, select: { id: true } } },
    });
    if (!targetTeam) throw new Error('Équipe cible introuvable');
    const targetStatus = targetTeam.statuses[0];
    if (!targetStatus) throw new Error("L'équipe cible n'a aucun statut configuré");

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: { teamId: targetTeam.id, statusId: targetStatus.id },
      include: {
        status: true,
        team: true,
        equipment: true,
        requester: { select: { displayName: true } },
      },
    });

    await tx.chatMessage.create({
      data: {
        ticketId,
        authorId: user.id,
        content: `Ticket redirige: ${current.team.name} -> ${targetTeam.name}${cleanReason ? ` (motif: ${cleanReason})` : ''}`,
      },
    });

    return { updated, fromTeamId: current.teamId, fromTeamName: current.team.name, toTeamName: targetTeam.name };
  });

  const ticket = result.updated;
  await createNotificationsForUsers({
    userIds: Array.from(
      new Set(
        (await prisma.ticketSubscription.findMany({ where: { ticketId }, select: { userId: true } }))
          .map((s) => s.userId)
          .filter((uid) => uid !== user.id),
      ),
    ),
    type: 'SYSTEM',
    title: 'Ticket redirigé',
    message: `Ticket #${ticket.ticketNumber} redirigé vers ${result.toTeamName}`,
    link: `/tickets/${ticketId}`,
  });

  await logAudit({
    actorId: user.id,
    entity: 'TICKET',
    entityId: ticketId,
    ticketId,
    action: 'TICKET_REASSIGNED',
    changes: { fromTeam: result.fromTeamName, toTeam: result.toTeamName, reason: cleanReason },
  });

  revalidatePath('/tickets');
  revalidatePath(`/tickets/team/${result.fromTeamId}`);
  revalidatePath(`/tickets/team/${ticket.teamId}`);
  revalidatePath(`/tickets/${ticketId}`);
  return ticket;
}

export async function archiveTicket(ticketId: string) {
  const user = await requireRole(TICKET_MANAGER_ROLES);

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      isArchived: true,
      closedAt: new Date(),
    },
  });

  revalidatePath('/tickets');
  revalidatePath(`/tickets/${ticketId}`);
  await logAudit({
    actorId: user.id,
    entity: 'TICKET',
    entityId: ticketId,
    ticketId,
    action: 'TICKET_ARCHIVED',
    changes: null,
  });
  return ticket;
}

export async function unarchiveTicket(ticketId: string) {
  const user = await requireRole(TICKET_MANAGER_ROLES);

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      isArchived: false,
      // Restaure le ticket dans les vues actives : on efface la date de clôture
      // posée automatiquement lors de l'archivage.
      closedAt: null,
    },
  });

  revalidatePath('/tickets');
  revalidatePath(`/tickets/${ticketId}`);
  await logAudit({
    actorId: user.id,
    entity: 'TICKET',
    entityId: ticketId,
    ticketId,
    action: 'TICKET_UNARCHIVED',
    changes: null,
  });
  return ticket;
}

// Change la priorité d'un ticket : recalcule l'échéance de devis (base = ouverture)
// et enregistre l'entrée d'historique (traçabilité + KPI). Passage OBLIGÉ pour toute
// modification de priorité, afin que l'historique reste complet.
export async function updateTicketPriority(ticketId: string, priority: Priority, reason?: string) {
  const user = await requireAuth();
  if (!canChangeTicketPriority(user.role)) {
    throw new Error('Permissions insuffisantes pour modifier la priorité');
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      priority: true,
      openedAt: true,
      equipment: {
        select: {
          category: {
            select: { p1DelayDays: true, p2DelayDays: true, p3DelayDays: true },
          },
        },
      },
    },
  });

  if (!ticket) {
    throw new Error('Ticket introuvable');
  }
  if (ticket.priority === priority) {
    return { unchanged: true as const };
  }

  const quoteDeadline = computeQuoteDeadline(ticket.openedAt, priority, ticket.equipment.category);
  const cleanReason = reason?.trim() || null;

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: { priority, quoteDeadline },
    }),
    prisma.priorityChange.create({
      data: {
        ticketId,
        changedById: user.id,
        fromPriority: ticket.priority,
        toPriority: priority,
        reason: cleanReason,
      },
    }),
  ]);

  revalidatePath('/tickets');
  revalidatePath(`/tickets/${ticketId}`);
  await logAudit({
    actorId: user.id,
    entity: 'TICKET',
    entityId: ticketId,
    ticketId,
    action: 'TICKET_PRIORITY_CHANGED',
    changes: { from: ticket.priority, to: priority, reason: cleanReason },
  });

  return { unchanged: false as const, from: ticket.priority, to: priority };
}

export async function getTickets(filters?: {
  teamId?: string;
  equipmentId?: string;
  locationId?: string;
  statusId?: string;
  priority?: Priority;
  // "Devis en retard" : échéance SLA dépassée et aucun devis encore reçu.
  overdueOnly?: boolean;
  isArchived?: boolean;
  sortBy?: 'createdAt' | 'ticketNumber' | 'priority' | 'quoteDeadline';
  sortOrder?: 'asc' | 'desc';
}) {
  const user = await requireAuth();

  const where: any = {
    isArchived: filters?.isArchived ?? false,
    // Visibilité centralisée: {} pour ADMIN/MANAGER, sinon abonnement OU équipe-via-groupe.
    ...ticketVisibilityWhere(user),
  };

  // Filtres optionnels
  if (filters?.teamId) where.teamId = filters.teamId;
  if (filters?.equipmentId) where.equipmentId = filters.equipmentId;
  if (filters?.locationId) where.locationId = filters.locationId;
  if (filters?.statusId) where.statusId = filters.statusId;
  if (filters?.priority) where.priority = filters.priority;
  if (filters?.overdueOnly) {
    where.quoteDeadline = { not: null, lt: new Date() };
    where.status = { isFinal: false };
    where.quotes = { none: { status: { in: ['RECEIVED', 'ACCEPTED'] } } };
  }

  // Tri effectué en SQL (plus de tri en mémoire) + borne de sécurité.
  // priority: P1<P2<P3 => asc = P1 en tête. quoteDeadline: échéance la plus proche/dépassée d'abord.
  const orderBy: Prisma.TicketOrderByWithRelationInput[] =
    filters?.sortBy === 'ticketNumber'
      ? [{ ticketNumber: filters.sortOrder === 'asc' ? 'asc' : 'desc' }, { createdAt: 'desc' }]
      : filters?.sortBy === 'priority'
        ? [{ priority: 'asc' }, { createdAt: 'desc' }]
        : filters?.sortBy === 'quoteDeadline'
          ? [{ quoteDeadline: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }];

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      equipment: true,
      location: true,
      team: true,
      status: true,
      requester: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      maintainer: true,
      assignee: { select: { id: true, displayName: true } },
      _count: {
        select: {
          chatMessages: true,
          attachments: true,
        },
      },
    },
    orderBy,
    take: 1000,
  });

  return tickets;
}

export async function getTicketById(id: string) {
  const user = await requireAuth();

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      equipment: {
        include: {
          category: true,
        },
      },
      location: true,
      team: {
        include: {
          statuses: {
            orderBy: { order: 'asc' },
          },
        },
      },
      status: true,
      requester: {
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
        },
      },
      maintainer: true,
      assignee: { select: { id: true, displayName: true } },
      failureCode: { select: { id: true, label: true } },
      causeCode: { select: { id: true, label: true } },
      remedyCode: { select: { id: true, label: true } },
      chatMessages: {
        include: {
          author: {
            select: {
              id: true,
              displayName: true,
            },
          },
          attachments: {
            select: {
              id: true,
              type: true,
              url: true,
              description: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      attachments: {
        select: {
          id: true,
          type: true,
          url: true,
          description: true,
          createdAt: true,
          uploadedBy: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      },
      subscriptions: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              role: true,
            },
          },
        },
      },
      tasks: {
        orderBy: { order: 'asc' },
        select: { id: true, label: true, order: true, done: true, doneBy: { select: { displayName: true } }, doneAt: true },
      },
      workLogs: {
        orderBy: { performedAt: 'desc' },
        select: { id: true, minutes: true, performedAt: true, note: true, user: { select: { displayName: true } } },
      },
      costLines: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, label: true, amountCents: true, quantity: true },
      },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take: 80,
        include: {
          actor: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  if (!ticket) {
    throw new Error('Ticket introuvable');
  }

  // Vérifier les permissions via le helper centralisé (source unique de vérité) :
  // MAINTAINER = abonnement explicite seul, BASIC = abonnement OU équipe-via-groupe.
  if (!(await canUserAccessTicket(user, ticket.id))) {
    throw new Error('Accès refusé');
  }

  return ticket;
}

export async function subscribeUserToTicket(ticketId: string, userId: string) {
  const actor = await requireRole(['ADMIN', 'MANAGER']);

  try {
    await prisma.ticketSubscription.create({
      data: { ticketId, userId },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new Error('Cet utilisateur est déjà abonné à ce ticket');
    }
    throw error;
  }

  revalidatePath(`/tickets/${ticketId}`);
  await logAudit({
    actorId: actor.id,
    entity: 'TICKET',
    entityId: ticketId,
    ticketId,
    action: 'SUBSCRIBER_ADDED',
    changes: { userId },
  });
}

export async function subscribeCurrentUserToTicket(ticketId: string) {
  const user = await requireAuth();

  // Anti auto-escalade : on ne peut suivre qu'un ticket auquel on a DÉJÀ accès.
  // MAINTAINER = abonnement explicite seul → s'il n'est pas déjà abonné, refus
  // (il doit être abonné par un ADMIN/MANAGER ou via le dispatch). BASIC avec
  // accès équipe-via-groupe peut suivre. ADMIN/MANAGER toujours autorisés.
  if (!(await canUserAccessTicket(user, ticketId))) {
    throw new Error('Accès refusé');
  }

  try {
    await prisma.ticketSubscription.create({
      data: { ticketId, userId: user.id },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new Error('Vous êtes déjà abonné à ce ticket');
    }
    throw error;
  }

  revalidatePath(`/tickets/${ticketId}`);
  await logAudit({
    actorId: user.id,
    entity: 'TICKET',
    entityId: ticketId,
    ticketId,
    action: 'SUBSCRIBER_ADDED_SELF',
    changes: { userId: user.id },
  });
}

export async function unsubscribeCurrentUserFromTicket(ticketId: string) {
  const user = await requireAuth();

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { requesterId: true },
  });

  if (!ticket) {
    throw new Error('Ticket introuvable');
  }

  if (ticket.requesterId === user.id) {
    throw new Error('Le demandeur doit rester abonné au ticket');
  }

  await prisma.ticketSubscription.deleteMany({
    where: { ticketId, userId: user.id },
  });

  revalidatePath(`/tickets/${ticketId}`);
  await logAudit({
    actorId: user.id,
    entity: 'TICKET',
    entityId: ticketId,
    ticketId,
    action: 'SUBSCRIBER_REMOVED_SELF',
    changes: { userId: user.id },
  });
}

export async function unsubscribeUserFromTicket(ticketId: string, userId: string) {
  const actor = await requireRole(['ADMIN', 'MANAGER']);

  // Vérifier que ce n'est pas le demandeur
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { requesterId: true },
  });

  if (ticket?.requesterId === userId) {
    throw new Error('Impossible de désabonner le demandeur du ticket');
  }

  await prisma.ticketSubscription.deleteMany({
    where: { ticketId, userId },
  });

  revalidatePath(`/tickets/${ticketId}`);
  await logAudit({
    actorId: actor.id,
    entity: 'TICKET',
    entityId: ticketId,
    ticketId,
    action: 'SUBSCRIBER_REMOVED',
    changes: { userId },
  });
}

export async function subscribeGroupToTicket(ticketId: string, groupId: string) {
  const actor = await requireRole(['ADMIN', 'MANAGER']);

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });

  if (members.length === 0) {
    throw new Error('Ce groupe ne contient aucun membre');
  }

  const result = await prisma.ticketSubscription.createMany({
    data: members.map((m: { userId: string }) => ({
      ticketId,
      userId: m.userId,
    })),
    skipDuplicates: true,
  });

  revalidatePath(`/tickets/${ticketId}`);
  await logAudit({
    actorId: actor.id,
    entity: 'TICKET',
    entityId: ticketId,
    ticketId,
    action: 'GROUP_SUBSCRIBED',
    changes: { groupId, membersAdded: result.count },
  });
  return result.count;
}

export async function searchTickets(query: string) {
  const user = await requireAuth();

  if (!query.trim()) return [];

  const numericQuery = Number(query.trim());

  const where: any = {
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { equipment: { name: { contains: query, mode: 'insensitive' } } },
      { equipment: { refCode: { contains: query, mode: 'insensitive' } } },
      { requester: { displayName: { contains: query, mode: 'insensitive' } } },
      ...(Number.isInteger(numericQuery) && numericQuery > 0
        ? [{ ticketNumber: numericQuery }]
        : []),
    ],
  };

  // BASIC / MAINTAINER: tickets abonnés ou équipe autorisée (visibilité centralisée).
  const visibility = ticketVisibilityWhere(user);
  if (Object.keys(visibility).length > 0) {
    where.AND = [...(where.AND || []), visibility];
  }

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      equipment: true,
      location: true,
      team: true,
      status: true,
      requester: {
        select: { id: true, displayName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return [...tickets].sort((a: any, b: any) => {
    const aNum = typeof a.ticketNumber === 'number' ? a.ticketNumber : 0;
    const bNum = typeof b.ticketNumber === 'number' ? b.ticketNumber : 0;
    if (aNum === bNum) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return bNum - aNum;
  });
}

export async function searchTicketsAdvanced(filters: {
  q?: string;
  from?: string;
  to?: string;
  teamId?: string;
  locationId?: string;
  equipmentId?: string;
  requesterId?: string;
  statusId?: string;
  isArchived?: boolean;
  sortBy?: 'createdAt' | 'ticketNumber';
  sortOrder?: 'asc' | 'desc';
}) {
  const user = await requireAuth();
  const where: any = {};

  const q = (filters.q || '').trim();
  const numericQuery = Number(q);
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { equipment: { name: { contains: q, mode: 'insensitive' } } },
      { equipment: { refCode: { contains: q, mode: 'insensitive' } } },
      { requester: { displayName: { contains: q, mode: 'insensitive' } } },
      ...(Number.isInteger(numericQuery) && numericQuery > 0 ? [{ ticketNumber: numericQuery }] : []),
    ];
  }

  const from = filters.from ? new Date(filters.from) : null;
  const to = filters.to ? new Date(filters.to) : null;
  if (from || to) {
    where.createdAt = {};
    if (from && !Number.isNaN(from.getTime())) {
      where.createdAt.gte = from;
    }
    if (to && !Number.isNaN(to.getTime())) {
      const toEnd = new Date(to);
      toEnd.setHours(23, 59, 59, 999);
      where.createdAt.lte = toEnd;
    }
  }

  if (filters.teamId) where.teamId = filters.teamId;
  if (filters.locationId) where.locationId = filters.locationId;
  if (filters.equipmentId) where.equipmentId = filters.equipmentId;
  if (filters.requesterId) where.requesterId = filters.requesterId;
  if (filters.statusId) where.statusId = filters.statusId;
  if (typeof filters.isArchived === 'boolean') where.isArchived = filters.isArchived;

  // BASIC / MAINTAINER: visibilité centralisée (abonnement OU équipe-via-groupe).
  const visibility = ticketVisibilityWhere(user);
  if (Object.keys(visibility).length > 0) {
    where.AND = [...(where.AND || []), visibility];
  }

  const sortBy = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder || 'desc';

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      equipment: true,
      location: true,
      team: true,
      status: true,
      requester: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
    orderBy: sortBy === 'ticketNumber' ? { ticketNumber: sortOrder } : { createdAt: sortOrder },
    take: 200,
  });

  return tickets;
}

export async function getAvailableUsersForTicketSubscription(ticketId: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  const users = await prisma.user.findMany({
    where: {
      subscriptions: {
        none: { ticketId },
      },
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
    },
    orderBy: { displayName: 'asc' },
  });

  return users;
}
