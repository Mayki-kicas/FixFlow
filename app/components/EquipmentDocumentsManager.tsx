'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadEquipmentDocument, deleteEquipmentDocument } from '@/lib/actions/equipments';
import { PaperclipIcon, WarningIcon } from '@/components/icons';

type Doc = {
  id: string;
  fileName: string;
  type: string;
  label: string | null;
  expiryAt: Date | null;
  createdAt: Date;
};

const DOC_TYPES = [
  { value: 'MANUAL', label: 'Manuel' },
  { value: 'SCHEMA', label: 'Schéma' },
  { value: 'CERTIFICATE', label: 'Certificat' },
  { value: 'OTHER', label: 'Autre' },
];

const typeLabel = (t: string) => DOC_TYPES.find((d) => d.value === t)?.label ?? 'Autre';

export default function EquipmentDocumentsManager({
  equipmentId,
  documents,
}: {
  equipmentId: string;
  documents: Doc[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState('MANUAL');
  const [label, setLabel] = useState('');
  const [expiryAt, setExpiryAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Fichier requis');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('equipmentId', equipmentId);
      fd.append('type', type);
      if (label.trim()) fd.append('label', label.trim());
      if (expiryAt) fd.append('expiryAt', expiryAt);
      fd.append('file', file);
      await uploadEquipmentDocument(fd);
      setLabel('');
      setExpiryAt('');
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload impossible');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer ce document ?')) return;
    setBusy(true);
    try {
      await deleteEquipmentDocument(id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'rounded border border-border-default bg-surface px-2 py-1 text-xs text-foreground focus:border-[color:var(--accent)] focus:outline-none';

  const now = Date.now();

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-xs text-[#b91c1c] dark:text-[#f87171]">{error}</p>}

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="field-label mb-0.5">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={busy} className={inputCls}>
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label mb-0.5">Libellé (optionnel)</label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} disabled={busy} className={`${inputCls} w-40`} />
        </div>
        <div>
          <label className="field-label mb-0.5">Expiration (certificat)</label>
          <input type="date" value={expiryAt} onChange={(e) => setExpiryAt(e.target.value)} disabled={busy} className={inputCls} />
        </div>
        <input
          ref={fileRef}
          type="file"
          disabled={busy}
          className="text-xs text-muted file:mr-2 file:rounded file:border-0 file:bg-surface-alt file:px-2 file:py-1 file:text-xs file:font-medium file:text-foreground"
        />
        <button
          type="button"
          onClick={upload}
          disabled={busy}
          className="rounded bg-[color:var(--primary)] px-3 py-1 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50"
        >
          {busy ? 'Envoi…' : 'Ajouter'}
        </button>
      </div>

      {documents.length === 0 ? (
        <p className="text-xs text-muted">Aucun document.</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border-default)] rounded-lg border border-border-default">
          {documents.map((doc) => {
            const expired = doc.expiryAt && new Date(doc.expiryAt).getTime() < now;
            return (
              <li key={doc.id} className="flex items-center gap-2 px-2.5 py-1.5">
                <PaperclipIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
                <a
                  href={`/api/equipment-documents/${doc.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate text-xs font-medium text-foreground hover:text-[color:var(--accent)]"
                >
                  {doc.label || doc.fileName}
                </a>
                <span className="badge badge-neutral flex-shrink-0">{typeLabel(doc.type)}</span>
                {doc.expiryAt && (
                  <span className={`flex-shrink-0 text-[10px] tabular-nums ${expired ? 'inline-flex items-center gap-1 font-semibold text-[#b91c1c] dark:text-[#f87171]' : 'text-muted'}`}>
                    {expired && <WarningIcon className="h-3 w-3" />}
                    exp. {new Date(doc.expiryAt).toLocaleDateString('fr-FR')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(doc.id)}
                  disabled={busy}
                  className="ml-auto flex-shrink-0 text-[11px] font-medium text-[#b91c1c] hover:opacity-80 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
