'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setLocationManagers } from '@/lib/actions/locations';
import { CheckIcon } from '@/components/icons';

type ManagerOption = { id: string; displayName: string; email: string };

// Assigne les managers responsables d'un site (valideurs de ses demandes). ADMIN only.
export default function LocationManagersManager({
  locationId,
  allManagers,
  currentManagerIds,
}: {
  locationId: string;
  allManagers: ManagerOption[];
  currentManagerIds: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(currentManagerIds));
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (id: string) => {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setLoading(true);
    setSaved(false);
    try {
      await setLocationManagers(locationId, [...selected]);
      setSaved(true);
      router.refresh();
    } catch (error) {
      console.error('Enregistrement des responsables impossible:', error);
      alert('Impossible d\'enregistrer les responsables');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted">
        Les responsables reçoivent les demandes de ce site et décident de les valider (→ ticket) ou de les rejeter.
      </p>

      {allManagers.length === 0 ? (
        <p className="text-xs text-muted">Aucun utilisateur avec le rôle Manager.</p>
      ) : (
        <div className="space-y-1.5">
          {allManagers.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-2 rounded-lg bg-surface-alt px-2 py-1.5 cursor-pointer hover:bg-surface"
            >
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggle(m.id)}
                disabled={loading}
                className="accent-[color:var(--accent)]"
              />
              <span className="text-xs font-medium text-foreground">{m.displayName}</span>
              <span className="text-[10px] text-muted">{m.email}</span>
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="rounded bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50"
        >
          {loading ? 'Enregistrement…' : 'Enregistrer les responsables'}
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
