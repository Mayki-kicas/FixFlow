import { getTicketById, getAvailableUsersForTicketSubscription } from '@/lib/actions/tickets';
import { getQuotesForTicket } from '@/lib/actions/quotes';
import { getGroupsForTicketSubscription } from '@/lib/actions/groups';
import QuoteDecisionButtons from '@/components/QuoteDecisionButtons';
import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import EquipmentPhotoPreview from '@/components/EquipmentPhotoPreview';
import ChatSection from '@/components/ChatSection';
import TicketStatusSelector from '@/components/TicketStatusSelector';
import TicketDetailPopins from '@/components/TicketDetailPopins';
import Header from '@/components/Header';
import TicketPDFButton from '@/components/TicketPDFButton';
import TicketSelfSubscriptionButton from '@/components/TicketSelfSubscriptionButton';
import TicketArchiveButton from '@/components/TicketArchiveButton';
import TicketPrioritySelector from '@/components/TicketPrioritySelector';
import TicketReassignControl from '@/components/TicketReassignControl';
import TicketTaskList from '@/components/TicketTaskList';
import TicketCostsPanel from '@/components/TicketCostsPanel';
import TicketPartConsumption from '@/components/TicketPartConsumption';
import TicketDiagnosis from '@/components/TicketDiagnosis';
import SignaturePad from '@/components/SignaturePad';
import Tabs from '@/components/Tabs';
import TicketAssigneeControl from '@/components/TicketAssigneeControl';
import { getAssignableTechnicians } from '@/lib/actions/technicians';
import { getPartsForConsumption } from '@/lib/actions/parts';
import { getFailureCodes } from '@/lib/actions/failure-codes';
import { getAppConfig } from '@/lib/app-config';
import { CheckIcon, WarningIcon, ClockIcon } from '@/components/icons';
import { PRIORITY_META, isQuoteOverdue } from '@/lib/priority';
import { isFirstResponseOverdue, isResolutionOverdue } from '@/lib/sla';
import { prisma } from '@/lib/prisma';

const NATURE_META: Record<string, { label: string; color: string }> = {
  CORRECTIVE: { label: 'Corrective', color: '#e8513b' },
  IMPROVEMENT: { label: 'Améliorative', color: '#2f6f9e' },
  PREVENTIVE: { label: 'Préventive', color: '#10b981' },
};

function InfoIcon({ children }: { children: any }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-surface-alt text-muted">
      {children}
    </span>
  );
}

const QUOTE_STATUS_META: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: 'Demandé', color: '#2f6f9e' },
  RECEIVED: { label: 'Reçu', color: '#f59e0b' },
  ACCEPTED: { label: 'Accepté', color: '#10b981' },
  REJECTED: { label: 'Refusé', color: '#94a3b8' },
};

function formatAmount(cents: number | null, currency: string) {
  if (cents == null) return '—';
  // Une devise malformée ferait planter Intl (RangeError) : fallback robuste.
  try {
    return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency });
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function getAuditActionLabel(action: string) {
  switch (action) {
    case 'TICKET_CREATED':
      return 'Création';
    case 'TICKET_UPDATED':
      return 'Modification';
    case 'TICKET_STATUS_UPDATED':
      return 'Changement statut';
    case 'TICKET_ARCHIVED':
      return 'Archivage';
    case 'TICKET_UNARCHIVED':
      return 'Restauration';
    case 'CHAT_MESSAGE_CREATED':
      return 'Message';
    case 'SUBSCRIBER_ADDED':
    case 'SUBSCRIBER_ADDED_SELF':
      return 'Abonnement';
    case 'SUBSCRIBER_REMOVED':
    case 'SUBSCRIBER_REMOVED_SELF':
      return 'Désabonnement';
    case 'GROUP_SUBSCRIBED':
      return 'Abonnement groupe';
    default:
      return action;
  }
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const { id } = await params;

  const [ticket, criticalCount] = await Promise.all([
    // Accès refusé / ticket inexistant → 404 propre (au lieu d'une "Application error"),
    // et sans révéler l'existence du ticket à un utilisateur non autorisé.
    getTicketById(id).catch((error) => {
      const message = error instanceof Error ? error.message : '';
      if (message === 'Accès refusé' || message === 'Ticket introuvable') {
        return null;
      }
      throw error;
    }),
    getVisibleCriticalTicketsCountForUser(user),
  ]);

  if (!ticket) {
    notFound();
  }

  const canManageSubscriptions = user.role === 'ADMIN' || user.role === 'MANAGER';

  let availableUsers: Awaited<ReturnType<typeof getAvailableUsersForTicketSubscription>> = [];
  let availableGroups: Awaited<ReturnType<typeof getGroupsForTicketSubscription>> = [];

  if (canManageSubscriptions) {
    [availableUsers, availableGroups] = await Promise.all([
      getAvailableUsersForTicketSubscription(ticket.id),
      getGroupsForTicketSubscription(),
    ]);
  }

  const canEditStatus = user.role === 'ADMIN' || user.role === 'MANAGER';
  const teamsForReassign = canEditStatus
    ? await prisma.team.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
    : [];
  const quotes = await getQuotesForTicket(ticket.id);
  const appConfig = await getAppConfig();
  const technicians = canEditStatus ? await getAssignableTechnicians() : [];
  const parts = canEditStatus ? await getPartsForConsumption() : [];
  const failureCodes = ticket.nature === 'CORRECTIVE' ? await getFailureCodes() : [];
  const isCurrentUserSubscribed = ticket.subscriptions.some((sub) => sub.user.id === user.id);
  const isCurrentUserRequester = ticket.requesterId === user.id;

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <Link
                  href={`/tickets/team/${ticket.teamId}?view=kanban`}
                  className="text-xs text-muted transition-colors hover:text-foreground"
                >
                  ← Retour aux tickets
                </Link>
                <span className="text-border-default">|</span>
                <h1 className="page-toolbar-title tabular-nums">{ticket.ticketNumber} : {ticket.title}</h1>
                <span className="page-toolbar-subtitle">{ticket.team.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TicketSelfSubscriptionButton
                  ticketId={ticket.id}
                  isSubscribed={isCurrentUserSubscribed}
                  isRequester={isCurrentUserRequester}
                  canUnsubscribe={user.role !== 'MAINTAINER'}
                />
                <TicketPDFButton ticket={ticket} />
                {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
                  <>
                    <Link
                      href={`/tickets/${ticket.id}/edit`}
                      className="px-2.5 py-1 text-sm font-medium bg-surface-alt text-foreground border border-border-default rounded-lg transition-colors hover:bg-surface"
                    >
                      Modifier
                    </Link>
                    <TicketArchiveButton
                      ticketId={ticket.id}
                      isArchived={ticket.isArchived}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          {/* Bandeau : titre + statut + urgence */}
          <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[13px] font-bold text-accent tabular-nums flex-shrink-0">#{ticket.ticketNumber}</span>
            <h2 className="min-w-0 flex-1 truncate text-lg font-bold leading-tight text-foreground">
              {ticket.title}
            </h2>
            {ticket.isArchived && (
              <span className="px-1.5 py-0.5 text-[11px] font-medium rounded bg-surface-alt text-muted border border-border-default">
                Archivé
              </span>
            )}
            <div className="ml-auto flex flex-shrink-0 items-center gap-2">
              {!ticket.isArchived && isQuoteOverdue(ticket.quoteDeadline) && (
                <span
                  className="badge badge-danger"
                  title={`Échéance devis dépassée (${ticket.quoteDeadline?.toLocaleDateString('fr-FR')})`}
                >
                  <WarningIcon className="h-3 w-3" /> Devis en retard
                </span>
              )}
              {!ticket.isArchived && isResolutionOverdue(ticket.dueDate, ticket.closedAt) && (
                <span className="badge badge-danger" title="Échéance de résolution dépassée">
                  <ClockIcon className="h-3 w-3" /> Résolution en retard
                </span>
              )}
              {!ticket.isArchived && isFirstResponseOverdue(ticket.firstResponseDueAt, ticket.firstRespondedAt) && (
                <span className="badge badge-warn" title="Prise en charge non faite dans le délai">
                  <WarningIcon className="h-3 w-3" /> Prise en charge en retard
                </span>
              )}
              {canEditStatus ? (
                <TicketPrioritySelector ticketId={ticket.id} currentPriority={ticket.priority} />
              ) : (
                (() => {
                  const p = PRIORITY_META[ticket.priority] || PRIORITY_META.P2;
                  return (
                    <span
                      className="rounded px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide"
                      style={{ color: p.color, backgroundColor: p.color + '1a' }}
                      title={`Priorité : ${p.label}`}
                    >
                      {p.short}
                    </span>
                  );
                })()
              )}
              {canEditStatus ? (
                <TicketStatusSelector
                  ticketId={ticket.id}
                  currentStatusId={ticket.statusId}
                  availableStatuses={ticket.team.statuses}
                />
              ) : (
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium"
                  style={{
                    color: ticket.status.color || '#2f6f9e',
                    backgroundColor: (ticket.status.color || '#2f6f9e') + '1a',
                  }}
                >
                  {ticket.status.name}
                </span>
              )}
            </div>
          </div>

          {/* Cockpit : onglets (Aperçu / Exécution / Financier / Conversation / Suivi) */}
          {(() => {
            const nature = NATURE_META[ticket.nature] || NATURE_META.CORRECTIVE;
            const firstResponseLate =
              !ticket.isArchived && isFirstResponseOverdue(ticket.firstResponseDueAt, ticket.firstRespondedAt);
            const resolutionLate = !ticket.isArchived && isResolutionOverdue(ticket.dueDate, ticket.closedAt);
            const fmtDate = (d: Date | null) =>
              d ? new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) : '—';

            const apercu = (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 items-start">
              {/* Contexte */}
              <div className="card">
                <div className="card-head">
                  <span className="card-head-title">Contexte</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 p-3">
                  <div>
                    <span className="field-label">Équipe</span>
                    <p className="field-value truncate">{ticket.team.name}</p>
                  </div>
                  <div>
                    <span className="field-label">Localisation</span>
                    <p className="field-value truncate">{ticket.location?.name || 'Global'}</p>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="field-label">Équipement</span>
                      {ticket.equipment.photoStorageKey && (
                        <span className="text-[10px] text-accent-2">Photo</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {ticket.equipment.photoStorageKey && (
                        <EquipmentPhotoPreview
                          src={`/api/equipments/${ticket.equipment.id}/photo`}
                          alt={ticket.equipment.name}
                          size={32}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="field-value truncate">{ticket.equipment.name}</p>
                        <p className="text-[10px] font-mono text-muted truncate">{ticket.equipment.refCode}</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="field-label">Créé le</span>
                    <p className="field-value truncate">
                      {new Date(ticket.createdAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* État & SLA */}
                  <div className="card">
                    <div className="card-head">
                      <span className="card-head-title">État &amp; SLA</span>
                      <span
                        className="badge"
                        style={{ color: nature.color, backgroundColor: nature.color + '1a' }}
                        title={`Nature : ${nature.label}`}
                      >
                        {nature.label}
                      </span>
                    </div>
                    <div className="px-3">
                      <div className="data-row">
                        <span className="field-label">Prise en charge</span>
                        {ticket.firstRespondedAt ? (
                          <span className="badge badge-success">
                            <CheckIcon className="h-3 w-3" /> Prise en charge
                          </span>
                        ) : firstResponseLate ? (
                          <span className="badge badge-danger">
                            <WarningIcon className="h-3 w-3" /> En retard
                          </span>
                        ) : (
                          <span className="field-value text-muted">
                            {ticket.firstResponseDueAt
                              ? `Avant ${new Date(ticket.firstResponseDueAt).toLocaleString('fr-FR', {
                                  timeZone: 'Europe/Paris',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit',
                                })}`
                              : '—'}
                          </span>
                        )}
                      </div>

                      <div className="data-row">
                        <span className="field-label">Échéance résolution</span>
                        {resolutionLate ? (
                          <span className="badge badge-danger">
                            <ClockIcon className="h-3 w-3" /> {fmtDate(ticket.dueDate)} · retard
                          </span>
                        ) : (
                          <span className="field-value">{fmtDate(ticket.dueDate)}</span>
                        )}
                      </div>

                      {(ticket.interventionStartAt || ticket.interventionEndAt) && (
                        <div className="data-row">
                          <span className="field-label">Chantier</span>
                          <span className="field-value">
                            {fmtDate(ticket.interventionStartAt)} → {fmtDate(ticket.interventionEndAt)}
                          </span>
                        </div>
                      )}
                    </div>

                    {canEditStatus && teamsForReassign.length > 1 && (
                      <div className="border-t border-border-default px-3 py-2">
                        <TicketReassignControl
                          ticketId={ticket.id}
                          currentTeamId={ticket.teamId}
                          teams={teamsForReassign}
                        />
                      </div>
                    )}
                  </div>
              </div>
            );

            const intervention = (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 items-start">
              {/* Check-list (OT préventif) */}
              {ticket.tasks.length > 0 && <TicketTaskList tasks={ticket.tasks} canEdit={canEditStatus} />}

              {/* Temps & coûts */}
              {(canEditStatus || ticket.workLogs.length > 0 || ticket.costLines.length > 0) && (
                <TicketCostsPanel
                  ticketId={ticket.id}
                  workLogs={ticket.workLogs}
                  costLines={ticket.costLines}
                  laborRateCents={appConfig.laborRateCents}
                  canEdit={canEditStatus}
                />
              )}

              {/* Consommation de pièces */}
              {canEditStatus && <TicketPartConsumption ticketId={ticket.id} parts={parts} />}

              {/* Diagnostic (OT correctif) */}
              {ticket.nature === 'CORRECTIVE' && (canEditStatus || ticket.failureCode || ticket.causeCode || ticket.remedyCode) && (
                <TicketDiagnosis
                  ticketId={ticket.id}
                  codes={failureCodes}
                  current={{ failureCodeId: ticket.failureCodeId, causeCodeId: ticket.causeCodeId, remedyCodeId: ticket.remedyCodeId }}
                  canEdit={canEditStatus}
                />
              )}

              {/* Signature d'intervention */}
              {canEditStatus && <SignaturePad ticketId={ticket.id} />}

              {/* Intervenants */}
              <div className="card p-3 space-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted flex items-center gap-1.5">
                    <InfoIcon>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </InfoIcon>
                    Demandeur
                  </p>
                  <p className="text-sm font-medium text-foreground">{ticket.requester.displayName}</p>
                  <p className="text-xs text-muted">{ticket.requester.email}</p>
                </div>
                <div className="border-t border-border-default pt-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted flex items-center gap-1.5">
                    <InfoIcon>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                    </InfoIcon>
                    Mainteneur
                  </p>
                  {ticket.maintainer ? (
                    <>
                      <p className="text-sm font-medium text-foreground">{ticket.maintainer.name}</p>
                      <p className="text-xs text-muted">{ticket.maintainer.contact || '-'}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted">Non assigne</p>
                  )}
                </div>
                <div className="border-t border-border-default pt-2">
                  <p className="field-label mb-1">Technicien affecté</p>
                  {canEditStatus ? (
                    <TicketAssigneeControl
                      ticketId={ticket.id}
                      currentAssigneeId={ticket.assignee?.id ?? null}
                      technicians={technicians}
                    />
                  ) : (
                    <p className="text-sm text-foreground">{ticket.assignee?.displayName ?? 'Non affecté'}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted mb-1">Description</p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-snug">
                  {ticket.description}
                </p>
              </div>
              </div>
            );

            const abonnes = (
              <div className="space-y-3">
              {/* Abonnements + pièces jointes */}
              <TicketDetailPopins
                ticketId={ticket.id}
                requesterId={ticket.requesterId}
                subscriptions={ticket.subscriptions}
                availableUsers={availableUsers}
                availableGroups={availableGroups}
                canManageSubscriptions={canManageSubscriptions}
                canViewSubscriptions={canManageSubscriptions}
                attachments={ticket.attachments}
                canDeleteAttachments={user.role === 'ADMIN' || user.role === 'MANAGER'}
                currentUserId={user.id}
              />
              </div>
            );

            const financier = (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 items-start">
              {/* Devis */}
              {quotes.length > 0 && (
                <div className="card p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted mb-2 flex items-center gap-1.5">
                    <InfoIcon>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </InfoIcon>
                    Devis ({quotes.length})
                  </p>
                  <ul className="space-y-2">
                    {quotes.map((q) => {
                      const meta = QUOTE_STATUS_META[q.status] || QUOTE_STATUS_META.REQUESTED;
                      return (
                        <li key={q.id} className="rounded-lg border border-border-default bg-surface-alt p-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="rounded px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide"
                              style={{ color: meta.color, backgroundColor: meta.color + '1a' }}
                            >
                              {meta.label}
                            </span>
                            <span className="text-sm font-semibold text-foreground tabular-nums">
                              {formatAmount(q.amountCents, q.currency)}
                            </span>
                            {q.reference && (
                              <span className="text-[11px] text-muted truncate">n° {q.reference}</span>
                            )}
                            {q.hasFile && (
                              <a
                                href={`/api/quotes/${q.id}/file`}
                                className="ml-auto text-[11px] font-semibold text-[color:var(--accent)] hover:opacity-80"
                              >
                                PDF ↓
                              </a>
                            )}
                          </div>
                          <div className="mt-1 text-[10.5px] text-muted">
                            {q.maintainerName ? `${q.maintainerName} · ` : ''}
                            {q.receivedAt
                              ? `reçu le ${q.receivedAt.toLocaleDateString('fr-FR')}`
                              : `demandé le ${q.requestedAt.toLocaleDateString('fr-FR')}`}
                            {q.validUntil ? ` · valide jusqu'au ${q.validUntil.toLocaleDateString('fr-FR')}` : ''}
                          </div>
                          {q.notes && <div className="mt-1 text-[11px] text-foreground">{q.notes}</div>}
                          {canEditStatus && q.status === 'RECEIVED' && <QuoteDecisionButtons quoteId={q.id} />}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Facturation */}
              {(ticket.quoteNumber || ticket.invoiceNumber) && (
                <div className="card p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted flex items-center gap-1.5">
                    <InfoIcon>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8c-2.21 0-4 .895-4 2s1.79 2 4 2 4 .895 4 2-1.79 2-4 2m0-10v12m0-12V4m0 16v-2" /></svg>
                    </InfoIcon>
                    Facturation
                  </p>
                  <p className="text-sm text-foreground truncate tabular-nums">Devis : {ticket.quoteNumber || '-'}</p>
                  <p className="text-sm text-foreground truncate tabular-nums">Facture : {ticket.invoiceNumber || '-'}</p>
                </div>
              )}
              </div>
            );

            const historique = (
              <div className="max-w-2xl">
              {/* Historique */}
              {canManageSubscriptions && (
                <div className="card p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted mb-1">
                    Historique
                  </p>
                  {ticket.auditLogs.length === 0 ? (
                    <p className="text-xs text-muted">Aucun évènement enregistré</p>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {ticket.auditLogs.map((log) => (
                        <div key={log.id} className="text-xs text-foreground border border-border-default rounded px-1.5 py-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{getAuditActionLabel(log.action)}</span>
                            <span className="text-[10px] text-muted tabular-nums">
                              {new Date(log.createdAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted">
                            {log.actor.displayName}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              </div>
            );

            const conversation = (
              <ChatSection ticketId={ticket.id} messages={ticket.chatMessages} />
            );

            const items = [
              { id: 'apercu', label: 'Aperçu', content: apercu },
              { id: 'intervention', label: 'Intervention', content: intervention },
              ...(quotes.length > 0 || ticket.quoteNumber || ticket.invoiceNumber
                ? [{ id: 'financier', label: 'Financier', content: financier }]
                : []),
              { id: 'conversation', label: 'Conversation', content: conversation },
              { id: 'abonnes', label: 'Abonnés & PJ', content: abonnes },
              ...(canManageSubscriptions
                ? [{ id: 'historique', label: 'Historique', content: historique }]
                : []),
            ];

            return <Tabs items={items} />;
          })()}
        </div>
      </div>
    </>
  );
}
