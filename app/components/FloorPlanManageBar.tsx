'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadFloorPlan, renameFloorPlan, deleteFloorPlan } from '@/lib/actions/floor-plans';

// Gestion des plans d'un centre (MANAGER/ADMIN) : ajout, renommage, suppression.
export default function FloorPlanManageBar({
  locationId,
  currentPlan,
}: {
  locationId: string;
  currentPlan: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(currentPlan?.name ?? '');

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !name.trim()) {
      setError('Nom d’étage et fichier requis');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('locationId', locationId);
      fd.append('name', name.trim());
      fd.append('file', file);
      await uploadFloorPlan(fd);
      setName('');
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload impossible');
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async () => {
    if (!currentPlan || !renameValue.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await renameFloorPlan(currentPlan.id, renameValue.trim());
      setRenaming(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Renommage impossible');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!currentPlan) return;
    if (!confirm(`Supprimer le plan « ${currentPlan.name} » ? Les équipements posés dessus seront détachés.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteFloorPlan(currentPlan.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'rounded border border-border-default bg-surface px-2 py-1 text-xs text-foreground focus:border-[color:var(--accent)] focus:outline-none';

  return (
    <div className="card p-3 space-y-2">
      {error && (
        <p role="alert" className="text-xs text-[#b91c1c] dark:text-[#f87171]">{error}</p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="field-label mb-0.5">Nouvel étage</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. RDC, Étage 1"
            maxLength={80}
            disabled={busy}
            className={`${inputCls} w-36`}
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".dwg,.svg,.pdf,.png,.jpg,.jpeg,image/svg+xml,application/pdf,image/png,image/jpeg"
          disabled={busy}
          className="text-xs text-muted file:mr-2 file:rounded file:border-0 file:bg-surface-alt file:px-2 file:py-1 file:text-xs file:font-medium file:text-foreground"
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={busy}
          className="rounded bg-[color:var(--primary)] px-3 py-1 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50"
        >
          {busy ? 'Envoi…' : 'Ajouter le plan'}
        </button>

        {currentPlan && (
          <div className="ml-auto flex items-center gap-2">
            {renaming ? (
              <>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  maxLength={80}
                  disabled={busy}
                  className={`${inputCls} w-32`}
                />
                <button type="button" onClick={handleRename} disabled={busy} className="text-xs font-semibold text-emerald-600 hover:opacity-80">
                  OK
                </button>
                <button type="button" onClick={() => setRenaming(false)} className="text-xs text-muted hover:text-foreground">
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setRenameValue(currentPlan.name);
                    setRenaming(true);
                  }}
                  className="text-xs text-muted hover:text-foreground"
                >
                  Renommer
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="text-xs font-medium text-[#b91c1c] hover:opacity-80 disabled:opacity-50"
                >
                  Supprimer ce plan
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted">
        Formats : DWG (converti), SVG, PDF, PNG, JPEG. Le SVG offre le meilleur rendu au zoom.
      </p>
    </div>
  );
}
