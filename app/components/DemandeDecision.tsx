'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Priority } from '@prisma/client';
import { convertDemandeToTicket, rejectDemande } from '@/lib/actions/demandes';
import { PRIORITIES, PRIORITY_META } from '@/lib/priority';

type EquipmentOption = { id: string; name: string; refCode: string; teamName: string };

// Décision manager sur une demande : valider (choix équipement + priorité -> ticket) ou rejeter (motif).
export default function DemandeDecision({
  demandeId,
  equipments,
}: {
  demandeId: string;
  equipments: EquipmentOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'convert' | 'reject'>(null);
  const [equipmentId, setEquipmentId] = useState('');
  const [priority, setPriority] = useState<'' | Priority>('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const doConvert = async () => {
    if (!equipmentId) return;
    setLoading(true);
    try {
      const res = await convertDemandeToTicket(demandeId, equipmentId, priority || undefined);
      router.push(`/tickets/${res.ticketId}`);
    } catch (error) {
      console.error('Conversion demande impossible:', error);
      alert('Impossible de valider la demande');
      setLoading(false);
    }
  };

  const doReject = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await rejectDemande(demandeId, reason);
      router.refresh();
    } catch (error) {
      console.error('Rejet demande impossible:', error);
      alert('Impossible de rejeter la demande');
      setLoading(false);
    }
  };

  const inputCls =
    'w-full rounded border border-border-default bg-surface px-2 py-1.5 text-sm text-foreground focus:border-[color:var(--accent)] focus:outline-none';

  if (mode === 'convert') {
    return (
      <div className="space-y-2 rounded-lg border border-border-default bg-surface-alt p-3">
        <p className="text-xs font-semibold text-foreground">Valider et créer le ticket</p>
        <div>
          <label className="block text-[11px] text-muted mb-1">Équipement / équipe concernés *</label>
          <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} disabled={loading} className={inputCls}>
            <option value="">— Choisir un équipement —</option>
            {equipments.map((eq) => (
              <option key={eq.id} value={eq.id}>{eq.name} ({eq.refCode}) — {eq.teamName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-muted mb-1">Priorité</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value as '' | Priority)} disabled={loading} className={inputCls}>
            <option value="">Automatique (selon l&apos;équipement)</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_META[p].short} — {PRIORITY_META[p].label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <button type="button" onClick={doConvert} disabled={loading || !equipmentId} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            Créer le ticket
          </button>
          <button type="button" onClick={() => setMode(null)} disabled={loading} className="rounded border border-border-default px-3 py-1.5 text-xs text-muted hover:text-foreground disabled:opacity-50">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'reject') {
    return (
      <div className="space-y-2 rounded-lg border border-border-default bg-surface-alt p-3">
        <p className="text-xs font-semibold text-foreground">Rejeter la demande</p>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motif du rejet (obligatoire)"
          maxLength={300}
          disabled={loading}
          className={inputCls}
        />
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={doReject} disabled={loading || !reason.trim()} className="rounded bg-[#dc2626] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
            Confirmer le rejet
          </button>
          <button type="button" onClick={() => setMode(null)} disabled={loading} className="rounded border border-border-default px-3 py-1.5 text-xs text-muted hover:text-foreground disabled:opacity-50">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setMode('convert')} className="rounded bg-[color:var(--primary)] px-3 py-1.5 text-sm font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)]">
        Valider → ticket
      </button>
      <button type="button" onClick={() => setMode('reject')} className="rounded border border-border-default px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground">
        Rejeter
      </button>
    </div>
  );
}
