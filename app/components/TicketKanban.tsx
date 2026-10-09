'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { archiveTicket, updateTicketStatus } from '@/lib/actions/tickets';
import { useToast } from '@/components/ToastProvider';
import { WarningIcon } from '@/components/icons';
import { isQuoteOverdue } from '@/lib/priority';

type Priority = 'P1' | 'P2' | 'P3';

type Ticket = {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  statusId: string;
  priority: Priority;
  quoteDeadline: Date | string | null;
  status: {
    id: string;
    name: string;
    color: string | null;
  };
  equipment: {
    name: string;
    refCode: string;
  };
  location: {
    name: string;
  } | null;
  requester: {
    id: string;
    displayName: string;
  };
  _count: {
    chatMessages: number;
    attachments: number;
  };
  createdAt: Date;
};

type Status = {
  id: string;
  name: string;
  color: string | null;
  isFinal: boolean;
};

// Signalétique d'atelier : corail incident, ambre en cours, acier basse priorité.
const PRIORITY_META: Record<Priority, { color: string; label: string }> = {
  P1: { color: '#e8513b', label: 'P1' },
  P2: { color: '#c97e1a', label: 'P2' },
  P3: { color: '#2f6f9e', label: 'P3' },
};

// Palette d'avatars chaude, dérivée des signaux d'atelier.
const AVATAR_COLORS = ['#e8513b', '#c97e1a', '#2f7d5b', '#2f6f9e', '#b4652a', '#7a6a9e', '#4a7c59', '#9a5f12'];

function getInitials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getAvatarColor(name: string) {
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

type TicketKanbanProps = {
  statuses: Status[];
  tickets: Ticket[];
  canArchive?: boolean;
};

export default function TicketKanban({ statuses, tickets, canArchive = false }: TicketKanbanProps) {
  const toast = useToast();
  const [localTickets, setLocalTickets] = useState(tickets);
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [dragOverStatusId, setDragOverStatusId] = useState<string | null>(null);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [archivingTicketId, setArchivingTicketId] = useState<string | null>(null);
  const draggedTicketIdRef = useRef<string | null>(null);

  useEffect(() => {
    setLocalTickets(tickets);
  }, [tickets]);

  const formatTicketAge = (createdAt: Date) => {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours < 1) return 'à l’instant';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}j`;
  };

  const ticketsByStatus = statuses.reduce((acc, status) => {
    acc[status.id] = localTickets
      .filter((t) => t.statusId === status.id)
      .sort((a, b) => {
        const aNum = typeof a.ticketNumber === 'number' ? a.ticketNumber : 0;
        const bNum = typeof b.ticketNumber === 'number' ? b.ticketNumber : 0;
        if (aNum === bNum) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return bNum - aNum;
      });
    return acc;
  }, {} as Record<string, Ticket[]>);

  const getStatusById = (statusId: string) => statuses.find((status) => status.id === statusId);

  const applyTicketStatus = (ticket: Ticket, statusId: string) => {
    const status = getStatusById(statusId);
    if (!status) return ticket;
    return {
      ...ticket,
      statusId: status.id,
      status: {
        ...ticket.status,
        id: status.id,
        name: status.name,
        color: status.color,
      },
    };
  };

  const handleDropTicket = async (targetStatusId: string, droppedTicketId: string | null) => {
    if (updatingTicketId) return;

    const ticketId = droppedTicketId || draggedTicketIdRef.current || draggedTicketId;
    if (!ticketId) return;

    const draggedTicket = localTickets.find((t) => t.id === ticketId);
    if (!draggedTicket) {
      setDraggedTicketId(null);
      draggedTicketIdRef.current = null;
      setDragOverStatusId(null);
      return;
    }

    const previousStatusId = draggedTicket.statusId;

    if (previousStatusId === targetStatusId) {
      setDraggedTicketId(null);
      setDragOverStatusId(null);
      return;
    }

    setUpdatingTicketId(ticketId);
    setLocalTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId
          ? applyTicketStatus(ticket, targetStatusId)
          : ticket
      )
    );

    try {
      await updateTicketStatus(ticketId, targetStatusId);
      toast.success(`Ticket déplacé vers "${getStatusById(targetStatusId)?.name || 'nouveau statut'}".`);
    } catch (error) {
      setLocalTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId
            ? applyTicketStatus(ticket, previousStatusId)
            : ticket
        )
      );
      console.error('Erreur lors du déplacement du ticket:', error);
      const errorMessage =
        error instanceof Error ? error.message.toLowerCase() : '';
      const isPermissionError =
        errorMessage.includes('permission') ||
        errorMessage.includes('acces') ||
        errorMessage.includes('autor');

      if (isPermissionError) {
        toast.error("Action refusée: vous n'avez pas les permissions pour changer l'état de ce ticket.");
      } else {
        toast.error("Le déplacement a échoué. L'état d'origine a été restauré.");
      }
    } finally {
      setUpdatingTicketId(null);
      setDraggedTicketId(null);
      draggedTicketIdRef.current = null;
      setDragOverStatusId(null);
    }
  };

  const handleArchive = async (ticketId: string) => {
    if (archivingTicketId) return;
    setArchivingTicketId(ticketId);
    // Retrait optimiste : la carte quitte le board immédiatement.
    const snapshot = localTickets;
    setLocalTickets((prev) => prev.filter((t) => t.id !== ticketId));
    try {
      await archiveTicket(ticketId);
      toast.success('Ticket archivé. Restaurable via la recherche (tickets archivés).');
    } catch (error) {
      setLocalTickets(snapshot);
      const message =
        error instanceof Error ? error.message : "L'archivage a échoué.";
      toast.error(message);
    } finally {
      setArchivingTicketId(null);
    }
  };

  return (
    <div className="space-y-2">
    <div className="flex gap-3.5 overflow-x-auto pb-2">
      {statuses.map((status) => {
        const statusTickets = ticketsByStatus[status.id] || [];
        const isDragOver = dragOverStatusId === status.id;
        return (
          <div
            key={status.id}
            className={`flex-shrink-0 w-72 rounded-2xl border p-2.5 transition-colors ${
              isDragOver
                ? 'border-[color:var(--accent)] ring-2 ring-[#e8513b]/25 bg-[#fbf8f2]/80 dark:bg-[#1a1f27]/70'
                : 'border-border-default bg-[#fbf8f2]/55 dark:bg-[#1a1f27]/45'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverStatusId !== status.id) {
                setDragOverStatusId(status.id);
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOverStatusId(status.id);
            }}
            onDragLeave={(e) => {
              const nextTarget = e.relatedTarget as Node | null;
              if (!nextTarget || !e.currentTarget.contains(nextTarget)) {
                setDragOverStatusId((current) => (current === status.id ? null : current));
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const transferTicketId = e.dataTransfer.getData('text/plain') || null;
              handleDropTicket(status.id, transferTicketId);
            }}
          >
            {/* Header colonne */}
            <div className="flex items-center gap-2 px-1.5 pb-2.5">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: status.color || '#94a3b8' }}
              />
              <h3 className="text-[13px] font-bold tracking-tight text-foreground truncate">
                {status.name}
              </h3>
              {status.isFinal && (
                <svg className="w-3.5 h-3.5 text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className="ml-auto rounded border border-border-default bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted tabular-nums">
                {statusTickets.length}
              </span>
            </div>

            {/* Liste des tickets */}
            <div className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto pr-0.5">
              {statusTickets.length === 0 ? (
                <div className="bg-dotgrid rounded-xl border border-dashed border-border-default py-7 px-2 text-center">
                  <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-muted">Aucun ticket</p>
                  <p className="text-[11px] text-muted mt-0.5">Glisse une carte ici pour avancer le traitement.</p>
                </div>
              ) : (
                statusTickets.map((ticket) => {
                  const priority = PRIORITY_META[ticket.priority] || PRIORITY_META.P2;
                  const showPriorityFlag = ticket.priority === 'P1';
                  const quoteOverdue = ticket.quoteDeadline
                    ? isQuoteOverdue(new Date(ticket.quoteDeadline))
                    : false;
                  return (
                  <div key={ticket.id} className="relative group/card">
                  <Link
                    href={`/tickets/${ticket.id}`}
                    draggable={updatingTicketId !== ticket.id}
                    onDragStart={(e) => {
                      if (updatingTicketId) {
                        e.preventDefault();
                        return;
                      }
                      draggedTicketIdRef.current = ticket.id;
                      setDraggedTicketId(ticket.id);
                      setDragOverStatusId(ticket.statusId);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', ticket.id);
                    }}
                    onDragEnd={() => {
                      draggedTicketIdRef.current = null;
                      setDraggedTicketId(null);
                      setDragOverStatusId(null);
                    }}
                    className={`block rounded-xl border border-border-default bg-surface p-3 shadow-[0_1px_2px_rgba(27,23,20,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-soft-md hover:border-[color:var(--accent)] cursor-grab active:cursor-grabbing animate-fade-in-up ${
                      draggedTicketId === ticket.id ? 'opacity-60' : ''
                    } ${updatingTicketId === ticket.id ? 'pointer-events-none opacity-70' : ''}`}
                  >
                    {/* Ligne urgence + n° + drapeau */}
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: priority.color }}
                        title={`Priorité : ${priority.label}`}
                      />
                      <span className="font-mono text-[11px] font-semibold text-foreground tabular-nums">#{ticket.ticketNumber}</span>
                      <div className="ml-auto flex items-center gap-1">
                        {quoteOverdue && (
                          <span className="badge badge-danger" title="Échéance devis dépassée">
                            <WarningIcon className="h-3 w-3" /> Retard
                          </span>
                        )}
                        {showPriorityFlag && (
                          <span
                            className="rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.06em]"
                            style={{ color: priority.color, backgroundColor: `${priority.color}1f` }}
                          >
                            {priority.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Titre */}
                    <h4 className="mb-2 text-[13px] font-semibold leading-snug text-foreground line-clamp-2">
                      {ticket.title}
                    </h4>

                    {/* Équipement (réf) + site */}
                    <div className="mb-2 flex min-w-0 items-center gap-1.5">
                      <span className="tag-ribbon flex-shrink-0">
                        {ticket.equipment.refCode}
                      </span>
                      <span className="truncate text-[11px] text-muted">{ticket.location?.name || 'Global'}</span>
                    </div>

                    {/* Footer : demandeur + âge + activité */}
                    <div className="flex items-center gap-2 border-t border-border-default pt-2">
                      <span
                        className="inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white"
                        style={{ width: 22, height: 22, fontSize: 9, backgroundColor: getAvatarColor(ticket.requester.displayName) }}
                        title={ticket.requester.displayName}
                      >
                        {getInitials(ticket.requester.displayName)}
                      </span>
                      <span className="text-[11px] text-muted">{formatTicketAge(ticket.createdAt)}</span>
                      <div className="ml-auto flex items-center gap-2.5 text-[11px] text-muted">
                        {ticket._count.chatMessages > 0 && (
                          <span className="flex items-center gap-0.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {ticket._count.chatMessages}
                          </span>
                        )}
                        {ticket._count.attachments > 0 && (
                          <span className="flex items-center gap-0.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            {ticket._count.attachments}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  {canArchive && (
                    <button
                      type="button"
                      onClick={() => handleArchive(ticket.id)}
                      disabled={archivingTicketId === ticket.id}
                      className="absolute right-1.5 top-1.5 z-10 hidden h-6 w-6 items-center justify-center rounded-md border border-border-default bg-surface text-muted shadow-soft-md transition-colors hover:text-[color:var(--accent)] hover:border-[color:var(--accent)] disabled:opacity-50 group-hover/card:flex"
                      aria-label={`Archiver le ticket #${ticket.ticketNumber}`}
                      title="Archiver"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                    </button>
                  )}
                  </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}

      {statuses.length === 0 && (
        <div className="flex-1 rounded-2xl border border-border-default bg-surface p-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#e8513b]/10 text-[color:var(--accent)]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 8h10M7 12h10M7 16h6" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">
            Aucun statut n’est encore configuré pour cette équipe.
          </p>
          <p className="text-xs text-muted mt-1">
            Ajoute des statuts dans le backoffice pour démarrer un kanban propre.
          </p>
        </div>
      )}
    </div>
    </div>
  );
}
