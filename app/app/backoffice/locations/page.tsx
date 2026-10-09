import { getLocations } from '@/lib/actions/locations';
import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { WarningIcon } from '@/components/icons';

export default async function LocationsPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const [locations, criticalCount] = await Promise.all([
    getLocations(),
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
              <Link href="/backoffice" className="text-xs text-muted hover:text-foreground transition-colors duration-150 ease-out">
                ← Retour au backoffice
              </Link>
              <span className="text-border-default">|</span>
              <h1 className="page-toolbar-title">Localisations</h1>
              <span className="page-toolbar-subtitle tabular-nums">{locations.length} site(s)</span>
            </div>
            <Link href="/backoffice/locations/new" className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] transition-colors duration-150 ease-out">
              Ajouter un site
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

        <div className="bg-surface border border-border-default rounded-xl shadow-soft-md overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-default)]">
            <thead className="bg-surface-alt sticky top-0 z-10">
              <tr>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Code</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Nom</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Ville</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Équipements</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Responsables</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Tickets</th>
                <th className="px-3 py-1.5 text-right text-xs font-medium text-muted uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-default)]">
              {locations.map((location) => (
                <tr key={location.id} className="group h-9 hover:bg-surface-alt transition-colors duration-150 ease-out">
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-foreground font-mono tabular-nums">{location.code}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-xs font-medium text-foreground">{location.name}</div>
                    {location.address && <div className="text-[10px] text-muted">{location.address}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted">
                    {location.city || '-'}{location.postalCode && ` (${location.postalCode})`}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted tabular-nums">{location._count.equipments}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {location._count.managers > 0 ? (
                      <span className="text-xs text-muted tabular-nums">{location._count.managers}</span>
                    ) : (
                      <span
                        className="badge badge-warn"
                        title="Aucun responsable : les demandes de ce site sont visibles par tous les managers"
                      >
                        <WarningIcon className="h-3 w-3" /> Aucun
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center justify-center min-w-[26px] h-[22px] px-1.5 rounded-full text-[11.5px] font-bold tabular-nums ${
                        location._count.tickets > 0
                          ? 'bg-[#e8513b]/10 text-[color:var(--accent)]'
                          : 'bg-surface-alt text-muted'
                      }`}
                    >
                      {location._count.tickets}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <Link
                      href={`/backoffice/locations/${location.id}`}
                      className="text-xs font-medium text-[color:var(--accent)] opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 focus-visible:opacity-100 hover:underline"
                    >
                      Modifier
                    </Link>
                  </td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted">
                    Aucun site enregistré pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
