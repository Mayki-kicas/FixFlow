import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { getLocationsWithPlans } from '@/lib/actions/floor-plans';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';

export default async function PlansIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');

  const isManager = user.role === 'ADMIN' || user.role === 'MANAGER';

  const [locations, criticalCount] = await Promise.all([
    isManager
      ? prisma.location.findMany({
          select: { id: true, code: true, name: true, city: true, _count: { select: { floorPlans: true } } },
          orderBy: { name: 'asc' },
        })
      : getLocationsWithPlans(),
    getVisibleCriticalTicketsCountForUser(user),
  ]);

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <h1 className="page-toolbar-title">Plans des centres</h1>
                <span className="page-toolbar-subtitle tabular-nums">{locations.length} centre(s)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {locations.length === 0 ? (
            <div className="card p-8 text-center text-sm text-muted">
              Aucun plan pour le moment.
              {isManager && ' Ouvrez un centre pour y ajouter un premier plan d’étage.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
              {locations.map((loc) => (
                <Link
                  key={loc.id}
                  href={`/plans/${loc.id}`}
                  className="group block rounded-xl border border-border-default bg-surface-alt p-3 transition-all duration-150 ease-out hover:border-[color:var(--accent)] hover:shadow-soft-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-[color:var(--accent)]">
                      {loc.name}
                    </h3>
                    <span className="badge badge-neutral">{loc._count.floorPlans} étage(s)</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    <span className="font-mono">{loc.code}</span>
                    {loc.city && ` · ${loc.city}`}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
