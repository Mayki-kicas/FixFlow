'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { archiveTicket, unarchiveTicket } from '@/lib/actions/tickets';
import { useToast } from '@/components/ToastProvider';

export default function TicketArchiveButton({
  ticketId,
  isArchived,
  variant = 'default',
}: {
  ticketId: string;
  isArchived: boolean;
  variant?: 'default' | 'compact';
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;

    if (!isArchived) {
      const ok = window.confirm(
        "Archiver ce ticket ? Il sera retiré des vues actives (kanban, listes) mais reste consultable et restaurable dans les tickets archivés.",
      );
      if (!ok) return;
    }

    setLoading(true);
    try {
      if (isArchived) {
        await unarchiveTicket(ticketId);
        toast.success('Ticket restauré dans les tickets actifs.');
      } else {
        await archiveTicket(ticketId);
        toast.success('Ticket archivé.');
      }
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "L'opération a échoué.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const icon = isArchived ? (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
  ) : (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-surface text-muted transition-colors hover:text-[color:var(--accent)] hover:border-[color:var(--accent)] disabled:opacity-50"
        aria-label={isArchived ? 'Restaurer le ticket' : 'Archiver le ticket'}
        title={isArchived ? 'Restaurer' : 'Archiver'}
      >
        {loading ? <span className="text-xs">...</span> : icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium bg-surface-alt text-foreground border border-border-default rounded-lg transition-colors hover:bg-surface disabled:opacity-50"
      aria-label={isArchived ? 'Restaurer le ticket' : 'Archiver le ticket'}
    >
      {icon}
      {loading ? '...' : isArchived ? 'Restaurer' : 'Archiver'}
    </button>
  );
}
