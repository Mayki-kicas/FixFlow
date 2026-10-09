'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Location = {
  id: string;
  code: string;
  name: string;
};

type LocationStatsFilterProps = {
  locations: Location[];
  selectedIds: string[];
  periodKey: string;
  startDate?: string;
  endDate?: string;
  inline?: boolean;
};

export default function LocationStatsFilter({ locations, selectedIds, periodKey, startDate, endDate, inline = false }: LocationStatsFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedToAdd, setSelectedToAdd] = useState('');

  const locationLabelById = useMemo(() => {
    return new Map(locations.map((loc) => [loc.id, `${loc.code} - ${loc.name}`]));
  }, [locations]);

  const updateQuery = (nextIds: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', periodKey);
    if (startDate) {
      params.set('start', startDate);
    } else {
      params.delete('start');
    }
    if (endDate) {
      params.set('end', endDate);
    } else {
      params.delete('end');
    }
    if (nextIds.length > 0) {
      params.set('locations', nextIds.join(','));
    } else {
      params.delete('locations');
    }
    router.push(`?${params.toString()}`);
  };

  const handleAdd = () => {
    if (!selectedToAdd) return;
    if (selectedIds.includes(selectedToAdd)) return;
    updateQuery([...selectedIds, selectedToAdd]);
    setSelectedToAdd('');
  };

  const handleRemove = (id: string) => {
    updateQuery(selectedIds.filter((locId) => locId !== id));
  };

  const content = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedToAdd}
          onChange={(e) => setSelectedToAdd(e.target.value)}
          className="min-w-[220px] px-2.5 py-1.5 text-xs border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
        >
          <option value="">Sélectionner un site…</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.code} - {loc.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          className="px-2.5 py-1.5 text-xs font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] disabled:opacity-50 transition-colors duration-150 ease-out"
          disabled={!selectedToAdd}
        >
          + Ajouter
        </button>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => updateQuery([])}
            className="px-2.5 py-1.5 text-xs text-muted border border-border-default rounded-lg hover:bg-surface-alt hover:text-foreground transition-colors duration-150 ease-out"
          >
            Réinitialiser
          </button>
        )}
      </div>
      {selectedIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-border-default bg-surface-alt text-foreground"
            >
              {locationLabelById.get(id) || 'Inconnu'}
              <button
                type="button"
                onClick={() => handleRemove(id)}
                className="text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors"
                aria-label="Retirer"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="bg-white/70 dark:bg-[#121821]/70 border border-border-default rounded-xl p-3 backdrop-blur mb-4">
      <div className="section-band">
        <h2 className="section-band-title">Filtrer par localisation</h2>
        <span className="text-[11px] text-muted">
          {selectedIds.length > 0 ? `${selectedIds.length} site(s)` : 'Tous les sites'}
        </span>
      </div>
      <div className="mt-2">{content}</div>
    </div>
  );
}
