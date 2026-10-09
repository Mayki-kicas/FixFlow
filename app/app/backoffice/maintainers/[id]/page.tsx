import { getMaintainerById } from '@/lib/actions/maintainers';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import MaintainerForm from '@/components/MaintainerForm';
import ContractsManager from '@/components/ContractsManager';
import { getContractsForMaintainer } from '@/lib/actions/contracts';
import { formatEuros } from '@/lib/costs-core';

export default async function MaintainerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const { id } = await params;

  let maintainer;
  try {
    maintainer = await getMaintainerById(id);
  } catch {
    notFound();
  }

  const [criticalCount, contracts, ticketsHandled, acceptedQuotes, externalCostLines] = await Promise.all([
    prisma.ticket.count({ where: { priority: 'P1', isArchived: false } }),
    getContractsForMaintainer(id),
    prisma.ticket.count({ where: { maintainerId: id } }),
    prisma.quote.aggregate({ where: { maintainerId: id, status: 'ACCEPTED' }, _sum: { amountCents: true } }),
    prisma.costLine.findMany({ where: { type: 'EXTERNAL', ticket: { maintainerId: id } }, select: { amountCents: true, quantity: true } }),
  ]);
  const quotesCents = acceptedQuotes._sum.amountCents ?? 0;
  const externalCents = externalCostLines.reduce((s, l) => s + l.amountCents * l.quantity, 0);
  const contractsCents = contracts.filter((c) => c.active).reduce((s, c) => s + (c.costCents ?? 0), 0);

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <Link href="/backoffice/maintainers" className="text-xs text-muted hover:text-foreground transition-colors duration-150 ease-out">
                  ← Retour aux mainteneurs
                </Link>
                <span className="text-border-default">|</span>
                <h1 className="page-toolbar-title">{maintainer.name}</h1>
                <span className="page-toolbar-subtitle tabular-nums">{maintainer.tickets.length} ticket(s) assigné(s)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid gap-4">
          {/* Formulaire mainteneur */}
          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
            {maintainer.contact && <p className="text-xs text-muted mb-1">{maintainer.contact}</p>}
            <MaintainerForm maintainer={maintainer} />
          </div>

          {/* Synthèse prestataire */}
          <div className="card">
            <div className="card-head"><span className="card-head-title">Synthèse prestataire</span></div>
            <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4">
              <div className="stat-tile"><p className="stat-label">OT traités</p><p className="stat-value tabular-nums">{ticketsHandled}</p></div>
              <div className="stat-tile"><p className="stat-label">Devis acceptés</p><p className="stat-value text-base tabular-nums">{formatEuros(quotesCents)}</p></div>
              <div className="stat-tile"><p className="stat-label">Coût externe (OT)</p><p className="stat-value text-base tabular-nums">{formatEuros(externalCents)}</p></div>
              <div className="stat-tile"><p className="stat-label">Contrats actifs</p><p className="stat-value text-base tabular-nums">{formatEuros(contractsCents)}/an</p></div>
            </div>
          </div>

          {/* Contrats */}
          <div className="card">
            <div className="card-head"><span className="card-head-title">Contrats</span></div>
            <div className="p-3">
              <ContractsManager maintainerId={maintainer.id} contracts={contracts} />
            </div>
          </div>

          {/* Liste des tickets assignés */}
          {maintainer.tickets.length > 0 && (
            <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
              <div className="section-band">
                <h3 className="section-band-title">Tickets assignés</h3>
              </div>
              <div className="space-y-1.5">
                {maintainer.tickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                    className="block p-2 border border-border-default rounded-lg hover:bg-surface-alt transition-colors duration-150 ease-out"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-medium text-foreground">{ticket.title}</p>
                        <p className="text-[10px] text-muted">
                          {ticket.equipment.name} - {ticket.location?.name || 'Global'}
                        </p>
                      </div>
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-medium rounded"
                        style={{ backgroundColor: `${ticket.status.color || '#94a3b8'}1a`, color: ticket.status.color || '#94a3b8' }}
                      >
                        {ticket.status.name}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
