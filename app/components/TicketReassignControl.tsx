'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { reassignTicketTeam } from '@/lib/actions/tickets';

type TeamOption = { id: string; name: string };

// Redirige un ticket vers une autre équipe/service (« ne concerne pas la maintenance »
// ou mauvaise équipe). ADMIN/MANAGER.
export default function TicketReassignControl({
  ticketId,
  currentTeamId,
  teams,
}: {
  ticketId: string;
  currentTeamId: string;
  teams: TeamOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const others = teams.filter((t) => t.id !== currentTeamId);

  const submit = async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      await reassignTicketTeam(ticketId, teamId, reason);
      setOpen(false);
      setTeamId('');
      setReason('');
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Redirection impossible');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full rounded border border-border-default bg-surface px-2 py-1.5 text-xs text-foreground focus:border-[color:var(--accent)] focus:outline-none';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-[color:var(--accent)] hover:opacity-80"
      >
        Rediriger vers une autre équipe →
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <select value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={loading} className={inputCls}>
        <option value="">— Équipe / service destinataire —</option>
        {others.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motif (optionnel)"
        maxLength={300}
        disabled={loading}
        className={inputCls}
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={loading || !teamId}
          className="rounded bg-[color:var(--primary)] px-2.5 py-1 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50"
        >
          Rediriger
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={loading}
          className="rounded border border-border-default px-2.5 py-1 text-xs text-muted hover:text-foreground disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
