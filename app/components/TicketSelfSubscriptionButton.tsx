'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  subscribeCurrentUserToTicket,
  unsubscribeCurrentUserFromTicket,
} from '@/lib/actions/tickets';

export default function TicketSelfSubscriptionButton({
  ticketId,
  isSubscribed,
  isRequester,
  canUnsubscribe = true,
}: {
  ticketId: string;
  isSubscribed: boolean;
  isRequester: boolean;
  canUnsubscribe?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isSubscribed) {
        await unsubscribeCurrentUserFromTicket(ticketId);
      } else {
        await subscribeCurrentUserToTicket(ticketId);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de mise à jour de votre abonnement');
    } finally {
      setLoading(false);
    }
  };

  if (isSubscribed && !canUnsubscribe && !isRequester) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="px-3 py-1.5 text-sm font-medium rounded-lg border bg-surface border-border-default text-foreground">
          Abonné
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading || isRequester}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
          isSubscribed
            ? 'bg-surface border-border-default text-foreground hover:bg-surface-alt'
            : 'bg-[color:var(--primary)] border-[color:var(--primary)] text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)]'
        } disabled:opacity-50`}
        title={isRequester ? 'Le demandeur reste abonné automatiquement' : undefined}
      >
        {loading ? '...' : isRequester ? 'Abonné (demandeur)' : isSubscribed ? 'Se désabonner' : "S'abonner"}
      </button>
      {error && <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
