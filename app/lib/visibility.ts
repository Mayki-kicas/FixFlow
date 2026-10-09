import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from './prisma';

type VisibilityUser = {
  id: string;
  role: UserRole;
};

/**
 * BASIC et MAINTAINER ont une visibilité restreinte (ne voient pas tout).
 * ADMIN et MANAGER voient tout.
 */
export function isVisibilityRestricted(role: UserRole) {
  return role === 'BASIC' || role === 'MAINTAINER';
}

/**
 * MAINTAINER = technicien extérieur : accès UNIQUEMENT aux tickets où on l'a
 * abonné explicitement (dispatch / abonnement manuel). Jamais via un groupe,
 * même s'il en était membre. Voir la règle métier « accès explicite seulement ».
 */
export function isSubscriptionOnly(role: UserRole) {
  return role === 'MAINTAINER';
}

/**
 * Fragment Prisma `where` limitant les tickets visibles par l'utilisateur.
 * Renvoie `{}` (aucune restriction) pour ADMIN/MANAGER.
 *
 * - MAINTAINER : abonnement explicite uniquement.
 * - BASIC : abonnement explicite OU équipe accessible via un groupe.
 *
 * Source unique de vérité pour la visibilité tickets — à réutiliser partout
 * plutôt que de réécrire le filtre à la main.
 */
export function ticketVisibilityWhere(user: VisibilityUser): Prisma.TicketWhereInput {
  if (!isVisibilityRestricted(user.role)) {
    return {};
  }

  const subscribed: Prisma.TicketWhereInput = {
    subscriptions: { some: { userId: user.id } },
  };

  // Le mainteneur n'a QUE l'accès explicite (abonnement), jamais via un groupe.
  if (isSubscriptionOnly(user.role)) {
    return subscribed;
  }

  return {
    OR: [
      subscribed,
      {
        team: {
          groups: {
            some: {
              group: {
                members: {
                  some: { userId: user.id },
                },
              },
            },
          },
        },
      },
    ],
  };
}

/**
 * Vérification d'accès à un ticket unique (lecture + participation).
 * ADMIN/MANAGER: toujours autorisé. MAINTAINER: abonnement seul. BASIC: abonnement OU équipe-via-groupe.
 */
export async function canUserAccessTicket(user: VisibilityUser, ticketId: string) {
  if (!isVisibilityRestricted(user.role)) {
    return true;
  }

  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      ...ticketVisibilityWhere(user),
    },
    select: { id: true },
  });

  return !!ticket;
}
