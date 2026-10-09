'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createContract, updateContract, deleteContract } from '@/lib/actions/contracts';
import { formatEuros } from '@/lib/costs-core';

type Contract = {
  id: string;
  name: string;
  scope: string | null;
  slaTerms: string | null;
  startAt: Date | null;
  endAt: Date | null;
  costCents: number | null;
  active: boolean;
};

function toYmd(d: Date | null): string {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
}
function ymdToDate(v: string): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

const empty = { name: '', scope: '', slaTerms: '', startAt: '', endAt: '', cost: '', active: true };

export default function ContractsManager({ maintainerId, contracts }: { maintainerId: string; contracts: Contract[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls = 'w-full rounded border border-border-default bg-surface px-2 py-1.5 text-sm text-foreground focus:border-[color:var(--accent)] focus:outline-none';

  const openCreate = () => { setForm(empty); setEditingId('new'); setError(null); };
  const openEdit = (c: Contract) => {
    setForm({ name: c.name, scope: c.scope ?? '', slaTerms: c.slaTerms ?? '', startAt: toYmd(c.startAt), endAt: toYmd(c.endAt), cost: c.costCents != null ? String(c.costCents / 100) : '', active: c.active });
    setEditingId(c.id);
    setError(null);
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Nom requis'); return; }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        scope: form.scope || null,
        slaTerms: form.slaTerms || null,
        startAt: ymdToDate(form.startAt),
        endAt: ymdToDate(form.endAt),
        costCents: form.cost.trim() ? Math.round(Number.parseFloat(form.cost.replace(',', '.')) * 100) : null,
        active: form.active,
      };
      if (editingId === 'new') await createContract(maintainerId, payload);
      else if (editingId) await updateContract(editingId, payload);
      setEditingId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); router.refresh(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Action impossible'); }
    finally { setBusy(false); }
  };

  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

  return (
    <div className="space-y-2">
      {error && <p role="alert" className="text-xs text-[#b91c1c] dark:text-[#f87171]">{error}</p>}

      {editingId === null && (
        <button type="button" onClick={openCreate} className="rounded bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)]">
          + Nouveau contrat
        </button>
      )}

      {editingId !== null && (
        <div className="rounded-lg border border-border-default p-3 space-y-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div><label className="field-label mb-0.5">Nom *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="ex. Contrat ascenseurs 2026" /></div>
            <div><label className="field-label mb-0.5">Périmètre</label><input value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className={inputCls} placeholder="ex. Tous ascenseurs" /></div>
            <div><label className="field-label mb-0.5">Début</label><input type="date" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className={inputCls} /></div>
            <div><label className="field-label mb-0.5">Fin</label><input type="date" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} className={inputCls} /></div>
            <div><label className="field-label mb-0.5">Coût annuel (€ HT)</label><input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className={inputCls} /></div>
            <div className="flex items-end"><label className="flex items-center gap-2 text-xs text-foreground"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[color:var(--accent)]" /> Actif</label></div>
          </div>
          <div><label className="field-label mb-0.5">SLA contractuels</label><textarea value={form.slaTerms} onChange={(e) => setForm({ ...form, slaTerms: e.target.value })} rows={2} className={`${inputCls} resize-none`} placeholder="ex. Intervention sous 4h, dépannage 24/7…" /></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={save} disabled={busy} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Enregistrer</button>
            <button type="button" onClick={() => setEditingId(null)} className="rounded border border-border-default px-3 py-1.5 text-xs text-muted hover:text-foreground">Annuler</button>
          </div>
        </div>
      )}

      {contracts.length === 0 ? (
        <p className="text-xs text-muted">Aucun contrat.</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border-default)] rounded-lg border border-border-default">
          {contracts.map((c) => (
            <li key={c.id} className="px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{c.name}</span>
                {!c.active && <span className="badge badge-neutral">Inactif</span>}
                {c.costCents != null && <span className="text-[10px] text-muted tabular-nums">{formatEuros(c.costCents)}/an</span>}
                <div className="ml-auto flex items-center gap-2">
                  <button type="button" onClick={() => openEdit(c)} className="text-xs font-medium text-[color:var(--accent)] hover:underline">Modifier</button>
                  <button type="button" onClick={() => { if (confirm('Supprimer ce contrat ?')) run(() => deleteContract(c.id)); }} disabled={busy} className="text-xs text-[#b91c1c] hover:opacity-80 disabled:opacity-50">Suppr.</button>
                </div>
              </div>
              <div className="mt-0.5 text-[10px] text-muted">
                {c.scope ? `${c.scope} · ` : ''}{fmt(c.startAt)} → {fmt(c.endAt)}
                {c.slaTerms ? ` · SLA : ${c.slaTerms}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
