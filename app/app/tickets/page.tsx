import { getTeamsForSelector } from '@/lib/actions/teams';
import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { ticketVisibilityWhere } from '@/lib/visibility';
import { canDeclareTicket } from '@/lib/access-policy';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';

export default async function TicketsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const [teams, criticalCount, criticalByTeam, overdueByTeam] = await Promise.all([
    getTeamsForSelector(),
    getVisibleCriticalTicketsCountForUser(user),
    // Tickets critiques ouverts par équipe, restreints à la visibilité de l'utilisateur.
    prisma.ticket.groupBy({
      by: ['teamId'],
      where: {
        priority: 'P1',
        isArchived: false,
        status: { isFinal: false },
        ...ticketVisibilityWhere(user),
      },
      _count: { _all: true },
    }),
    // Tickets en dépassement SLA (échéance devis passée, aucun devis reçu) par équipe.
    prisma.ticket.groupBy({
      by: ['teamId'],
      where: {
        isArchived: false,
        status: { isFinal: false },
        quoteDeadline: { not: null, lt: new Date() },
        quotes: { none: { status: { in: ['RECEIVED', 'ACCEPTED'] } } },
        ...ticketVisibilityWhere(user),
      },
      _count: { _all: true },
    }),
  ]);

  const criticalByTeamId = new Map(
    criticalByTeam.map((row) => [row.teamId, row._count._all]),
  );
  const overdueByTeamId = new Map(
    overdueByTeam.map((row) => [row.teamId, row._count._all]),
  );
  const totalActiveTickets = teams.reduce((sum, team) => sum + team._count.tickets, 0);

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        {/* Barre d'outils */}
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <h1 className="page-toolbar-title">Équipes de maintenance</h1>
                <span className="page-toolbar-subtitle tabular-nums">
                  {totalActiveTickets} ticket(s) actif(s) au total
                </span>
              </div>
              {canDeclareTicket(user.role) && (
                <Link
                  href="/tickets/new"
                  className="px-3 py-1.5 bg-[color:var(--primary)] text-[color:var(--surface)] text-sm font-medium rounded-lg transition-colors hover:bg-[color:var(--primary-hover)]"
                >
                  + Nouveau ticket
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Liste des équipes */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {teams.length === 0 ? (
            <div className="text-center py-8 bg-surface rounded-xl border border-border-default">
              <svg className="w-10 h-10 mx-auto text-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17l-5.384-3.077A2 2 0 015 10.268V5a2 2 0 012-2h10a2 2 0 012 2v5.268a2 2 0 01-1.036 1.825l-5.384 3.077a2 2 0 01-1.16 0z" /></svg>
              <h3 className="text-sm font-medium text-foreground mb-1">Aucune équipe</h3>
              <p className="text-xs text-muted">
                Aucune équipe de maintenance n&apos;a été créée.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => {
                const activeCount = team._count.tickets;
                const critCount = criticalByTeamId.get(team.id) ?? 0;
                const overdueCount = overdueByTeamId.get(team.id) ?? 0;
                return (
                  <Link
                    key={team.id}
                    href={`/tickets/team/${team.id}`}
                    className="group card block p-5 transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-soft-xl hover:border-[color:var(--accent)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-[15px] font-bold tracking-tight text-foreground">
                        {team.name}
                      </h3>
                      <div className="flex flex-shrink-0 items-center gap-1.5">
                        {overdueCount > 0 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-[#dc2626]/10 px-2 py-0.5 text-[10.5px] font-bold text-[#dc2626] tabular-nums"
                            title="Devis en retard (SLA dépassé)"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-[#dc2626]" />
                            {overdueCount} retard
                          </span>
                        )}
                        {critCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#e8513b]/10 px-2 py-0.5 text-[10.5px] font-bold text-[color:var(--accent)] tabular-nums">
                            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
                            {critCount} crit.
                          </span>
                        )}
                      </div>
                    </div>
                    <p
                      className={`mt-3 text-4xl font-extrabold tracking-tight tabular-nums ${
                        critCount > 0 ? 'text-[color:var(--accent)]' : 'text-foreground'
                      }`}
                    >
                      {activeCount}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {activeCount <= 1 ? 'ticket actif' : 'tickets actifs'}
                    </p>
                    <p className="mt-3 text-[12.5px] font-semibold text-[color:var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
                      Voir les tickets →
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
