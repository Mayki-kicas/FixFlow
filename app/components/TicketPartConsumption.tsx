'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { consumePartOnTicket } from '@/lib/actions/parts';
import { formatEuros } from '@/lib/costs-core';

type Part = { id: string; reference: string; name: string; unit: string | null; unitPriceCents: number | null; stockQty: number };

// Consommer une pièce sur l'OT : décrémente le stock + ajoute une ligne de coût.
export default function TicketPartConsumption({ ticketId, parts }: { ticketId: string; parts: Part[] }) {
  const router = useRouter();
  const [partId, setPartId] = useState('');
  const [qty, setQty] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const q = Number.parseInt(qty || '0', 10);
    if (!partId || q <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await consumePartOnTicket(ticketId, partId, q);
      setPartId('');
      setQty('1');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Consommation impossible');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'rounded border border-border-default bg-surface px-2 py-1 text-xs text-foreground focus:border-[color:var(--accent)] focus:outline-none';

  return (
    <div className="card">
      <div className="card-head"><span className="card-head-title">Consommer une pièce</span></div>
      <div className="p-3 space-y-2">
        {error && <p role="alert" className="text-xs text-[#b91c1c] dark:text-[#f87171]">{error}</p>}
        {parts.length === 0 ? (
          <p className="text-xs text-muted">Aucune pièce au catalogue.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <select value={partId} onChange={(e) => setPartId(e.target.value)} disabled={busy} className={`${inputCls} flex-1 min-w-[160px]`}>
              <option value="">— Choisir une pièce —</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.reference}) · stock {p.stockQty}{p.unitPriceCents != null ? ` · ${formatEuros(p.unitPriceCents)}` : ''}
                </option>
              ))}
            </select>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} disabled={busy} className={`${inputCls} w-16`} />
            <button type="button" onClick={submit} disabled={busy || !partId} className="rounded bg-[color:var(--primary)] px-2.5 py-1 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50">
              Consommer
            </button>
          </div>
        )}
        <p className="text-[10px] text-muted">La consommation décrémente le stock et ajoute une ligne de coût (pièce) à l&apos;OT.</p>
      </div>
    </div>
  );
}
