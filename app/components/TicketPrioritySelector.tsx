'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Priority } from '@prisma/client';
import { updateTicketPriority } from '@/lib/actions/tickets';
import { PRIORITY_META, PRIORITIES } from '@/lib/priority';

// Sélecteur de priorité (ADMIN/MANAGER). Chaque changement est historisé côté serveur
// et recalcule l'échéance de devis. Le motif est optionnel.
export default function TicketPrioritySelector({
  ticketId,
  currentPriority,
}: {
  ticketId: string;
  currentPriority: Priority;
}) {
  const router = useRouter();
  const [priority, setPriority] = useState<Priority>(currentPriority);
  const [pending, setPending] = useState<Priority | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const meta = PRIORITY_META[priority];

  const apply = async (next: Priority, why: string) => {
    setLoading(true);
    try {
      await updateTicketPriority(ticketId, next, why.trim() || undefined);
      setPriority(next);
      setPending(null);
      setReason('');
      router.refresh();
    } catch (error) {
      console.error('Erreur lors du changement de priorité:', error);
      alert('Impossible de changer la priorité');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <div className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-alt px-2.5 py-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
        <select
          value={pending ?? priority}
          onChange={(e) => {
            const next = e.target.value as Priority;
            setPending(next === priority ? null : next);
          }}
          disabled={loading}
          className="bg-transparent pr-5 text-sm font-medium text-foreground focus:outline-none disabled:opacity-50"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_META[p].short} — {PRIORITY_META[p].label}
            </option>
          ))}
        </select>
      </div>

      {pending && pending !== priority && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif (optionnel)"
            maxLength={200}
            disabled={loading}
            className="w-44 rounded border border-border-default bg-surface px-2 py-1 text-xs text-foreground focus:border-[color:var(--accent)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => apply(pending, reason)}
            disabled={loading}
            className="rounded bg-[color:var(--primary)] px-2 py-1 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50"
          >
            Valider
          </button>
          <button
            type="button"
            onClick={() => {
              setPending(null);
              setReason('');
            }}
            disabled={loading}
            className="rounded border border-border-default px-2 py-1 text-xs text-muted hover:text-foreground disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
