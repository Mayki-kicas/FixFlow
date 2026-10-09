import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { getMaintenancePlans } from '@/lib/actions/maintenance';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import MaintenancePlanManager from '@/components/MaintenancePlanManager';

export default async function PreventifPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const [plans, equipments, teams, maintainers, meters, criticalCount] = await Promise.all([
    getMaintenancePlans(),
    prisma.equipment.findMany({
      where: { lifecycleStatus: { not: 'RETIRED' } },
      select: { id: true, name: true, refCode: true },
      orderBy: { name: 'asc' },
    }),
    prisma.team.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.maintainer.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.meter.findMany({ select: { id: true, name: true, unit: true, equipmentId: true }, orderBy: { name: 'asc' } }),
    getVisibleCriticalTicketsCountForUser(user),
  ]);

  const overdue = plans.filter((p) => p.active && p.nextDueAt != null && new Date(p.nextDueAt).getTime() < Date.now()).length;

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
                <h1 className="page-toolbar-title">Maintenance préventive</h1>
                <span className="page-toolbar-subtitle tabular-nums">
                  {plans.length} plan(s){overdue > 0 ? ` · ${overdue} en retard` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="mb-3 text-xs text-muted">
            Les plans génèrent automatiquement un ordre de travail à chaque échéance (via la tâche quotidienne).
            Un plan réglementaire alerte aussi à l&apos;approche de l&apos;expiration des certificats.
          </p>
          <MaintenancePlanManager plans={plans} equipments={equipments} teams={teams} maintainers={maintainers} meters={meters} />
        </div>
      </div>
    </>
  );
}
