import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { getPendingDemandes } from '@/lib/actions/demandes';
import { canReviewDemande } from '@/lib/access-policy';
import { PRIORITY_META } from '@/lib/priority';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';

export default async function DemandesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!canReviewDemande(user.role)) redirect('/');

  const [criticalCount, demandes] = await Promise.all([
    getVisibleCriticalTicketsCountForUser(user),
    getPendingDemandes(),
  ]);

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <h1 className="page-toolbar-title">Demandes à valider</h1>
              <span className="page-toolbar-subtitle tabular-nums">{demandes.length} en attente</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {demandes.length === 0 ? (
            <div className="text-center py-10 bg-surface rounded-xl border border-border-default">
              <p className="text-sm font-medium text-foreground">Aucune demande en attente</p>
              <p className="text-xs text-muted mt-1">Les nouvelles déclarations d&apos;incident apparaîtront ici.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {demandes.map((d) => (
                <li key={d.id} className="rounded-xl border border-border-default bg-surface shadow-soft-md p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground">{d.title}</h3>
                      <p className="mt-1 text-xs text-muted line-clamp-2">{d.description}</p>
                    </div>
                    {d.suggestedPriority && (
                      <span
                        className="flex-shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide"
                        style={{ color: PRIORITY_META[d.suggestedPriority].color, backgroundColor: PRIORITY_META[d.suggestedPriority].color + '1a' }}
                        title={`Priorité suggérée : ${PRIORITY_META[d.suggestedPriority].label}`}
                      >
                        {PRIORITY_META[d.suggestedPriority].short} suggérée
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                    <span>Par {d.requester.displayName}</span>
                    {d.equipment && <span>· {d.equipment.name} ({d.equipment.refCode})</span>}
                    <span>· {d.location?.name || 'Global'}</span>
                    {d._count.attachments > 0 && <span>· {d._count.attachments} pièce(s) jointe(s)</span>}
                    <span>· {d.createdAt.toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="mt-3">
                    <Link
                      href={`/demandes/${d.id}`}
                      className="inline-flex rounded bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)]"
                    >
                      Traiter la demande →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
