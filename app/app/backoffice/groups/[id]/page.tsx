import { getGroupById, getAvailableUsersForGroup } from '@/lib/actions/groups';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import GroupMemberManager from '@/components/GroupMemberManager';

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const { id } = await params;

  const [group, availableUsers, criticalCount] = await Promise.all([
    getGroupById(id),
    getAvailableUsersForGroup(id),
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
                <Link href="/backoffice/groups" className="text-xs text-muted hover:text-foreground transition-colors duration-150 ease-out">
                  ← Retour aux groupes
                </Link>
                <span className="text-border-default">|</span>
                <h1 className="page-toolbar-title">{group.name}</h1>
                <span className="page-toolbar-subtitle tabular-nums">{group.members.length} membre(s)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {group.description && (
            <p className="text-xs text-muted mb-3">{group.description}</p>
          )}

        <GroupMemberManager
          groupId={group.id}
          members={group.members}
          availableUsers={availableUsers}
        />

        {/* Équipes liées */}
        {group.teams && group.teams.length > 0 && (
          <div className="mt-4 bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
            <div className="section-band">
              <h2 className="section-band-title">Équipes liées</h2>
            </div>
            <p className="text-xs text-muted mb-3">
              Les membres de ce groupe sont automatiquement abonnés aux tickets de ces équipes.
            </p>
            <ul className="space-y-1">
              {group.teams.map((gt: any) => (
                <li key={gt.team.id} className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-foreground">{gt.team.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
