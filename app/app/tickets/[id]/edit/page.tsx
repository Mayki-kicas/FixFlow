import { getTicketById } from '@/lib/actions/tickets';
import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import TicketEditForm from '@/components/TicketEditForm';

export default async function EditTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const { id } = await params;

  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    redirect(`/tickets/${id}`);
  }

  let ticket;
  try {
    ticket = await getTicketById(id);
  } catch {
    notFound();
  }

  const [maintainers, criticalCount, equipments] = await Promise.all([
    prisma.maintainer.findMany({
      orderBy: { name: 'asc' },
    }),
    getVisibleCriticalTicketsCountForUser(user),
    prisma.equipment.findMany({
      include: {
        location: true,
        team: true,
        category: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
  ]);

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <Link
                  href={`/tickets/${id}`}
                  className="text-xs text-muted transition-colors hover:text-foreground"
                >
                  ← Retour au ticket
                </Link>
                <span className="text-border-default">|</span>
                <h1 className="page-toolbar-title">Modifier le ticket</h1>
                <span className="page-toolbar-subtitle tabular-nums">{ticket.ticketNumber} : {ticket.title}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-white/90 dark:bg-[#121821]/90 border border-border-default rounded-xl shadow-soft-md p-4 backdrop-blur">
            <TicketEditForm
              ticket={{
                id: ticket.id,
                title: ticket.title,
                description: ticket.description,
                equipmentId: ticket.equipmentId,
                maintainerId: ticket.maintainerId,
                invoiceNumber: ticket.invoiceNumber,
                quoteNumber: ticket.quoteNumber,
                dueDate: ticket.dueDate,
                nature: ticket.nature,
                interventionStartAt: ticket.interventionStartAt,
                interventionEndAt: ticket.interventionEndAt,
              }}
              maintainers={maintainers}
              equipments={equipments}
            />
          </div>
        </div>
      </div>
    </>
  );
}
