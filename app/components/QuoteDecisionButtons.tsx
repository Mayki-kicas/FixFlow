'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { acceptQuote, rejectQuote } from '@/lib/actions/quotes';

// Accepter / refuser un devis reçu (ADMIN/MANAGER). Motif optionnel.
export default function QuoteDecisionButtons({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [choice, setChoice] = useState<'ACCEPTED' | 'REJECTED' | null>(null);
  const [notes, setNotes] = useState('');

  const submit = async () => {
    if (!choice) return;
    setLoading(true);
    try {
      if (choice === 'ACCEPTED') await acceptQuote(quoteId, notes);
      else await rejectQuote(quoteId, notes);
      setChoice(null);
      setNotes('');
      router.refresh();
    } catch (error) {
      console.error('Erreur lors de la décision sur le devis:', error);
      alert('Impossible d’enregistrer la décision');
    } finally {
      setLoading(false);
    }
  };

  if (choice) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Motif (optionnel)"
          maxLength={300}
          disabled={loading}
          className="w-48 rounded border border-border-default bg-surface px-2 py-1 text-xs text-foreground focus:border-[color:var(--accent)] focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="rounded bg-[color:var(--primary)] px-2 py-1 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50"
        >
          {choice === 'ACCEPTED' ? 'Confirmer l’acceptation' : 'Confirmer le refus'}
        </button>
        <button
          type="button"
          onClick={() => { setChoice(null); setNotes(''); }}
          disabled={loading}
          className="rounded border border-border-default px-2 py-1 text-xs text-muted hover:text-foreground disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setChoice('ACCEPTED')}
        disabled={loading}
        className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        Accepter
      </button>
      <button
        type="button"
        onClick={() => setChoice('REJECTED')}
        disabled={loading}
        className="rounded border border-border-default px-2 py-1 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
      >
        Refuser
      </button>
    </div>
  );
}
