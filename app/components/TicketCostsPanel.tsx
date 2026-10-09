'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addWorkLog, deleteWorkLog, addCostLine, deleteCostLine } from '@/lib/actions/costs';
import { computeTicketCost, formatEuros, formatMinutes } from '@/lib/costs-core';
import type { CostLineType } from '@prisma/client';

type WorkLog = { id: string; minutes: number; performedAt: Date; note: string | null; user: { displayName: string } };
type CostLine = { id: string; type: string; label: string; amountCents: number; quantity: number };

const COST_TYPES: { value: CostLineType; label: string }[] = [
  { value: 'PART', label: 'Pièce' },
  { value: 'EXTERNAL', label: 'Externe' },
  { value: 'OTHER', label: 'Autre' },
];
const costTypeLabel = (t: string) => COST_TYPES.find((c) => c.value === t)?.label ?? 'Autre';

export default function TicketCostsPanel({
  ticketId,
  workLogs,
  costLines,
  laborRateCents,
  canEdit,
}: {
  ticketId: string;
  workLogs: WorkLog[];
  costLines: CostLine[];
  laborRateCents: number | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hh, setHh] = useState('');
  const [mm, setMm] = useState('');
  const [note, setNote] = useState('');
  const [cType, setCType] = useState<CostLineType>('PART');
  const [cLabel, setCLabel] = useState('');
  const [cAmount, setCAmount] = useState('');
  const [cQty, setCQty] = useState('1');

  const totalMinutes = workLogs.reduce((s, w) => s + w.minutes, 0);
  const cost = computeTicketCost({
    workLogMinutes: totalMinutes,
    laborRateCents,
    costLines: costLines.map((l) => ({ amountCents: l.amountCents, quantity: l.quantity })),
  });

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setBusy(false);
    }
  };

  const submitWorkLog = async () => {
    const minutes = (Number.parseInt(hh || '0', 10) || 0) * 60 + (Number.parseInt(mm || '0', 10) || 0);
    if (minutes <= 0) return;
    await run(async () => {
      await addWorkLog({ ticketId, minutes, note: note || null });
      setHh('');
      setMm('');
      setNote('');
    });
  };

  const submitCostLine = async () => {
    const amountCents = Math.round(Number.parseFloat((cAmount || '').replace(',', '.')) * 100);
    const quantity = Number.parseInt(cQty || '1', 10) || 1;
    if (!cLabel.trim() || !Number.isFinite(amountCents) || amountCents < 0) return;
    await run(async () => {
      await addCostLine({ ticketId, type: cType, label: cLabel.trim(), amountCents, quantity });
      setCLabel('');
      setCAmount('');
      setCQty('1');
    });
  };

  const inputCls = 'rounded border border-border-default bg-surface px-2 py-1 text-xs text-foreground focus:border-[color:var(--accent)] focus:outline-none';

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-head-title">Temps &amp; coûts</span>
        <span className="badge badge-neutral tabular-nums">{formatEuros(cost.totalCents)}</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Totaux */}
        <div className="grid grid-cols-3 gap-2">
          <div className="stat-tile">
            <p className="stat-label">Main d&apos;œuvre</p>
            <p className="stat-value text-sm">{formatMinutes(totalMinutes)}</p>
            {laborRateCents != null && <p className="text-[10px] text-muted tabular-nums">{formatEuros(cost.laborCents)}</p>}
          </div>
          <div className="stat-tile">
            <p className="stat-label">Lignes</p>
            <p className="stat-value text-sm tabular-nums">{formatEuros(cost.linesCents)}</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Total</p>
            <p className="stat-value text-sm tabular-nums">{formatEuros(cost.totalCents)}</p>
          </div>
        </div>

        {/* Temps passé */}
        <div>
          <p className="field-label mb-1">Temps passé</p>
          {workLogs.length > 0 && (
            <ul className="mb-2 divide-y divide-[color:var(--border-default)] rounded-lg border border-border-default">
              {workLogs.map((w) => (
                <li key={w.id} className="flex items-center gap-2 px-2 py-1 text-xs">
                  <span className="font-medium text-foreground tabular-nums">{formatMinutes(w.minutes)}</span>
                  <span className="text-muted">· {w.user.displayName}</span>
                  <span className="text-muted tabular-nums">· {new Date(w.performedAt).toLocaleDateString('fr-FR')}</span>
                  {w.note && <span className="truncate text-muted">· {w.note}</span>}
                  {canEdit && (
                    <button type="button" onClick={() => run(() => deleteWorkLog(w.id))} disabled={busy} className="ml-auto text-[11px] text-[#b91c1c] hover:opacity-80 disabled:opacity-50">
                      Suppr.
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-1.5">
              <input type="number" min={0} value={hh} onChange={(e) => setHh(e.target.value)} placeholder="h" className={`${inputCls} w-14`} />
              <input type="number" min={0} max={59} value={mm} onChange={(e) => setMm(e.target.value)} placeholder="min" className={`${inputCls} w-16`} />
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="note (optionnel)" className={`${inputCls} flex-1 min-w-[120px]`} />
              <button type="button" onClick={submitWorkLog} disabled={busy} className="rounded bg-[color:var(--primary)] px-2.5 py-1 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50">
                Ajouter
              </button>
            </div>
          )}
        </div>

        {/* Lignes de coût */}
        <div>
          <p className="field-label mb-1">Lignes de coût</p>
          {costLines.length > 0 && (
            <ul className="mb-2 divide-y divide-[color:var(--border-default)] rounded-lg border border-border-default">
              {costLines.map((l) => (
                <li key={l.id} className="flex items-center gap-2 px-2 py-1 text-xs">
                  <span className="badge badge-neutral flex-shrink-0">{costTypeLabel(l.type)}</span>
                  <span className="min-w-0 truncate text-foreground">{l.label}</span>
                  {l.quantity > 1 && <span className="text-muted tabular-nums">× {l.quantity}</span>}
                  <span className="ml-auto font-medium text-foreground tabular-nums">{formatEuros(l.amountCents * l.quantity)}</span>
                  {canEdit && (
                    <button type="button" onClick={() => run(() => deleteCostLine(l.id))} disabled={busy} className="text-[11px] text-[#b91c1c] hover:opacity-80 disabled:opacity-50">
                      Suppr.
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-1.5">
              <select value={cType} onChange={(e) => setCType(e.target.value as CostLineType)} className={inputCls}>
                {COST_TYPES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <input type="text" value={cLabel} onChange={(e) => setCLabel(e.target.value)} placeholder="libellé" className={`${inputCls} flex-1 min-w-[120px]`} />
              <input type="number" min={0} step="0.01" value={cAmount} onChange={(e) => setCAmount(e.target.value)} placeholder="€ HT" className={`${inputCls} w-20`} />
              <input type="number" min={1} value={cQty} onChange={(e) => setCQty(e.target.value)} placeholder="qté" className={`${inputCls} w-14`} />
              <button type="button" onClick={submitCostLine} disabled={busy} className="rounded bg-[color:var(--primary)] px-2.5 py-1 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50">
                Ajouter
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
