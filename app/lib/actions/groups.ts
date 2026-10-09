'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { canBelongToGroup } from '@/lib/access-policy';

export type CreateGroupInput = {
  name: string;
  description?: string;
};

export type UpdateGroupInput = {
  id: string;
  name?: string;
  description?: string;
};

export async function createGroup(input: CreateGroupInput) {
  await requireRole(['ADMIN', 'MANAGER']);

  const group = await prisma.group.create({
    data: {
      name: input.name,
      description: input.description,
    },
  });

  revalidatePath('/backoffice/groups');
  return group;
}

export async function updateGroup(input: UpdateGroupInput) {
  await requireRole(['ADMIN', 'MANAGER']);

  const { id, ...data } = input;

  const group = await prisma.group.update({
    where: { id },
    data,
  });

  revalidatePath('/backoffice/groups');
  revalidatePath(`/backoffice/groups/${id}`);
  return group;
}

export async function deleteGroup(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  // Vérifier qu'il n'y a pas de membres
  const memberCount = await prisma.groupMember.count({
    where: { groupId: id },
  });

  if (memberCount > 0) {
    throw new Error(`Ce groupe contient ${memberCount} membre(s). Retirez-les d'abord.`);
  }

  await prisma.group.delete({
    where: { id },
  });

  revalidatePath('/backoffice/groups');
}

export async function getGroups() {
  await requireRole(['ADMIN', 'MANAGER']);

  const groups = await prisma.group.findMany({
    include: {
      _count: {
        select: {
          members: true,
          teams: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return groups;
}

export async function getGroupById(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
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
      teams: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!group) {
    throw new Error('Groupe introuvable');
  }

  return group;
}

export async function addMemberToGroup(groupId: string, userId: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  // Un MAINTAINER (technicien extérieur) ne rejoint jamais un groupe : accès explicite seulement.
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (target && !canBelongToGroup(target.role)) {
    throw new Error("Les mainteneurs n'accèdent qu'aux tickets où on les abonne explicitement");
  }

  // Vérifier si le membre existe déjà
  const existingMember = await prisma.groupMember.findFirst({
    where: {
      groupId,
      userId,
    },
  });

  if (existingMember) {
    throw new Error('Cet utilisateur est déjà membre de ce groupe');
  }

  const member = await prisma.groupMember.create({
    data: {
      groupId,
      userId,
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  revalidatePath(`/backoffice/groups/${groupId}`);
  return member;
}

export async function addMembersToGroup(groupId: string, userIds: string[]) {
  await requireRole(['ADMIN', 'MANAGER']);

  const requestedIds = Array.from(new Set(userIds.filter(Boolean)));

  if (requestedIds.length === 0) {
    throw new Error('Aucun utilisateur sélectionné');
  }

  // Exclure les MAINTAINER : ils n'accèdent qu'aux tickets où on les abonne explicitement.
  const nonMaintainers = await prisma.user.findMany({
    where: { id: { in: requestedIds }, role: { not: 'MAINTAINER' } },
    select: { id: true },
  });
  const uniqueUserIds = nonMaintainers.map((u) => u.id);

  if (uniqueUserIds.length === 0) {
    throw new Error('Aucun utilisateur éligible sélectionné');
  }

  await prisma.groupMember.createMany({
    data: uniqueUserIds.map((userId) => ({
      groupId,
      userId,
    })),
    skipDuplicates: true,
  });

  revalidatePath(`/backoffice/groups/${groupId}`);
}

export async function removeMemberFromGroup(groupId: string, userId: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  await prisma.groupMember.deleteMany({
    where: {
      groupId,
      userId,
    },
  });

  revalidatePath(`/backoffice/groups/${groupId}`);
}

export async function getAvailableUsersForGroup(groupId: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  // Récupérer les utilisateurs pas encore membres de ce groupe.
  // Les MAINTAINER (techniciens extérieurs) n'accèdent qu'aux tickets où on les
  // abonne explicitement : on ne les propose jamais à l'ajout dans un groupe.
  const users = await prisma.user.findMany({
    where: {
      role: { not: 'MAINTAINER' },
      memberships: {
        none: {
          groupId,
        },
      },
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
    },
    orderBy: {
      displayName: 'asc',
    },
  });

  return users;
}

export async function linkGroupToTeam(groupId: string, teamId: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  try {
    await prisma.groupTeam.create({
      data: { groupId, teamId },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new Error('Ce groupe est déjà lié à cette équipe');
    }
    throw error;
  }

  revalidatePath('/backoffice/groups');
  revalidatePath('/backoffice/teams');
  revalidatePath(`/backoffice/groups/${groupId}`);
  revalidatePath(`/backoffice/teams/${teamId}`);
}

export async function unlinkGroupFromTeam(groupId: string, teamId: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  await prisma.groupTeam.deleteMany({
    where: { groupId, teamId },
  });

  revalidatePath('/backoffice/groups');
  revalidatePath('/backoffice/teams');
  revalidatePath(`/backoffice/groups/${groupId}`);
  revalidatePath(`/backoffice/teams/${teamId}`);
}

export async function getTeamsForGroupLinking() {
  await requireRole(['ADMIN', 'MANAGER']);

  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });

  return teams;
}

export async function getGroupsForTicketSubscription() {
  await requireRole(['ADMIN', 'MANAGER']);

  const groups = await prisma.group.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: { members: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return groups;
}
