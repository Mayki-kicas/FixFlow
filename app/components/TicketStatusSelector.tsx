'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateTicketStatus } from '@/lib/actions/tickets';

type Status = {
  id: string;
  name: string;
  color: string | null;
};

export default function TicketStatusSelector({
  ticketId,
  currentStatusId,
  availableStatuses,
}: {
  ticketId: string;
  currentStatusId: string;
  availableStatuses: Status[];
}) {
  const router = useRouter();
  const [statusId, setStatusId] = useState(currentStatusId);
  const [loading, setLoading] = useState(false);

  const handleChange = async (newStatusId: string) => {
    if (newStatusId === statusId || loading) return;

    setLoading(true);
    try {
      await updateTicketStatus(ticketId, newStatusId);
      setStatusId(newStatusId);
      router.refresh();
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      alert('Impossible de changer le statut');
    } finally {
      setLoading(false);
    }
  };

  const currentStatus = availableStatuses.find((s) => s.id === statusId);

  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border-default bg-surface-alt"
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: currentStatus?.color || '#94a3b8' }}
      />
      <select
        value={statusId}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
        className="bg-transparent pr-5 text-sm font-medium text-foreground focus:outline-none disabled:opacity-50"
      >
        {availableStatuses.map((status) => (
          <option key={status.id} value={status.id}>
            {status.name}
          </option>
        ))}
      </select>
    </div>
  );
}
