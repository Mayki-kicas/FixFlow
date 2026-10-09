'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { assignTicket } from '@/lib/actions/technicians';

type Technician = { id: string; displayName: string; role: string };

// Affectation d'un OT à un technicien interne (ADMIN/MANAGER).
export default function TicketAssigneeControl({
  ticketId,
  currentAssigneeId,
  technicians,
}: {
  ticketId: string;
  currentAssigneeId: string | null;
  technicians: Technician[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onChange = async (userId: string) => {
    setBusy(true);
    try {
      await assignTicket(ticketId, userId || null);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Affectation impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <select
      value={currentAssigneeId ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={busy}
      className="w-full rounded border border-border-default bg-surface px-2 py-1 text-sm text-foreground focus:border-[color:var(--accent)] focus:outline-none disabled:opacity-50"
    >
      <option value="">— Non affecté —</option>
      {technicians.map((t) => (
        <option key={t.id} value={t.id}>{t.displayName}</option>
      ))}
    </select>
  );
}
