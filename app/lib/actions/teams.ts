'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/session';
import { isSubscriptionOnly, isVisibilityRestricted, ticketVisibilityWhere } from '@/lib/visibility';

export type CreateTeamInput = {
  name: string;
  description?: string;
};

export type UpdateTeamInput = {
  id: string;
  name?: string;
  description?: string;
};

// Statuts par défaut créés lors de la création d'une équipe
const DEFAULT_STATUSES = [
  { name: 'Nouvelle demande', color: '#3b82f6', order: 0, isFinal: false },
  { name: 'En cours de traitement', color: '#f59e0b', order: 1, isFinal: false },
  { name: "En attente d'intervention", color: '#8b5cf6', order: 2, isFinal: false },
  { name: 'Terminé', color: '#22c55e', order: 3, isFinal: true },
  { name: 'Annulé', color: '#6b7280', order: 4, isFinal: true },
];

export async function createTeam(input: CreateTeamInput) {
  await requireRole(['ADMIN', 'MANAGER']);

  const team = await prisma.team.create({
    data: {
      ...input,
      statuses: {
        create: DEFAULT_STATUSES,
      },
    },
    include: {
      statuses: true,
    },
  });

  revalidatePath('/backoffice/teams');
  return team;
}

export async function updateTeam(input: UpdateTeamInput) {
  await requireRole(['ADMIN', 'MANAGER']);

  const { id, ...data } = input;

  const team = await prisma.team.update({
    where: { id },
    data,
  });

  revalidatePath('/backoffice/teams');
  revalidatePath(`/backoffice/teams/${id}`);
  return team;
}

export async function deleteTeam(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  // Vérifier qu'il n'y a pas d'équipements ou de tickets liés
  const equipmentCount = await prisma.equipment.count({
    where: { teamId: id },
  });

  const ticketCount = await prisma.ticket.count({
    where: { teamId: id },
  });

  if (equipmentCount > 0 || ticketCount > 0) {
    throw new Error(
      `Impossible de supprimer cette équipe : ${equipmentCount} équipement(s) et ${ticketCount} ticket(s) y sont rattachés`
    );
  }

  await prisma.team.delete({
    where: { id },
  });

  revalidatePath('/backoffice/teams');
}

export async function getTeams() {
  await requireRole(['ADMIN', 'MANAGER']);
  const teams = await prisma.team.findMany({
    include: {
      _count: {
        select: {
          equipments: true,
          tickets: true,
          statuses: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return teams;
}

export async function getTeamWithTicketsForKanban(teamId: string) {
  const user = await requireAuth();
  const isRestrictedUser = isVisibilityRestricted(user.role);

  if (isRestrictedUser) {
    // Gate d'accès à l'équipe. MAINTAINER = abonnement explicite seul (pas d'accès
    // via groupe). BASIC = membre d'un groupe lié à l'équipe (même si 0 ticket) OU
    // abonné à au moins un ticket de l'équipe.
    const subscribedToTeamTicket = {
      tickets: { some: { isArchived: false, subscriptions: { some: { userId: user.id } } } },
    };
    const accessibleTeam = await prisma.team.findFirst({
      where: {
        id: teamId,
        ...(isSubscriptionOnly(user.role)
          ? subscribedToTeamTicket
          : {
              OR: [
                { groups: { some: { group: { members: { some: { userId: user.id } } } } } },
                subscribedToTeamTicket,
              ],
            }),
      },
      select: { id: true },
    });

    if (!accessibleTeam) {
      return null;
    }
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      statuses: {
        orderBy: {
          order: 'asc',
        },
      },
      tickets: {
        where: {
          isArchived: false,
          // Même filtre de visibilité appliqué aux tickets remontés dans le kanban.
          ...ticketVisibilityWhere(user),
        },
        orderBy: [
          // P1 (plus haute priorité) en tête : l'enum est ordonné P1<P2<P3 → tri asc.
          { priority: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          status: true,
          equipment: true,
          location: true,
          requester: {
            select: {
              id: true,
              displayName: true,
            },
          },
          _count: {
            select: {
              chatMessages: true,
              attachments: true,
            },
          },
        },
      },
    },
  });

  return team;
}

export async function getTeamsForSelector() {
  const user = await requireAuth();
  const isRestrictedUser = user.role === 'BASIC' || user.role === 'MAINTAINER';

  if (!isRestrictedUser) {
    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            tickets: {
              where: {
                isArchived: false,
                status: {
                  isFinal: false,
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return teams;
  }

  // MAINTAINER = abonnement explicite seul : pas d'accès équipe-via-groupe.
  const teamsByGroupAccessPromise = isSubscriptionOnly(user.role)
    ? Promise.resolve([] as { id: string; name: string; _count: { tickets: number } }[])
    : prisma.team.findMany({
      where: {
        groups: {
          some: {
            group: {
              members: {
                some: {
                  userId: user.id,
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            tickets: {
              where: {
                isArchived: false,
                status: {
                  isFinal: false,
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

  const [teamsByGroupAccess, teamsByTicketAccess] = await Promise.all([
    teamsByGroupAccessPromise,
    prisma.team.findMany({
      where: {
        tickets: {
          some: {
            isArchived: false,
            subscriptions: {
              some: {
                userId: user.id,
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            tickets: {
              where: {
                isArchived: false,
                status: {
                  isFinal: false,
                },
                subscriptions: {
                  some: {
                    userId: user.id,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const merged = new Map<
    string,
    { id: string; name: string; _count: { tickets: number } }
  >();

  for (const team of teamsByGroupAccess) {
    merged.set(team.id, team);
  }
  for (const team of teamsByTicketAccess) {
    if (!merged.has(team.id)) {
      merged.set(team.id, team);
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTeamById(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      equipments: {
        include: {
          location: true,
          category: true,
        },
      },
      statuses: {
        orderBy: { order: 'asc' },
      },
      groups: {
        include: {
          group: {
            select: {
              id: true,
              name: true,
              _count: {
                select: { members: true },
              },
            },
          },
        },
      },
      tickets: {
        take: 20,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          status: true,
          equipment: true,
          requester: {
            select: {
              displayName: true,
            },
          },
        },
      },
    },
  });

  if (!team) {
    throw new Error('Équipe introuvable');
  }

  return team;
}

// Statuses
export async function createStatus(data: {
  name: string;
  color?: string;
  teamId: string;
  order?: number;
  isFinal?: boolean;
}) {
  await requireRole(['ADMIN', 'MANAGER']);

  // Si pas d'ordre spécifié, mettre à la fin
  if (data.order === undefined) {
    const maxOrder = await prisma.ticketStatus.aggregate({
      where: { teamId: data.teamId },
      _max: { order: true },
    });
    data.order = (maxOrder._max.order ?? -1) + 1;
  }

  const status = await prisma.ticketStatus.create({
    data,
  });

  revalidatePath('/backoffice/teams');
  revalidatePath(`/backoffice/teams/${data.teamId}`);
  return status;
}

export async function updateStatus(data: {
  id: string;
  name?: string;
  color?: string;
  order?: number;
  isFinal?: boolean;
}) {
  await requireRole(['ADMIN', 'MANAGER']);

  const { id, ...updateData } = data;

  const status = await prisma.ticketStatus.update({
    where: { id },
    data: updateData,
  });

  revalidatePath('/backoffice/teams');
  return status;
}

export async function deleteStatus(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  // Vérifier qu'il n'y a pas de tickets avec ce statut
  const ticketCount = await prisma.ticket.count({
    where: { statusId: id },
  });

  if (ticketCount > 0) {
    throw new Error(
      `Impossible de supprimer ce statut : ${ticketCount} ticket(s) l'utilisent`
    );
  }

  await prisma.ticketStatus.delete({
    where: { id },
  });

  revalidatePath('/backoffice/teams');
}

export async function reorderStatuses(teamId: string, statusIds: string[]) {
  await requireRole(['ADMIN', 'MANAGER']);

  // Mettre à jour l'ordre de chaque statut
  await Promise.all(
    statusIds.map((id, index) =>
      prisma.ticketStatus.update({
        where: { id },
        data: { order: index },
      })
    )
  );

  revalidatePath('/backoffice/teams');
  revalidatePath(`/backoffice/teams/${teamId}`);
  revalidatePath('/tickets');
}

export async function moveStatusUp(statusId: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  const status = await prisma.ticketStatus.findUnique({
    where: { id: statusId },
  });

  if (!status || !status.teamId) {
    throw new Error('Statut introuvable');
  }

  // Trouver le statut juste au-dessus
  const statusAbove = await prisma.ticketStatus.findFirst({
    where: {
      teamId: status.teamId,
      order: { lt: status.order },
    },
    orderBy: { order: 'desc' },
  });

  if (!statusAbove) {
    return; // Déjà en haut
  }

  // Échanger les ordres
  await prisma.$transaction([
    prisma.ticketStatus.update({
      where: { id: statusId },
      data: { order: statusAbove.order },
    }),
    prisma.ticketStatus.update({
      where: { id: statusAbove.id },
      data: { order: status.order },
    }),
  ]);

  revalidatePath('/backoffice/teams');
  revalidatePath(`/backoffice/teams/${status.teamId}`);
  revalidatePath('/tickets');
}

export async function moveStatusDown(statusId: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  const status = await prisma.ticketStatus.findUnique({
    where: { id: statusId },
  });

  if (!status || !status.teamId) {
    throw new Error('Statut introuvable');
  }

  // Trouver le statut juste en-dessous
  const statusBelow = await prisma.ticketStatus.findFirst({
    where: {
      teamId: status.teamId,
      order: { gt: status.order },
    },
    orderBy: { order: 'asc' },
  });

  if (!statusBelow) {
    return; // Déjà en bas
  }

  // Échanger les ordres
  await prisma.$transaction([
    prisma.ticketStatus.update({
      where: { id: statusId },
      data: { order: statusBelow.order },
    }),
    prisma.ticketStatus.update({
      where: { id: statusBelow.id },
      data: { order: status.order },
    }),
  ]);

  revalidatePath('/backoffice/teams');
  revalidatePath(`/backoffice/teams/${status.teamId}`);
  revalidatePath('/tickets');
}

export async function getGroupsForTeamLinking(teamId: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  const [allGroups, linkedGroupIds] = await Promise.all([
    prisma.group.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.groupTeam.findMany({
      where: { teamId },
      select: { groupId: true },
    }),
  ]);

  const linkedIds = new Set(linkedGroupIds.map((g: { groupId: string }) => g.groupId));

  return {
    all: allGroups,
    linkedIds: Array.from(linkedIds),
  };
}
