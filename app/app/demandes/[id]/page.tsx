import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { getDemandeById } from '@/lib/actions/demandes';
import { isDemandeReviewer } from '@/lib/demande-review';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import DemandeDecision from '@/components/DemandeDecision';
import { PaperclipIcon } from '@/components/icons';

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'En attente', color: '#f59e0b' },
  CONVERTED: { label: 'Validée', color: '#10b981' },
  REJECTED: { label: 'Rejetée', color: '#dc2626' },
};

export default async function DemandeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');

  const { id } = await params;
  const demande = await getDemandeById(id);
  if (!demande) notFound();

  const isReviewer = isDemandeReviewer(user.role);
  const canDecide = demande.canReview && demande.status === 'PENDING';

  const [criticalCount, equipments] = await Promise.all([
    getVisibleCriticalTicketsCountForUser(user),
    canDecide
      ? prisma.equipment.findMany({
          where: { lifecycleStatus: { not: 'RETIRED' } },
          select: { id: true, name: true, refCode: true, team: { select: { name: true } } },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  const meta = STATUS_META[demande.status] || STATUS_META.PENDING;

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <Link href={isReviewer ? '/demandes' : '/demandes/mine'} className="text-xs text-muted hover:opacity-80">
                  ← Demandes
                </Link>
                <span className="text-muted">|</span>
                <h1 className="page-toolbar-title truncate">{demande.title}</h1>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
                  style={{ color: meta.color, backgroundColor: meta.color + '1a' }}
                >
                  {meta.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          <div className="rounded-xl border border-border-default bg-surface shadow-soft-md p-4">
            <p className="whitespace-pre-wrap text-sm text-foreground">{demande.description}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
              <span>Par {demande.requester.displayName}</span>
              <span>· {demande.location?.name || 'Localisation non précisée'}</span>
              <span>· Déposée le {demande.createdAt.toLocaleDateString('fr-FR')}</span>
              {demande.decidedBy && demande.decidedAt && (
                <span>· Traitée par {demande.decidedBy.displayName} le {demande.decidedAt.toLocaleDateString('fr-FR')}</span>
              )}
            </div>
          </div>

          {demande.attachments.length > 0 && (
            <div className="rounded-xl border border-border-default bg-surface shadow-soft-md p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted mb-2">Pièces jointes ({demande.attachments.length})</p>
              <div className="flex flex-wrap gap-3">
                {demande.attachments.map((att) => (
                  <a key={att.id} href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer" className="block">
                    {att.type === 'PHOTO' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/attachments/${att.id}`} alt={att.fileName || 'photo'} className="h-24 w-24 rounded-lg border border-border-default object-cover" />
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-alt px-2 py-1 text-xs text-foreground">
                        <PaperclipIcon className="h-3.5 w-3.5 text-muted" /> {att.fileName || 'fichier'}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {demande.status === 'CONVERTED' && demande.ticket && (
            <div className="rounded-xl border border-emerald-600/40 bg-emerald-600/5 p-4 text-sm">
              Validée → <Link href={`/tickets/${demande.ticket.id}`} className="font-semibold text-[color:var(--accent)] hover:opacity-80">ticket #{demande.ticket.ticketNumber}</Link>
            </div>
          )}
          {demande.status === 'REJECTED' && demande.rejectionReason && (
            <div className="rounded-xl border border-[#dc2626]/40 bg-[#dc2626]/5 p-4 text-sm text-foreground">
              <span className="font-semibold">Rejetée.</span> Motif : {demande.rejectionReason}
            </div>
          )}

          {canDecide && (
            <div className="rounded-xl border border-border-default bg-surface shadow-soft-md p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted mb-2">Décision</p>
              <DemandeDecision demandeId={demande.id} equipments={equipments.map((e) => ({ id: e.id, name: e.name, refCode: e.refCode, teamName: e.team.name }))} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
