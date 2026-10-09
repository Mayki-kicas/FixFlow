import { getLocationById, getAssignableManagers } from '@/lib/actions/locations';
import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import LocationForm from '@/components/LocationForm';
import LocationManagersManager from '@/components/LocationManagersManager';
import Header from '@/components/Header';
import { WarningIcon } from '@/components/icons';

export default async function EditLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const { id } = await params;
  const [location, criticalCount, assignableManagers] = await Promise.all([
    getLocationById(id),
    getVisibleCriticalTicketsCountForUser(user),
    user.role === 'ADMIN' ? getAssignableManagers() : Promise.resolve([]),
  ]);

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
      <div className="page-toolbar">
        <div className="page-toolbar-inner">
          <div className="page-toolbar-row">
            <div className="flex items-center gap-3">
              <Link href="/backoffice/locations" className="text-xs text-muted hover:text-foreground transition-colors duration-150 ease-out">
                ← Retour aux localisations
              </Link>
              <span className="text-border-default">|</span>
              <h1 className="page-toolbar-title">Modifier le site</h1>
              <span className="page-toolbar-subtitle">{location.name}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

        <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 mb-4 backdrop-blur">
          <LocationForm location={location} />
        </div>

        {/* Responsables du site (valideurs des demandes) — ADMIN only */}
        {user.role === 'ADMIN' && (
          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 mb-4 backdrop-blur">
            <div className="section-band">
              <h2 className="section-band-title">Responsables du site</h2>
            </div>
            {location.managers.length === 0 && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-3 py-2 text-[11px] text-[#b45309] dark:text-[#f59e0b]">
                <WarningIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  Aucun responsable défini : les demandes de ce site sont visibles par <strong>tous les managers</strong>. Désignez au moins un responsable pour cadrer la validation.
                </span>
              </div>
            )}
            <LocationManagersManager
              locationId={location.id}
              allManagers={assignableManagers}
              currentManagerIds={location.managers.map((m) => m.id)}
            />
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-3 backdrop-blur">
            <h3 className="text-xs font-medium text-muted mb-1">Équipements</h3>
            <p className="text-xl font-bold text-foreground tabular-nums">{location.equipments.length}</p>
          </div>
          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-3 backdrop-blur">
            <h3 className="text-xs font-medium text-muted mb-1">Tickets récents</h3>
            <p className="text-xl font-bold text-foreground tabular-nums">{location.tickets.length}</p>
          </div>
        </div>

        {/* Équipements liés */}
        {location.equipments.length > 0 && (
          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
            <div className="section-band">
              <h2 className="section-band-title">Équipements sur ce site</h2>
            </div>
            <div className="space-y-1.5">
              {location.equipments.map((equipment) => (
                <div key={equipment.id} className="flex justify-between items-center p-2 bg-surface-alt rounded-lg">
                  <div>
                    <div className="text-xs font-medium text-foreground">{equipment.name}</div>
                    <div className="text-[10px] text-muted tabular-nums">{equipment.refCode} - {equipment.category.name}</div>
                  </div>
                  <div className="text-xs text-muted">{equipment.team.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
