import { getEquipments } from '@/lib/actions/equipments';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';

type SortKey = 'refCode' | 'name' | 'category' | 'location' | 'team' | 'tickets';
type SortDir = 'asc' | 'desc';

const CRITICALITY_BADGE: Record<string, { label: string; cls: string }> = {
  LOW: { label: 'Basse', cls: 'badge badge-neutral' },
  MEDIUM: { label: 'Moyenne', cls: 'badge badge-info' },
  HIGH: { label: 'Haute', cls: 'badge badge-warn' },
  CRITICAL: { label: 'Critique', cls: 'badge badge-danger' },
};

const LIFECYCLE_BADGE: Record<string, { label: string; cls: string }> = {
  IN_SERVICE: { label: 'En service', cls: 'badge badge-success' },
  OUT_OF_SERVICE: { label: 'Hors service', cls: 'badge badge-warn' },
  RETIRED: { label: 'Réformé', cls: 'badge badge-neutral' },
};

function normalizeSortKey(value?: string): SortKey {
  const allowed: SortKey[] = ['refCode', 'name', 'category', 'location', 'team', 'tickets'];
  if (value && allowed.includes(value as SortKey)) return value as SortKey;
  return 'name';
}

function normalizeSortDir(value?: string): SortDir {
  return value === 'desc' ? 'desc' : 'asc';
}

export default async function EquipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const params = await searchParams;
  const query = (params.q || '').trim();
  const normalizedQuery = query.toLowerCase();
  const sortKey = normalizeSortKey(params.sort);
  const sortDir = normalizeSortDir(params.dir);

  const [equipments, criticalCount] = await Promise.all([
    getEquipments(),
    prisma.ticket.count({ where: { priority: 'P1', isArchived: false } }),
  ]);

  const filteredEquipments = normalizedQuery
    ? equipments.filter((equipment) => {
        const haystack = [
          equipment.refCode,
          equipment.name,
          equipment.category.name,
          equipment.location?.name || 'global',
          equipment.team.name,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : equipments;

  const sortedEquipments = [...filteredEquipments].sort((a, b) => {
    const direction = sortDir === 'asc' ? 1 : -1;
    const valueA =
      sortKey === 'refCode'
        ? a.refCode
        : sortKey === 'name'
          ? a.name
          : sortKey === 'category'
            ? a.category.name
            : sortKey === 'location'
              ? a.location?.name || 'Global'
              : sortKey === 'team'
                ? a.team.name
                : a._count.tickets;
    const valueB =
      sortKey === 'refCode'
        ? b.refCode
        : sortKey === 'name'
          ? b.name
          : sortKey === 'category'
            ? b.category.name
            : sortKey === 'location'
              ? b.location?.name || 'Global'
              : sortKey === 'team'
                ? b.team.name
                : b._count.tickets;

    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return (valueA - valueB) * direction;
    }
    return String(valueA).localeCompare(String(valueB), 'fr', { sensitivity: 'base' }) * direction;
  });

  const makeSortHref = (targetKey: SortKey) => {
    const nextDir: SortDir = sortKey === targetKey && sortDir === 'asc' ? 'desc' : 'asc';
    const sp = new URLSearchParams();
    if (query) sp.set('q', query);
    sp.set('sort', targetKey);
    sp.set('dir', nextDir);
    return `?${sp.toString()}`;
  };

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
                <h1 className="page-toolbar-title">Équipements</h1>
                <span className="page-toolbar-subtitle tabular-nums">{sortedEquipments.length} / {equipments.length} équipement(s)</span>
              </div>
              <Link href="/backoffice/equipments/new" className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] transition-colors duration-150 ease-out">
                Ajouter un équipement
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-3 rounded-xl border border-border-default bg-surface p-3">
          <form className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Rechercher par référence, nom, catégorie, localisation, équipe..."
              className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]"
            />
            <div className="flex items-center gap-2">
              <input type="hidden" name="sort" value={sortKey} />
              <input type="hidden" name="dir" value={sortDir} />
              <button
                type="submit"
                className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] transition-colors duration-150 ease-out"
              >
                Rechercher
              </button>
              <Link
                href="/backoffice/equipments"
                className="px-3 py-1.5 text-sm border border-border-default text-muted rounded-lg hover:bg-surface-alt transition-colors duration-150 ease-out"
              >
                Réinitialiser
              </Link>
            </div>
          </form>
        </div>

        <div className="bg-surface border border-border-default rounded-xl shadow-soft-md overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-default)]">
            <thead className="bg-surface-alt sticky top-0 z-10">
              <tr>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">
                  <Link href={makeSortHref('refCode')} className="hover:text-foreground transition-colors duration-150 ease-out">Référence</Link>
                </th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">
                  <Link href={makeSortHref('name')} className="hover:text-foreground transition-colors duration-150 ease-out">Nom</Link>
                </th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">
                  <Link href={makeSortHref('category')} className="hover:text-foreground transition-colors duration-150 ease-out">Catégorie</Link>
                </th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">
                  <Link href={makeSortHref('location')} className="hover:text-foreground transition-colors duration-150 ease-out">Localisation</Link>
                </th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">
                  <Link href={makeSortHref('team')} className="hover:text-foreground transition-colors duration-150 ease-out">Équipe</Link>
                </th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Criticité</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">État</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">
                  <Link href={makeSortHref('tickets')} className="hover:text-foreground transition-colors duration-150 ease-out">Tickets</Link>
                </th>
                <th className="px-3 py-1.5 text-right text-xs font-medium text-muted uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-default)]">
              {sortedEquipments.map((equipment) => (
                <tr key={equipment.id} className="group h-9 hover:bg-surface-alt transition-colors duration-150 ease-out">
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-foreground font-mono tabular-nums">{equipment.refCode}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-foreground">{equipment.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted">{equipment.category.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted">{equipment.location?.name || 'Global'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted">{equipment.team.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {(() => { const c = CRITICALITY_BADGE[equipment.criticality] ?? CRITICALITY_BADGE.MEDIUM; return <span className={c.cls}>{c.label}</span>; })()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {(() => { const l = LIFECYCLE_BADGE[equipment.lifecycleStatus] ?? LIFECYCLE_BADGE.IN_SERVICE; return <span className={l.cls}>{l.label}</span>; })()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center justify-center min-w-[26px] h-[22px] px-1.5 rounded-full text-[11.5px] font-bold tabular-nums ${
                        equipment._count.tickets > 0
                          ? 'bg-[#e8513b]/10 text-[color:var(--accent)]'
                          : 'bg-surface-alt text-muted'
                      }`}
                    >
                      {equipment._count.tickets}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <Link
                      href={`/backoffice/equipments/${equipment.id}`}
                      className="text-xs font-medium text-[color:var(--accent)] opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 focus-visible:opacity-100 hover:underline"
                    >
                      Modifier
                    </Link>
                  </td>
                </tr>
              ))}
              {sortedEquipments.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sm text-muted">
                    Aucun équipement ne correspond à la recherche.
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
