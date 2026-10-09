import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { canDeclareTicket } from '@/lib/access-policy';
import NewTicketForm from '@/components/NewTicketForm';
import Header from '@/components/Header';

export default async function NewTicketPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Un MAINTAINER (technicien extérieur) ne déclare pas de ticket.
  if (!canDeclareTicket(user.role)) {
    redirect('/');
  }

  const isBasicUser = user.role === 'BASIC';

  let allowedCategoryIds: string[] | undefined;
  if (isBasicUser) {
    const categories = await prisma.equipmentCategory.findMany({
      where: {
        OR: [
          {
            userSubscriptions: {
              some: {
                userId: user.id,
              },
            },
          },
          {
            groupSubscriptions: {
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
        ],
        equipments: {
          some: {},
        },
      },
      select: { id: true },
    });
    allowedCategoryIds = categories.map((category) => category.id);
  }

  const equipments = await prisma.equipment.findMany({
    where: {
      // Un équipement réformé ne peut plus faire l'objet d'une nouvelle déclaration.
      lifecycleStatus: { not: 'RETIRED' },
      ...(isBasicUser && allowedCategoryIds
        ? { categoryId: { in: allowedCategoryIds.length > 0 ? allowedCategoryIds : ['__none__'] } }
        : {}),
    },
    include: {
      location: true,
      team: true,
      category: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  const locations = await prisma.location.findMany({
    include: {
      equipments: {
        include: {
          category: true,
          team: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  const criticalCount = await getVisibleCriticalTicketsCountForUser(user);

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <h1 className="page-toolbar-title">Déclarer un incident</h1>
                <span className="page-toolbar-subtitle">
                  Créer un nouveau ticket de maintenance
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <NewTicketForm locations={locations} equipments={equipments} />
        </div>
      </div>
    </>
  );
}
