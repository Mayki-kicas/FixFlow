import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getTeamById, getGroupsForTeamLinking } from '@/lib/actions/teams';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import TeamForm from '@/components/TeamForm';
import TeamStatusManager from '@/components/TeamStatusManager';
import TeamGroupLinker from '@/components/TeamGroupLinker';

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const { id } = await params;

  let team;
  try {
    team = await getTeamById(id);
  } catch {
    notFound();
  }

  const criticalCount = await prisma.ticket.count({ where: { priority: 'P1', isArchived: false } });
  const groupsData = await getGroupsForTeamLinking(id);

  const statusesWithCount = await prisma.ticketStatus.findMany({
    where: { teamId: id },
    include: { _count: { select: { tickets: true } } },
    orderBy: { order: 'asc' },
  });

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <Link href="/backoffice/teams" className="text-xs text-muted hover:text-foreground transition-colors duration-150 ease-out">
                  ← Retour aux équipes
                </Link>
                <span className="text-border-default">|</span>
                <h1 className="page-toolbar-title">Modifier l&apos;équipe</h1>
                <span className="page-toolbar-subtitle tabular-nums">
                  {team.equipments.length} équipement(s) · {team.tickets.length} ticket(s)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid gap-4">
          {/* Formulaire équipe */}
          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
            <TeamForm team={team} />
          </div>

          {/* Gestion des statuts */}
          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
            <TeamStatusManager teamId={team.id} statuses={statusesWithCount} />
          </div>

          {/* Groupes abonnés automatiquement */}
          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
            <div className="section-band">
              <h3 className="section-band-title">Groupes abonnés automatiquement</h3>
            </div>
            <p className="text-xs text-muted mb-3">
              Les membres de ces groupes seront automatiquement abonnés aux nouveaux tickets de cette équipe.
            </p>
            <TeamGroupLinker
              teamId={team.id}
              linkedGroups={team.groups.map((gt: any) => gt.group)}
              availableGroups={groupsData.all.filter((g: any) => !groupsData.linkedIds.includes(g.id))}
            />
          </div>

          {/* Liste des équipements */}
          {team.equipments.length > 0 && (
            <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
              <div className="section-band">
                <h3 className="section-band-title">Équipements de l&apos;équipe</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[color:var(--border-default)]">
                  <thead className="bg-surface-alt sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Réf</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Nom</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Catégorie</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Localisation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-default)]">
                    {team.equipments.map((equipment) => (
                      <tr key={equipment.id} className="h-9 hover:bg-surface-alt transition-colors duration-150 ease-out">
                        <td className="px-3 py-1.5 text-xs font-medium text-foreground font-mono tabular-nums">{equipment.refCode}</td>
                        <td className="px-3 py-1.5 text-xs text-foreground">{equipment.name}</td>
                        <td className="px-3 py-1.5 text-xs text-muted">{equipment.category.name}</td>
                        <td className="px-3 py-1.5 text-xs text-muted">{equipment.location?.name || 'Global'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Derniers tickets */}
          {team.tickets.length > 0 && (
            <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
              <div className="section-band">
                <h3 className="section-band-title">Derniers tickets</h3>
              </div>
              <div className="space-y-1.5">
                {team.tickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                    className="block p-2 border border-border-default rounded-lg hover:bg-surface-alt transition-colors duration-150 ease-out"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-medium text-foreground">{ticket.title}</p>
                        <p className="text-[10px] text-muted">
                          {ticket.equipment.name} - {ticket.requester.displayName}
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
