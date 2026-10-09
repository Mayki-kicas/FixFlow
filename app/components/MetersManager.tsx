'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createMeter, deleteMeter, addMeterReading } from '@/lib/actions/meters';

type Meter = {
  id: string;
  name: string;
  unit: string;
  readings: { value: number; readAt: Date }[];
};

export default function MetersManager({ equipmentId, meters }: { equipmentId: string; meters: Meter[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [readingByMeter, setReadingByMeter] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const addMeter = async () => {
    if (!name.trim() || !unit.trim()) {
      setError('Nom et unité requis');
      return;
    }
    await run(async () => {
      await createMeter(equipmentId, name.trim(), unit.trim());
      setName('');
      setUnit('');
    });
  };

  const addReading = async (meterId: string) => {
    const raw = (readingByMeter[meterId] ?? '').replace(',', '.');
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return;
    await run(async () => {
      await addMeterReading(meterId, value);
      setReadingByMeter((prev) => ({ ...prev, [meterId]: '' }));
    });
  };

  const inputCls = 'rounded border border-border-default bg-surface px-2 py-1 text-xs text-foreground focus:border-[color:var(--accent)] focus:outline-none';

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-xs text-[#b91c1c] dark:text-[#f87171]">{error}</p>}

      {meters.length === 0 ? (
        <p className="text-xs text-muted">Aucun compteur.</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border-default)] rounded-lg border border-border-default">
          {meters.map((m) => {
            const latest = m.readings[0];
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-2 px-2.5 py-1.5">
                <span className="text-xs font-medium text-foreground">{m.name}</span>
                <span className="text-[10px] text-muted">({m.unit})</span>
                <span className="text-xs text-muted tabular-nums">
                  {latest ? `${latest.value} ${m.unit} · ${new Date(latest.readAt).toLocaleDateString('fr-FR')}` : 'aucun relevé'}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <input
                    type="number"
                    step="any"
                    value={readingByMeter[m.id] ?? ''}
                    onChange={(e) => setReadingByMeter((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    placeholder="relevé"
                    disabled={busy}
                    className={`${inputCls} w-24`}
                  />
                  <button type="button" onClick={() => addReading(m.id)} disabled={busy} className="rounded bg-[color:var(--primary)] px-2 py-1 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50">
                    Relever
                  </button>
                  <button type="button" onClick={() => { if (confirm('Supprimer ce compteur ?')) run(() => deleteMeter(m.id)); }} disabled={busy} className="text-[11px] text-[#b91c1c] hover:opacity-80 disabled:opacity-50">
                    Suppr.
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="field-label mb-0.5">Nouveau compteur</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Heures de fonctionnement" disabled={busy} className={`${inputCls} w-52`} />
        </div>
        <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unité (h, km, cycles)" disabled={busy} className={`${inputCls} w-36`} />
        <button type="button" onClick={addMeter} disabled={busy} className="rounded bg-[color:var(--primary)] px-3 py-1 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50">
          Ajouter
        </button>
      </div>
    </div>
  );
}
