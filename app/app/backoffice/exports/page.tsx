import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ExportButtons from '@/components/ExportButtons';
import TicketExportPanel from '@/components/TicketExportPanel';
import { prisma } from '@/lib/prisma';
import Header from '@/components/Header';

export default async function ExportsPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const [teams, locations, statuses, criticalCount] = await Promise.all([
    prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { code: 'asc' },
    }),
    prisma.ticketStatus.findMany({
      select: {
        id: true,
        name: true,
        team: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ team: { name: 'asc' } }, { order: 'asc' }],
    }),
    getVisibleCriticalTicketsCountForUser(user),
  ]);

  const teamOptions = teams.map((team) => ({ id: team.id, label: team.name }));
  const locationOptions = locations.map((location) => ({
    id: location.id,
    label: `${location.code} - ${location.name}`,
  }));
  const statusOptions = statuses.map((status) => ({
    id: status.id,
    label: `${status.team?.name || 'Global'} - ${status.name}`,
  }));

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
      <div className="page-toolbar">
        <div className="page-toolbar-inner">
          <div className="page-toolbar-row">
            <div className="flex items-center gap-3">
              <Link href="/backoffice" className="text-xs text-muted hover:text-foreground transition-colors duration-150 ease-out">
                ← Retour au backoffice
              </Link>
              <span className="text-border-default">|</span>
              <h1 className="page-toolbar-title">Exports</h1>
              <span className="page-toolbar-subtitle">Exporter les données en format CSV</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

        <div className="space-y-3">
          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
            <div className="section-band">
              <h2 className="section-band-title">Tickets</h2>
            </div>
            <p className="text-xs text-muted mb-3">
              Exporter les tickets avec filtres (période, équipe, localisation, statut, urgence)
            </p>
            <TicketExportPanel
              teams={teamOptions}
              locations={locationOptions}
              statuses={statusOptions}
            />
          </div>

          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
            <div className="section-band">
              <h2 className="section-band-title">Équipements</h2>
            </div>
            <p className="text-xs text-muted mb-3">
              Exporter la liste de tous les équipements avec leurs localisations et statistiques
            </p>
            <ExportButtons type="equipments" />
          </div>

          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
            <div className="section-band">
              <h2 className="section-band-title">Localisations</h2>
            </div>
            <p className="text-xs text-muted mb-3">
              Exporter la liste de tous les sites avec leurs coordonnées
            </p>
            <ExportButtons type="locations" />
          </div>

          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
            <div className="section-band">
              <h2 className="section-band-title">Devis</h2>
            </div>
            <p className="text-xs text-muted mb-3">
              Exporter tous les devis (ticket, prestataire, statut, montant, échéance SLA, décision)
            </p>
            <ExportButtons type="quotes" />
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
