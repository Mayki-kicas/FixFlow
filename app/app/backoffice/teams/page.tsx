import { getTeams } from '@/lib/actions/teams';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';

export default async function TeamsPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const [teams, criticalCount] = await Promise.all([
    getTeams(),
    prisma.ticket.count({ where: { priority: 'P1', isArchived: false } }),
  ]);

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
                <h1 className="page-toolbar-title">Équipes</h1>
                <span className="page-toolbar-subtitle tabular-nums">{teams.length} équipe(s) de maintenance</span>
              </div>
              <Link href="/backoffice/teams/new" className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] transition-colors duration-150 ease-out">
                Créer une équipe
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/backoffice/teams/${team.id}`}
              className="card block p-4 hover:border-[color:var(--accent)] hover:shadow-soft-lg transition-all duration-150 ease-out"
            >
              <h3 className="text-sm font-semibold text-foreground mb-1">{team.name}</h3>
              {team.description && <p className="text-xs text-muted mb-3">{team.description}</p>}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-[#2f6f9e] tabular-nums">{team._count.equipments}</div>
                  <div className="text-[10px] text-muted">Équipements</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-[#10b981] tabular-nums">{team._count.tickets}</div>
                  <div className="text-[10px] text-muted">Tickets</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-[#a78bfa] tabular-nums">{team._count.statuses}</div>
                  <div className="text-[10px] text-muted">Statuts</div>
                </div>
              </div>
            </Link>
          ))}
          </div>
        </div>
      </div>
    </>
  );
}
