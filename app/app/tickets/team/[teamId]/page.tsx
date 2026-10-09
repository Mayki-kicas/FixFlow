import { getTickets } from '@/lib/actions/tickets';
import { getTeamsForSelector, getTeamWithTicketsForKanban } from '@/lib/actions/teams';
import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { canDeclareTicket } from '@/lib/access-policy';
import { PRIORITY_META, PRIORITIES, isQuoteOverdue } from '@/lib/priority';
import type { Priority } from '@prisma/client';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import Header from '@/components/Header';
import { WarningIcon } from '@/components/icons';
import TeamSelector from '@/components/TeamSelector';
import TicketKanban from '@/components/TicketKanban';
import TicketArchiveButton from '@/components/TicketArchiveButton';

export default async function TeamTicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const { teamId } = await params;
  const queryParams = await searchParams;
  const viewMode = queryParams.view || 'kanban';
  const sort = queryParams.sort || 'priority'; // défaut liste : priorité (P1 d'abord)
  const priorityFilter = (['P1', 'P2', 'P3'] as const).includes(queryParams.priority as Priority)
    ? (queryParams.priority as Priority)
    : undefined;
  const overdueOnly = queryParams.overdue === '1';
  const listSortBy =
    sort === 'number_asc' || sort === 'number_desc'
      ? ('ticketNumber' as const)
      : sort === 'deadline'
        ? ('quoteDeadline' as const)
        : ('priority' as const);

  const createQueryString = (overrides: Record<string, string>) => {
    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries({ ...queryParams, ...overrides })) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }
    return new URLSearchParams(filtered).toString();
  };

  const [teams, criticalCount, teamWithTickets] = await Promise.all([
    getTeamsForSelector(),
    getVisibleCriticalTicketsCountForUser(user),
    getTeamWithTicketsForKanban(teamId),
  ]);

  if (!teamWithTickets) {
    notFound();
  }

  const tickets = viewMode === 'list'
    ? await getTickets({
        teamId,
        statusId: queryParams.status,
        priority: priorityFilter,
        overdueOnly,
        isArchived: queryParams.archived === 'true',
        sortBy: listSortBy,
        sortOrder: sort === 'number_asc' ? 'asc' : 'desc',
      })
    : [];

  const chipCls = (active: boolean) =>
    `px-2 py-0.5 text-xs rounded transition-colors ${active ? 'bg-surface-alt text-foreground' : 'text-muted hover:text-foreground'}`;

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        {/* Barre d'outils */}
        <div className="page-toolbar">
          <div className="page-toolbar-inner max-w-full">
            <div className="page-toolbar-row">
              {/* Breadcrumb + Titre */}
              <div className="flex items-center gap-3">
                <Link
                  href="/tickets"
                  className="text-xs text-muted transition-colors hover:opacity-80"
                >
                  ← Équipes
                </Link>
                <span className="text-muted">|</span>
                <h1 className="page-toolbar-title">
                  {teamWithTickets.name}
                </h1>
                <span className="page-toolbar-subtitle tabular-nums">
                  {viewMode === 'kanban'
                    ? `${teamWithTickets.tickets.length} ticket(s)`
                    : `${tickets.length} ticket(s)`}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {viewMode === 'list' && (
                  <>
                    {/* Filtre priorité */}
                    <div className="flex items-center gap-1 rounded-lg border border-border-default bg-surface px-1 py-1">
                      <span className="px-1.5 text-[10px] uppercase tracking-wide text-muted">Priorité</span>
                      <Link href={`?${createQueryString({ priority: '' })}`} className={chipCls(!priorityFilter)}>Toutes</Link>
                      {PRIORITIES.map((p) => (
                        <Link
                          key={p}
                          href={`?${createQueryString({ priority: p })}`}
                          className={chipCls(priorityFilter === p)}
                          style={priorityFilter === p ? { color: PRIORITY_META[p].color } : undefined}
                        >
                          {p}
                        </Link>
                      ))}
                    </div>

                    {/* Devis en retard (SLA dépassé, pas encore de devis reçu) */}
                    <Link
                      href={`?${createQueryString({ overdue: overdueOnly ? '' : '1' })}`}
                      className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                        overdueOnly
                          ? 'border-[#dc2626] bg-[#dc2626] text-white'
                          : 'border-border-default text-muted hover:text-foreground'
                      }`}
                    >
                      Devis en retard
                    </Link>

                    {/* Tri */}
                    <div className="flex items-center gap-1 rounded-lg border border-border-default bg-surface px-1 py-1">
                      <span className="px-1.5 text-[10px] uppercase tracking-wide text-muted">Tri</span>
                      <Link href={`?${createQueryString({ sort: 'priority' })}`} className={chipCls(sort === 'priority')}>Priorité</Link>
                      <Link href={`?${createQueryString({ sort: 'deadline' })}`} className={chipCls(sort === 'deadline')}>Échéance</Link>
                      <Link href={`?${createQueryString({ sort: 'number_desc' })}`} className={chipCls(sort === 'number_desc')}>N° ↓</Link>
                      <Link href={`?${createQueryString({ sort: 'number_asc' })}`} className={chipCls(sort === 'number_asc')}>N° ↑</Link>
                    </div>
                  </>
                )}

                {/* Toggle vue */}
                <div className="flex bg-surface-alt rounded-lg p-0.5">
                  <Link
                    href={`?${createQueryString({ view: 'kanban' })}`}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      viewMode === 'kanban'
                        ? 'bg-surface text-foreground shadow-soft-md'
                        : 'text-muted hover:text-foreground'
                    }`}
                  >
                    Kanban
                  </Link>
                  <Link
                    href={`?${createQueryString({ view: 'list' })}`}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      viewMode === 'list'
                        ? 'bg-surface text-foreground shadow-soft-md'
                        : 'text-muted hover:text-foreground'
                    }`}
                  >
                    Liste
                  </Link>
                </div>

                {canDeclareTicket(user.role) && (
                  <Link
                    href={`/tickets/new?team=${teamId}`}
                    className="px-3 py-1.5 bg-[color:var(--primary)] text-[color:var(--surface)] text-sm font-medium rounded-lg hover:bg-[color:var(--primary-hover)] transition-colors"
                  >
                    + Nouveau ticket
                  </Link>
                )}
              </div>
            </div>

            {/* Sélecteur d'équipe */}
            <div className="pb-3">
              <TeamSelector teams={teams} selectedTeamId={teamId} baseUrl="/tickets/team" />
            </div>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {viewMode === 'kanban' ? (
            <TicketKanban
              statuses={teamWithTickets.statuses}
              tickets={teamWithTickets.tickets}
              canArchive={user.role === 'ADMIN' || user.role === 'MANAGER'}
            />
          ) : (
            <div className="bg-surface rounded-xl border border-border-default overflow-hidden">
              {tickets.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-alt text-muted">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 17v-6h13M9 5h13M5 20h14a2 2 0 002-2V8l-5-5H5a2 2 0 00-2 2v13a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Aucun ticket ne correspond aux filtres actuels.
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Essaie un autre tri, enlève les filtres, ou crée une nouvelle demande.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border-default">
                  <thead className="sticky top-0 bg-surface-alt">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">
                        Ticket
                      </th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">
                        Équipement
                      </th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">
                        Localisation
                      </th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">
                        Statut
                      </th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">
                        Date
                      </th>
                      {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
                        <th className="px-3 py-1.5 text-right text-xs font-medium text-muted uppercase tracking-wide">
                          Action
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {tickets.map((ticket) => (
                      <tr key={ticket.id} className="transition-colors hover:bg-surface-alt">
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="inline-flex flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-extrabold uppercase tracking-wide"
                              style={{
                                color: PRIORITY_META[ticket.priority].color,
                                backgroundColor: PRIORITY_META[ticket.priority].color + '1a',
                              }}
                              title={`Priorité : ${PRIORITY_META[ticket.priority].label}`}
                            >
                              {PRIORITY_META[ticket.priority].short}
                            </span>
                            <Link
                              href={`/tickets/${ticket.id}`}
                              className="text-sm font-medium text-[color:var(--accent)] transition-colors hover:opacity-80 tabular-nums"
                            >
                              {ticket.ticketNumber} : {ticket.title}
                            </Link>
                            {!ticket.isArchived && isQuoteOverdue(ticket.quoteDeadline) && (
                              <span className="badge badge-danger flex-shrink-0" title="Échéance devis dépassée">
                                <WarningIcon className="h-3 w-3" /> Retard
                              </span>
                            )}
                          </span>
                          <div className="text-[10px] text-muted mt-0.5 flex items-center gap-2 tabular-nums">
                            {ticket._count.chatMessages > 0 && (
                              <span className="flex items-center gap-0.5">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                {ticket._count.chatMessages}
                              </span>
                            )}
                            {ticket._count.attachments > 0 && (
                              <span className="flex items-center gap-0.5">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                {ticket._count.attachments}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-foreground">
                          {ticket.equipment.name}
                          <div className="text-[10px] text-muted font-mono">
                            {ticket.equipment.refCode}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted">
                          {ticket.location?.name || 'Global'}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded"
                            style={{
                              backgroundColor: ticket.status.color || '#e2e8f0',
                              color: '#1e293b',
                            }}
                          >
                            {ticket.status.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted tabular-nums">
                          {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
                          <td className="px-3 py-2 text-right">
                            <TicketArchiveButton
                              ticketId={ticket.id}
                              isArchived={ticket.isArchived}
                              variant="compact"
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
