import { searchTicketsAdvanced } from '@/lib/actions/tickets';
import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { prisma } from '@/lib/prisma';

type SearchParams = {
  q?: string;
  from?: string;
  to?: string;
  teamId?: string;
  locationId?: string;
  equipmentId?: string;
  requesterId?: string;
  statusId?: string;
  isArchived?: string;
  sortBy?: 'createdAt' | 'ticketNumber';
  sortOrder?: 'asc' | 'desc';
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const params = await searchParams;
  const hasAnyFilter = Object.values(params).some((value) => (value || '').toString().trim().length > 0);

  const filters = {
    q: params.q || '',
    from: params.from || '',
    to: params.to || '',
    teamId: params.teamId || '',
    locationId: params.locationId || '',
    equipmentId: params.equipmentId || '',
    requesterId: params.requesterId || '',
    statusId: params.statusId || '',
    isArchived: params.isArchived === 'true',
    sortBy: (params.sortBy || 'createdAt') as 'createdAt' | 'ticketNumber',
    sortOrder: (params.sortOrder || 'desc') as 'asc' | 'desc',
  };

  const [results, criticalCount, teams, locations, requesters, statuses, equipments] = await Promise.all([
    hasAnyFilter ? searchTicketsAdvanced(filters) : Promise.resolve([]),
    getVisibleCriticalTicketsCountForUser(user),
    prisma.team.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.location.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ select: { id: true, displayName: true }, orderBy: { displayName: 'asc' } }),
    prisma.ticketStatus.findMany({ select: { id: true, name: true }, orderBy: [{ teamId: 'asc' }, { order: 'asc' }] }),
    prisma.equipment.findMany({ select: { id: true, name: true, refCode: true }, orderBy: { name: 'asc' }, take: 500 }),
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
                  href="/tickets"
                  className="text-xs text-muted hover:text-foreground transition-colors"
                >
                  ← Retour aux tickets
                </Link>
                <span className="text-muted">|</span>
                <h1 className="page-toolbar-title">Recherche avancée</h1>
                <span className="page-toolbar-subtitle tabular-nums">
                  {hasAnyFilter ? `${results.length} résultat(s)` : 'Renseigne au moins un filtre'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
          <form method="GET" className="bg-surface border border-border-default rounded-xl p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label htmlFor="q" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Mot-clé</label>
                <input
                  id="q"
                  name="q"
                  type="search"
                  defaultValue={filters.q}
                  placeholder="Mot-clé, numéro ticket, équipement..."
                  className="w-full min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="from" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Du</label>
                <input
                  id="from"
                  name="from"
                  type="date"
                  defaultValue={filters.from}
                  className="w-full min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground tabular-nums transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="to" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Au</label>
                <input
                  id="to"
                  name="to"
                  type="date"
                  defaultValue={filters.to}
                  className="w-full min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground tabular-nums transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label htmlFor="teamId" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Équipe</label>
                <select id="teamId" name="teamId" defaultValue={filters.teamId} className="w-full min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none">
                  <option value="">Toutes les équipes</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="locationId" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Localisation</label>
                <select id="locationId" name="locationId" defaultValue={filters.locationId} className="w-full min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none">
                  <option value="">Toutes les localisations</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="equipmentId" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Équipement</label>
                <select id="equipmentId" name="equipmentId" defaultValue={filters.equipmentId} className="w-full min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none">
                  <option value="">Tous les équipements</option>
                  {equipments.map((equipment) => (
                    <option key={equipment.id} value={equipment.id}>{equipment.name} ({equipment.refCode})</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="requesterId" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Demandeur</label>
                <select id="requesterId" name="requesterId" defaultValue={filters.requesterId} className="w-full min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none">
                  <option value="">Tous les demandeurs</option>
                  {requesters.map((requester) => (
                    <option key={requester.id} value={requester.id}>{requester.displayName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label htmlFor="statusId" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Statut</label>
                <select id="statusId" name="statusId" defaultValue={filters.statusId} className="w-full min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none">
                  <option value="">Tous les statuts</option>
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>{status.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="isArchived" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Archivage</label>
                <select id="isArchived" name="isArchived" defaultValue={filters.isArchived ? 'true' : 'false'} className="w-full min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none">
                  <option value="false">Tickets actifs</option>
                  <option value="true">Tickets archivés</option>
                </select>
              </div>
              <div>
                <label htmlFor="sortBy" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Trier par</label>
                <select id="sortBy" name="sortBy" defaultValue={filters.sortBy} className="w-full min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none">
                  <option value="createdAt">Date</option>
                  <option value="ticketNumber">Numéro</option>
                </select>
              </div>
              <div>
                <label htmlFor="sortOrder" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Ordre</label>
                <select id="sortOrder" name="sortOrder" defaultValue={filters.sortOrder} className="w-full min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none">
                  <option value="desc">Descendant</option>
                  <option value="asc">Ascendant</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button type="submit" className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg transition-colors hover:bg-[color:var(--primary-hover)]">
                Rechercher
              </button>
              <Link href="/tickets/search" className="px-3 py-1.5 text-sm border border-border-default rounded-lg text-foreground transition-colors hover:bg-surface-alt">
                Réinitialiser
              </Link>
            </div>
          </form>

          {results.length === 0 ? (
            <div className="bg-surface border border-border-default rounded-xl p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                {hasAnyFilter ? 'Aucun ticket ne correspond à votre recherche.' : 'Ajoute des filtres puis lance la recherche.'}
              </p>
            </div>
          ) : (
            <div className="bg-surface border border-border-default rounded-xl overflow-x-auto">
              <table className="min-w-full divide-y divide-[color:var(--border-default)]">
                <thead className="bg-surface-alt">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Titre</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Équipement</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Équipe</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Localisation</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Statut</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Demandeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-default)]">
                  {results.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-surface-alt transition-colors">
                      <td className="px-3 py-2">
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="text-xs font-medium text-[color:var(--accent)] hover:underline transition-colors tabular-nums"
                        >
                          {ticket.ticketNumber} : {ticket.title}
                        </Link>
                        {ticket.isArchived && (
                          <span className="ml-1.5 text-[10px] text-muted">(archivé)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted">
                        <span className="font-mono text-[10px] text-muted mr-1">{ticket.equipment.refCode}</span>
                        {ticket.equipment.name}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted">{ticket.team.name}</td>
                      <td className="px-3 py-2 text-xs text-muted">{ticket.location?.name || 'Global'}</td>
                      <td className="px-3 py-2">
                        <span
                          className="px-1.5 py-0.5 text-[10px] font-semibold rounded"
                          style={{ color: ticket.status.color || '#2f6f9e', backgroundColor: `${ticket.status.color || '#2f6f9e'}1a` }}
                        >
                          {ticket.status.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted">{ticket.requester.displayName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
