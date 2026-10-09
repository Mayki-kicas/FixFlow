import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { getMyDemandes } from '@/lib/actions/demandes';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'En attente', color: '#f59e0b' },
  CONVERTED: { label: 'Validée', color: '#10b981' },
  REJECTED: { label: 'Rejetée', color: '#dc2626' },
};

export default async function MyDemandesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');

  const [criticalCount, demandes] = await Promise.all([
    getVisibleCriticalTicketsCountForUser(user),
    getMyDemandes(),
  ]);

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <h1 className="page-toolbar-title">Mes demandes</h1>
              <Link
                href="/demandes/new"
                className="px-3 py-1.5 bg-[color:var(--primary)] text-[color:var(--surface)] text-sm font-medium rounded-lg transition-colors hover:bg-[color:var(--primary-hover)]"
              >
                + Nouvelle demande
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {demandes.length === 0 ? (
            <div className="text-center py-10 bg-surface rounded-xl border border-border-default">
              <p className="text-sm font-medium text-foreground">Aucune demande</p>
              <p className="text-xs text-muted mt-1">Déclare un incident pour créer ta première demande.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {demandes.map((d) => {
                const meta = STATUS_META[d.status] || STATUS_META.PENDING;
                return (
                  <li key={d.id} className="rounded-xl border border-border-default bg-surface shadow-soft-md p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide"
                        style={{ color: meta.color, backgroundColor: meta.color + '1a' }}
                      >
                        {meta.label}
                      </span>
                      <Link href={`/demandes/${d.id}`} className="text-sm font-semibold text-foreground truncate hover:text-[color:var(--accent)]">{d.title}</Link>
                      {d.status === 'CONVERTED' && d.ticket && (
                        <Link href={`/tickets/${d.ticket.id}`} className="ml-auto text-[11px] font-semibold text-[color:var(--accent)] hover:opacity-80">
                          Ticket #{d.ticket.ticketNumber} →
                        </Link>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      Déposée le {d.createdAt.toLocaleDateString('fr-FR')}
                      {d.decidedAt ? ` · traitée le ${d.decidedAt.toLocaleDateString('fr-FR')}` : ''}
                    </div>
                    {d.status === 'REJECTED' && d.rejectionReason && (
                      <div className="mt-1 text-[11px] text-foreground">Motif : {d.rejectionReason}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
