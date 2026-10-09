'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setTicketDiagnosis } from '@/lib/actions/failure-codes';

type Code = { id: string; type: string; label: string };
type Current = { failureCodeId: string | null; causeCodeId: string | null; remedyCodeId: string | null };

const ROWS: { key: keyof Current; type: string; label: string }[] = [
  { key: 'failureCodeId', type: 'FAILURE', label: 'Panne' },
  { key: 'causeCodeId', type: 'CAUSE', label: 'Cause' },
  { key: 'remedyCodeId', type: 'REMEDY', label: 'Remède' },
];

export default function TicketDiagnosis({
  ticketId,
  codes,
  current,
  canEdit,
}: {
  ticketId: string;
  codes: Code[];
  current: Current;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const change = async (key: keyof Current, value: string) => {
    setBusy(true);
    try {
      await setTicketDiagnosis(ticketId, { [key]: value || null });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setBusy(false);
    }
  };

  const labelOf = (id: string | null) => codes.find((c) => c.id === id)?.label ?? '—';

  return (
    <div className="card">
      <div className="card-head"><span className="card-head-title">Diagnostic</span></div>
      <div className="p-3 space-y-2">
        {ROWS.map((row) => (
          <div key={row.key} className="data-row">
            <span className="field-label">{row.label}</span>
            {canEdit ? (
              <select
                value={current[row.key] ?? ''}
                onChange={(e) => change(row.key, e.target.value)}
                disabled={busy}
                className="w-40 rounded border border-border-default bg-surface px-2 py-1 text-xs text-foreground focus:border-[color:var(--accent)] focus:outline-none disabled:opacity-50"
              >
                <option value="">—</option>
                {codes.filter((c) => c.type === row.type).map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            ) : (
              <span className="field-value">{labelOf(current[row.key])}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
