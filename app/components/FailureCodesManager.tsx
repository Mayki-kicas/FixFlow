'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createFailureCode, deleteFailureCode } from '@/lib/actions/failure-codes';
import type { FailureCodeType } from '@prisma/client';

type Code = { id: string; type: string; label: string };

const COLUMNS: { type: FailureCodeType; title: string; placeholder: string }[] = [
  { type: 'FAILURE', title: 'Pannes / symptômes', placeholder: 'ex. Ne démarre pas' },
  { type: 'CAUSE', title: 'Causes', placeholder: 'ex. Fusible grillé' },
  { type: 'REMEDY', title: 'Remèdes', placeholder: 'ex. Remplacement fusible' },
];

export default function FailureCodesManager({ codes }: { codes: Code[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

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

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-xs text-[#b91c1c] dark:text-[#f87171]">{error}</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = codes.filter((c) => c.type === col.type);
          return (
            <div key={col.type} className="card">
              <div className="card-head"><span className="card-head-title">{col.title}</span><span className="badge badge-neutral">{list.length}</span></div>
              <div className="p-2 space-y-1">
                {list.length === 0 && <p className="px-1 py-1 text-xs text-muted">Aucun code.</p>}
                {list.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded px-1.5 py-1 hover:bg-surface-alt">
                    <span className="text-xs text-foreground">{c.label}</span>
                    <button type="button" onClick={() => run(() => deleteFailureCode(c.id))} disabled={busy} className="text-[11px] text-[#b91c1c] hover:opacity-80 disabled:opacity-50">×</button>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    value={draft[col.type] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [col.type]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && draft[col.type]?.trim()) run(async () => { await createFailureCode(col.type, draft[col.type]); setDraft((d) => ({ ...d, [col.type]: '' })); }); }}
                    placeholder={col.placeholder}
                    maxLength={120}
                    disabled={busy}
                    className="flex-1 rounded border border-border-default bg-surface px-2 py-1 text-xs text-foreground focus:border-[color:var(--accent)] focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={busy || !draft[col.type]?.trim()}
                    onClick={() => run(async () => { await createFailureCode(col.type, draft[col.type]); setDraft((d) => ({ ...d, [col.type]: '' })); })}
                    className="rounded bg-[color:var(--primary)] px-2 py-1 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
