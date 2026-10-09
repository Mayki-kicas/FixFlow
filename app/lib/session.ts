import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { prisma } from './prisma';
import { UserRole } from '@prisma/client';
import { canUserAccessTicket, ticketVisibilityWhere } from './visibility';

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      memberships: {
        include: {
          group: true,
        },
      },
    },
  });

  return user;
}

export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Non authentifié');
  }

  return user;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth();

  if (!allowedRoles.includes(user.role)) {
    throw new Error('Permissions insuffisantes');
  }

  return user;
}

export async function getVisibleCriticalTicketsCountForUser(user: {
  id: string;
  role: UserRole;
}) {
  return prisma.ticket.count({
    where: {
      priority: 'P1',
      isArchived: false,
      status: {
        isFinal: false,
      },
      // Applique la même visibilité (abonnement OU équipe-via-groupe) que les listes.
      ...ticketVisibilityWhere(user),
    },
  });
}

export async function canManageTicket(ticketId: string) {
  const user = await requireAuth();
  // Source unique de vérité: abonnement OU équipe-via-groupe (ADMIN/MANAGER toujours ok).
  return canUserAccessTicket(user, ticketId);
}
