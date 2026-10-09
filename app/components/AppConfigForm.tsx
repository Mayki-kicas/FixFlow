'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateAppConfig } from '@/lib/actions/app-config';
import { FIRST_RESPONSE_HOURS_MIN, FIRST_RESPONSE_HOURS_MAX } from '@/lib/app-config';
import { CheckIcon } from '@/components/icons';

// Réglages globaux (ADMIN) : délai de prise en charge + taux horaire de main d'œuvre.
export default function AppConfigForm({
  firstResponseHours,
  laborRateCents,
}: {
  firstResponseHours: number;
  laborRateCents: number | null;
}) {
  const router = useRouter();
  const [hours, setHours] = useState(String(firstResponseHours));
  const [rate, setRate] = useState(laborRateCents != null ? String(laborRateCents / 100) : '');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setLoading(true);
    setSaved(false);
    setError(null);
    try {
      const rateTrimmed = rate.trim();
      const laborRateCentsValue =
        rateTrimmed === '' ? null : Math.round(Number.parseFloat(rateTrimmed.replace(',', '.')) * 100);
      await updateAppConfig({
        firstResponseHours: Number.parseInt(hours, 10),
        laborRateCents: laborRateCentsValue,
      });
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-32 px-2 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out';

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="firstResponseHours" className="block text-xs font-medium text-foreground mb-1">
          Délai de prise en charge (triage)
        </label>
        <p className="text-[11px] text-muted mb-1.5">
          Temps cible pour qualifier un nouveau ticket. Au-delà, le ticket est signalé « en retard de prise en charge ».
        </p>
        <div className="flex items-center gap-2">
          <input
            id="firstResponseHours"
            type="number"
            min={FIRST_RESPONSE_HOURS_MIN}
            max={FIRST_RESPONSE_HOURS_MAX}
            value={hours}
            onChange={(e) => {
              setHours(e.target.value);
              setSaved(false);
            }}
            className={inputCls}
          />
          <span className="text-sm text-muted">heure(s)</span>
        </div>
      </div>

      <div>
        <label htmlFor="laborRate" className="block text-xs font-medium text-foreground mb-1">
          Taux horaire de main d&apos;œuvre interne
        </label>
        <p className="text-[11px] text-muted mb-1.5">
          Sert à valoriser le temps passé sur les OT. Laisser vide = temps suivi mais non chiffré.
        </p>
        <div className="flex items-center gap-2">
          <input
            id="laborRate"
            type="number"
            min={0}
            step="0.01"
            value={rate}
            onChange={(e) => {
              setRate(e.target.value);
              setSaved(false);
            }}
            placeholder="ex. 45"
            className={inputCls}
          />
          <span className="text-sm text-muted">€ / heure</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="rounded bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50"
        >
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
            <CheckIcon className="h-3 w-3" /> Enregistré
          </span>
        )}
      </div>
    </div>
  );
}
