'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createMaintenancePlan,
  updateMaintenancePlan,
  deleteMaintenancePlan,
  setMaintenancePlanActive,
  generatePreventiveNow,
} from '@/lib/actions/maintenance';
import { PRIORITIES, PRIORITY_META } from '@/lib/priority';
import type { Priority } from '@prisma/client';

type Plan = {
  id: string;
  name: string;
  trigger: 'CALENDAR' | 'METER';
  intervalDays: number | null;
  leadTimeDays: number;
  meterInterval: number | null;
  lastGeneratedMeterValue: number | null;
  isRegulatory: boolean;
  active: boolean;
  nextDueAt: Date | null;
  lastGeneratedAt: Date | null;
  priority: Priority | null;
  equipment: { id: string; name: string; refCode: string };
  meter: { id: string; name: string; unit: string; readings: { value: number }[] } | null;
  team: { id: string; name: string } | null;
  maintainer: { id: string; name: string } | null;
  tasks: { label: string; order: number }[];
  _count: { tickets: number };
};

type Option = { id: string; name: string; refCode?: string };
type MeterOption = { id: string; name: string; unit: string; equipmentId: string };

function toYmd(d: Date): string {
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
}
function ymdToDate(v: string): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

type FormState = {
  name: string;
  equipmentId: string;
  trigger: 'CALENDAR' | 'METER';
  intervalDays: string;
  leadTimeDays: string;
  dueDate: string;
  meterId: string;
  meterInterval: string;
  isRegulatory: boolean;
  priority: '' | Priority;
  teamId: string;
  maintainerId: string;
  tasks: string[];
};

const emptyForm: FormState = {
  name: '',
  equipmentId: '',
  trigger: 'CALENDAR',
  intervalDays: '182',
  leadTimeDays: '14',
  dueDate: '',
  meterId: '',
  meterInterval: '',
  isRegulatory: false,
  priority: '',
  teamId: '',
  maintainerId: '',
  tasks: [''],
};

export default function MaintenancePlanManager({
  plans,
  equipments,
  teams,
  maintainers,
  meters,
}: {
  plans: Plan[];
  equipments: Option[];
  teams: Option[];
  maintainers: Option[];
  meters: MeterOption[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null); // null = fermé, 'new' = création
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genMsg, setGenMsg] = useState<string | null>(null);

  const inputCls =
    'w-full rounded border border-border-default bg-surface px-2 py-1.5 text-sm text-foreground focus:border-[color:var(--accent)] focus:outline-none';

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId('new');
    setError(null);
  };
  const openEdit = (p: Plan) => {
    setForm({
      name: p.name,
      equipmentId: p.equipment.id,
      trigger: p.trigger,
      intervalDays: p.intervalDays != null ? String(p.intervalDays) : '182',
      leadTimeDays: String(p.leadTimeDays),
      dueDate: p.nextDueAt ? toYmd(p.nextDueAt) : '',
      meterId: p.meter?.id ?? '',
      meterInterval: p.meterInterval != null ? String(p.meterInterval) : '',
      isRegulatory: p.isRegulatory,
      priority: p.priority ?? '',
      teamId: p.team?.id ?? '',
      maintainerId: p.maintainer?.id ?? '',
      tasks: p.tasks.length ? p.tasks.map((t) => t.label) : [''],
    });
    setEditingId(p.id);
    setError(null);
  };

  const save = async () => {
    if (!form.name.trim() || !form.equipmentId) {
      setError('Nom et équipement requis');
      return;
    }
    const common = {
      name: form.name,
      equipmentId: form.equipmentId,
      isRegulatory: form.isRegulatory,
      priority: form.priority || null,
      teamId: form.teamId || null,
      maintainerId: form.maintainerId || null,
      tasks: form.tasks.map((label, order) => ({ label, order })),
    };

    const due = ymdToDate(form.dueDate);
    const meterInterval = Number.parseFloat((form.meterInterval || '').replace(',', '.'));

    if (form.trigger === 'CALENDAR' && !due) {
      setError('Échéance requise pour un plan calendaire');
      return;
    }
    if (form.trigger === 'METER' && (!form.meterId || !(meterInterval > 0))) {
      setError('Compteur et intervalle (> 0) requis pour un plan par compteur');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (editingId === 'new') {
        if (form.trigger === 'METER') {
          await createMaintenancePlan({ ...common, trigger: 'METER', meterId: form.meterId, meterInterval });
        } else {
          await createMaintenancePlan({
            ...common,
            trigger: 'CALENDAR',
            intervalDays: Number.parseInt(form.intervalDays, 10),
            leadTimeDays: Number.parseInt(form.leadTimeDays || '0', 10),
            firstDueAt: due,
          });
        }
      } else if (editingId) {
        if (form.trigger === 'METER') {
          await updateMaintenancePlan({ id: editingId, ...common, meterInterval });
        } else {
          await updateMaintenancePlan({
            id: editingId,
            ...common,
            intervalDays: Number.parseInt(form.intervalDays, 10),
            leadTimeDays: Number.parseInt(form.leadTimeDays || '0', 10),
            nextDueAt: due ?? undefined,
          });
        }
      }
      setEditingId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (fn: () => Promise<unknown>) => {
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

  const generate = async () => {
    setBusy(true);
    setGenMsg(null);
    try {
      const res = await generatePreventiveNow();
      setGenMsg(res.generated > 0 ? `${res.generated} ordre(s) de travail généré(s).` : 'Aucune échéance due pour le moment.');
      router.refresh();
    } catch (e) {
      setGenMsg(e instanceof Error ? e.message : 'Génération impossible');
    } finally {
      setBusy(false);
    }
  };

  const now = Date.now();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {editingId === null && (
          <button type="button" onClick={openCreate} className="rounded bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)]">
            + Nouveau plan
          </button>
        )}
        <button type="button" onClick={generate} disabled={busy} className="rounded border border-border-default px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50">
          Générer les OT dus maintenant
        </button>
        {genMsg && <span className="text-[11px] text-muted">{genMsg}</span>}
      </div>

      {editingId !== null && (
        <div className="card p-3 space-y-2.5">
          {error && <p role="alert" className="text-xs text-[#b91c1c] dark:text-[#f87171]">{error}</p>}
          <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">
            {editingId === 'new' ? 'Nouveau plan' : 'Modifier le plan'}
          </p>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <div>
              <label className="field-label mb-0.5">Nom *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="ex. Contrôle semestriel ascenseur" />
            </div>
            <div>
              <label className="field-label mb-0.5">Équipement *</label>
              <select value={form.equipmentId} onChange={(e) => setForm({ ...form, equipmentId: e.target.value })} className={inputCls}>
                <option value="">— Choisir —</option>
                {equipments.map((eq) => (
                  <option key={eq.id} value={eq.id}>{eq.name} ({eq.refCode})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label mb-0.5">Déclencheur</label>
              <select value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value as 'CALENDAR' | 'METER' })} disabled={editingId !== 'new'} className={inputCls}>
                <option value="CALENDAR">Calendaire (périodicité)</option>
                <option value="METER">Compteur (usage)</option>
              </select>
              {editingId !== 'new' && <p className="mt-0.5 text-[10px] text-muted">Le type ne se change pas après création.</p>}
            </div>

            {form.trigger === 'CALENDAR' ? (
              <>
                <div>
                  <label className="field-label mb-0.5">Périodicité (jours) *</label>
                  <input type="number" min={1} value={form.intervalDays} onChange={(e) => setForm({ ...form, intervalDays: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="field-label mb-0.5">Anticipation (jours avant)</label>
                  <input type="number" min={0} value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="field-label mb-0.5">{editingId === 'new' ? 'Première échéance *' : 'Prochaine échéance *'}</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputCls} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="field-label mb-0.5">Compteur *</label>
                  <select value={form.meterId} onChange={(e) => setForm({ ...form, meterId: e.target.value })} disabled={editingId !== 'new'} className={inputCls}>
                    <option value="">— Choisir —</option>
                    {meters.filter((m) => m.equipmentId === form.equipmentId).map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                    ))}
                  </select>
                  {form.equipmentId && meters.filter((m) => m.equipmentId === form.equipmentId).length === 0 && (
                    <p className="mt-0.5 text-[10px] text-[#b45309] dark:text-[#f59e0b]">Aucun compteur sur cet équipement (à créer sur sa fiche).</p>
                  )}
                </div>
                <div>
                  <label className="field-label mb-0.5">Intervalle (unités du compteur) *</label>
                  <input type="number" min={0} step="any" value={form.meterInterval} onChange={(e) => setForm({ ...form, meterInterval: e.target.value })} className={inputCls} placeholder="ex. 500" />
                </div>
              </>
            )}
            <div>
              <label className="field-label mb-0.5">Priorité des OT</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as '' | Priority })} className={inputCls}>
                <option value="">Automatique</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{PRIORITY_META[p].short} — {PRIORITY_META[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label mb-0.5">Équipe (sinon celle de l&apos;équipement)</label>
              <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })} className={inputCls}>
                <option value="">— Par défaut —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label mb-0.5">Prestataire (optionnel)</label>
              <select value={form.maintainerId} onChange={(e) => setForm({ ...form, maintainerId: e.target.value })} className={inputCls}>
                <option value="">— Aucun —</option>
                {maintainers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={form.isRegulatory} onChange={(e) => setForm({ ...form, isRegulatory: e.target.checked })} className="accent-[color:var(--accent)]" />
            Contrôle réglementaire obligatoire
          </label>

          <div>
            <label className="field-label mb-1">Check-list (tâches)</label>
            <div className="space-y-1">
              {form.tasks.map((task, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={task}
                    onChange={(e) => setForm({ ...form, tasks: form.tasks.map((t, j) => (j === i ? e.target.value : t)) })}
                    placeholder={`Tâche ${i + 1}`}
                    className={inputCls}
                  />
                  <button type="button" onClick={() => setForm({ ...form, tasks: form.tasks.filter((_, j) => j !== i) })} className="flex-shrink-0 text-xs text-muted hover:text-[#b91c1c]">
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setForm({ ...form, tasks: [...form.tasks, ''] })} className="text-xs font-medium text-[color:var(--accent)] hover:opacity-80">
                + Ajouter une tâche
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={save} disabled={busy} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" onClick={() => setEditingId(null)} className="rounded border border-border-default px-3 py-1.5 text-xs text-muted hover:text-foreground">
              Annuler
            </button>
          </div>
        </div>
      )}

      {plans.length === 0 ? (
        <p className="text-sm text-muted">Aucun plan de maintenance préventive.</p>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border-default)]">
              <thead className="bg-surface-alt">
                <tr>
                  <th className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted">Plan</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted">Équipement</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted">Périodicité</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted">Prochaine échéance</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted">OT</th>
                  <th className="px-3 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-default)]">
                {plans.map((p) => {
                  const isMeter = p.trigger === 'METER';
                  const dueMs = p.nextDueAt ? new Date(p.nextDueAt).getTime() : null;
                  const overdue = !isMeter && dueMs != null && dueMs < now;
                  const soon = !isMeter && dueMs != null && !overdue && dueMs < now + p.leadTimeDays * 86400000;
                  const currentReading = p.meter?.readings[0]?.value;
                  const nextThreshold = p.meterInterval != null ? (p.lastGeneratedMeterValue ?? 0) + p.meterInterval : null;
                  return (
                    <tr key={p.id} className="hover:bg-surface-alt">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground">{p.name}</span>
                          <span className="badge badge-neutral">{isMeter ? 'Compteur' : 'Calendaire'}</span>
                          {p.isRegulatory && <span className="badge badge-warn">Réglementaire</span>}
                          {!p.active && <span className="badge badge-neutral">En pause</span>}
                        </div>
                        <div className="text-[10px] text-muted">{p.tasks.length} tâche(s)</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted">{p.equipment.name} <span className="font-mono">({p.equipment.refCode})</span></td>
                      <td className="px-3 py-2 text-xs text-muted tabular-nums">
                        {isMeter ? `${p.meterInterval ?? '—'} ${p.meter?.unit ?? ''}` : `${p.intervalDays ?? '—'} j`}
                      </td>
                      <td className="px-3 py-2">
                        {isMeter ? (
                          <span className="text-xs text-foreground tabular-nums">
                            {currentReading != null ? `${currentReading} ${p.meter?.unit ?? ''}` : '— relevé'}
                            {nextThreshold != null ? ` / ${nextThreshold}` : ''}
                          </span>
                        ) : (
                          <span className={`text-xs tabular-nums ${overdue ? 'font-semibold text-[#b91c1c] dark:text-[#f87171]' : soon ? 'font-medium text-[#b45309] dark:text-[#f59e0b]' : 'text-foreground'}`}>
                            {p.nextDueAt ? new Date(p.nextDueAt).toLocaleDateString('fr-FR') : '—'}
                            {overdue ? ' · en retard' : soon ? ' · bientôt' : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted tabular-nums">{p._count.tickets}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button type="button" onClick={() => openEdit(p)} className="text-xs font-medium text-[color:var(--accent)] hover:underline">Modifier</button>
                        <button type="button" onClick={() => runAction(() => setMaintenancePlanActive(p.id, !p.active))} disabled={busy} className="ml-2 text-xs text-muted hover:text-foreground disabled:opacity-50">
                          {p.active ? 'Mettre en pause' : 'Réactiver'}
                        </button>
                        <button type="button" onClick={() => { if (confirm('Supprimer ce plan ?')) runAction(() => deleteMaintenancePlan(p.id)); }} disabled={busy} className="ml-2 text-xs text-[#b91c1c] hover:opacity-80 disabled:opacity-50">
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
