'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPart, updatePart, deletePart, receiveStock, adjustStock } from '@/lib/actions/parts';
import { formatEuros } from '@/lib/costs-core';
import { isLowStock } from '@/lib/parts-shared';

type Part = {
  id: string;
  reference: string;
  name: string;
  unit: string | null;
  unitPriceCents: number | null;
  stockQty: number;
  reorderPoint: number | null;
};

const inputCls = 'rounded border border-border-default bg-surface px-2 py-1 text-xs text-foreground focus:border-[color:var(--accent)] focus:outline-none';

export default function PartsManager({ parts }: { parts: Part[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ reference: '', name: '', unit: '', price: '', reorderPoint: '' });
  const [qtyByPart, setQtyByPart] = useState<Record<string, string>>({});
  const [adjByPart, setAdjByPart] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: '', unit: '', price: '', reorderPoint: '' });

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setBusy(false);
    }
  };

  const toCents = (s: string) => {
    const t = s.trim().replace(',', '.');
    if (t === '') return null;
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  };
  const toIntOrNull = (s: string) => {
    const t = s.trim();
    if (t === '') return null;
    const n = Number.parseInt(t, 10);
    return Number.isFinite(n) ? n : null;
  };

  const addPart = async () => {
    if (!form.reference.trim() || !form.name.trim()) {
      setError('Référence et nom requis');
      return;
    }
    await run(async () => {
      await createPart({
        reference: form.reference,
        name: form.name,
        unit: form.unit || null,
        unitPriceCents: toCents(form.price),
        reorderPoint: toIntOrNull(form.reorderPoint),
      });
      setForm({ reference: '', name: '', unit: '', price: '', reorderPoint: '' });
      setAdding(false);
    });
  };

  const saveEdit = async (id: string) => {
    await run(() => updatePart(id, {
      name: edit.name,
      unit: edit.unit || null,
      unitPriceCents: toCents(edit.price),
      reorderPoint: toIntOrNull(edit.reorderPoint),
    }));
    setEditingId(null);
  };

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-xs text-[#b91c1c] dark:text-[#f87171]">{error}</p>}

      {!adding ? (
        <button type="button" onClick={() => setAdding(true)} className="rounded bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)]">
          + Nouvelle pièce
        </button>
      ) : (
        <div className="card p-3 flex flex-wrap items-end gap-2">
          <div><label className="field-label mb-0.5">Référence *</label><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={`${inputCls} w-32`} /></div>
          <div><label className="field-label mb-0.5">Nom *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${inputCls} w-48`} /></div>
          <div><label className="field-label mb-0.5">Unité</label><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="u, m, L" className={`${inputCls} w-20`} /></div>
          <div><label className="field-label mb-0.5">Prix (€ HT)</label><input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={`${inputCls} w-24`} /></div>
          <div><label className="field-label mb-0.5">Seuil réappro</label><input type="number" value={form.reorderPoint} onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })} className={`${inputCls} w-24`} /></div>
          <button type="button" onClick={addPart} disabled={busy} className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Créer</button>
          <button type="button" onClick={() => setAdding(false)} className="text-xs text-muted hover:text-foreground">Annuler</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-default)]">
            <thead className="bg-surface-alt">
              <tr>
                <th className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted">Référence</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted">Nom</th>
                <th className="px-3 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-muted">Stock</th>
                <th className="px-3 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-muted">Seuil</th>
                <th className="px-3 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-muted">Prix</th>
                <th className="px-3 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-muted">Mouvements</th>
                <th className="px-3 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-default)]">
              {parts.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted">Aucune pièce.</td></tr>
              ) : (
                parts.map((p) => {
                  const low = isLowStock(p.stockQty, p.reorderPoint);
                  const editing = editingId === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-surface-alt align-top">
                      <td className="px-3 py-2 font-mono text-xs text-foreground">{p.reference}</td>
                      <td className="px-3 py-2 text-xs text-foreground">
                        {editing ? (
                          <div className="flex flex-wrap gap-1">
                            <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={`${inputCls} w-40`} />
                            <input value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="unité" className={`${inputCls} w-16`} />
                          </div>
                        ) : (
                          <>{p.name}{p.unit ? <span className="text-[10px] text-muted"> · {p.unit}</span> : null}</>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={low ? 'badge badge-danger' : 'text-xs text-foreground tabular-nums'}>{p.stockQty}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted tabular-nums">
                        {editing ? <input type="number" value={edit.reorderPoint} onChange={(e) => setEdit({ ...edit, reorderPoint: e.target.value })} className={`${inputCls} w-16`} /> : (p.reorderPoint ?? '—')}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted tabular-nums">
                        {editing ? <input type="number" step="0.01" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} className={`${inputCls} w-20`} /> : (p.unitPriceCents != null ? formatEuros(p.unitPriceCents) : '—')}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <input type="number" min={1} value={qtyByPart[p.id] ?? ''} onChange={(e) => setQtyByPart((m) => ({ ...m, [p.id]: e.target.value }))} placeholder="qté" className={`${inputCls} w-14`} />
                          <button type="button" disabled={busy} onClick={() => { const q = Number.parseInt(qtyByPart[p.id] || '0', 10); if (q > 0) run(async () => { await receiveStock(p.id, q); setQtyByPart((m) => ({ ...m, [p.id]: '' })); }); }} className="rounded border border-border-default px-1.5 py-1 text-[11px] text-muted hover:text-foreground disabled:opacity-50" title="Entrée en stock">+ Entrée</button>
                          <input type="number" value={adjByPart[p.id] ?? ''} onChange={(e) => setAdjByPart((m) => ({ ...m, [p.id]: e.target.value }))} placeholder="±" className={`${inputCls} w-14`} />
                          <button type="button" disabled={busy} onClick={() => { const d = Number.parseInt(adjByPart[p.id] || '0', 10); if (d) run(async () => { await adjustStock(p.id, d); setAdjByPart((m) => ({ ...m, [p.id]: '' })); }); }} className="rounded border border-border-default px-1.5 py-1 text-[11px] text-muted hover:text-foreground disabled:opacity-50" title="Ajustement">Ajuster</button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {editing ? (
                          <>
                            <button type="button" onClick={() => saveEdit(p.id)} disabled={busy} className="text-xs font-semibold text-emerald-600 hover:opacity-80">OK</button>
                            <button type="button" onClick={() => setEditingId(null)} className="ml-2 text-xs text-muted hover:text-foreground">Annuler</button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => { setEditingId(p.id); setEdit({ name: p.name, unit: p.unit ?? '', price: p.unitPriceCents != null ? String(p.unitPriceCents / 100) : '', reorderPoint: p.reorderPoint != null ? String(p.reorderPoint) : '' }); }} className="text-xs font-medium text-[color:var(--accent)] hover:underline">Modifier</button>
                            <button type="button" onClick={() => { if (confirm('Supprimer cette pièce ?')) run(() => deletePart(p.id)); }} disabled={busy} className="ml-2 text-xs text-[#b91c1c] hover:opacity-80 disabled:opacity-50">Suppr.</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
