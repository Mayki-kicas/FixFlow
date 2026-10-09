'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createStatus, updateStatus, deleteStatus, moveStatusUp, moveStatusDown } from '@/lib/actions/teams';

type Status = {
  id: string;
  name: string;
  color: string | null;
  order: number;
  isFinal: boolean;
  _count?: {
    tickets: number;
  };
};

type TeamStatusManagerProps = {
  teamId: string;
  statuses: Status[];
};

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];

const inputClass = "flex-1 px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out";

export default function TeamStatusManager({ teamId, statuses }: TeamStatusManagerProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState({ name: '', color: DEFAULT_COLORS[0], isFinal: false });
  const [editStatus, setEditStatus] = useState({ name: '', color: '', isFinal: false });
  const [error, setError] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const handleAddStatus = async () => {
    if (!newStatus.name.trim()) return;
    setError(null);
    try {
      await createStatus({ teamId, name: newStatus.name, color: newStatus.color, isFinal: newStatus.isFinal });
      setNewStatus({ name: '', color: DEFAULT_COLORS[0], isFinal: false });
      setIsAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    }
  };

  const handleUpdateStatus = async (statusId: string) => {
    if (!editStatus.name.trim()) return;
    setError(null);
    try {
      await updateStatus({ id: statusId, name: editStatus.name, color: editStatus.color, isFinal: editStatus.isFinal });
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    }
  };

  const handleDeleteStatus = async (statusId: string, ticketCount: number) => {
    if (ticketCount > 0) {
      setError(`Ce statut est utilisé par ${ticketCount} ticket(s). Supprimez ou modifiez ces tickets d'abord.`);
      return;
    }
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce statut ?')) return;
    setError(null);
    try {
      await deleteStatus(statusId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  const handleMoveUp = async (statusId: string) => {
    setIsReordering(true);
    setError(null);
    try { await moveStatusUp(statusId); router.refresh(); } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); } finally { setIsReordering(false); }
  };

  const handleMoveDown = async (statusId: string) => {
    setIsReordering(true);
    setError(null);
    try { await moveStatusDown(statusId); router.refresh(); } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); } finally { setIsReordering(false); }
  };

  const startEditing = (status: Status) => {
    setEditingId(status.id);
    setEditStatus({ name: status.name, color: status.color || DEFAULT_COLORS[0], isFinal: status.isFinal });
  };

  const sortedStatuses = [...statuses].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-semibold text-foreground">Statuts de l&apos;équipe</h3>
          <p className="text-xs text-muted">Ordonnez les statuts pour définir le workflow des tickets</p>
        </div>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] transition-colors duration-150 ease-out">
            + Ajouter un statut
          </button>
        )}
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {isAdding && (
        <div className="p-3 bg-surface-alt rounded-xl border border-border-default">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="text" value={newStatus.name} onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })} placeholder="Nom du statut" className={inputClass} autoFocus />
              <input type="color" value={newStatus.color} onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })} aria-label="Couleur du statut" className="w-8 h-8 rounded-lg cursor-pointer border border-border-default" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="newIsFinal" checked={newStatus.isFinal} onChange={(e) => setNewStatus({ ...newStatus, isFinal: e.target.checked })} className="h-3.5 w-3.5 rounded border-border-default accent-[#e8513b]" />
              <label htmlFor="newIsFinal" className="text-xs text-foreground">Statut final (terminé/annulé)</label>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddStatus} className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors duration-150 ease-out">Ajouter</button>
              <button onClick={() => { setIsAdding(false); setNewStatus({ name: '', color: DEFAULT_COLORS[0], isFinal: false }); }} className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors">Annuler</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {sortedStatuses.length === 0 ? (
          <p className="text-xs text-muted italic">Aucun statut configuré.</p>
        ) : (
          sortedStatuses.map((status, index) => (
            <div key={status.id} className={`flex items-center justify-between px-3 py-2 border rounded-xl ${status.isFinal ? 'border-border-default bg-surface-alt' : 'border-border-default bg-surface'}`}>
              {editingId === status.id ? (
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="text" value={editStatus.name} onChange={(e) => setEditStatus({ ...editStatus, name: e.target.value })} className={inputClass} autoFocus />
                    <input type="color" value={editStatus.color} onChange={(e) => setEditStatus({ ...editStatus, color: e.target.value })} aria-label="Couleur du statut" className="w-7 h-7 rounded-lg cursor-pointer border border-border-default" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id={`isFinal-${status.id}`} checked={editStatus.isFinal} onChange={(e) => setEditStatus({ ...editStatus, isFinal: e.target.checked })} className="h-3.5 w-3.5 rounded border-border-default accent-[#e8513b]" />
                    <label htmlFor={`isFinal-${status.id}`} className="text-xs text-foreground">Statut final</label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdateStatus(status.id)} className="px-2.5 py-1 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors duration-150 ease-out">Sauver</button>
                    <button onClick={() => setEditingId(null)} className="px-2.5 py-1 text-sm text-muted hover:text-foreground transition-colors">Annuler</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1 mr-2">
                    <button onClick={() => handleMoveUp(status.id)} disabled={index === 0 || isReordering} aria-label="Monter le statut" className={`p-0.5 rounded-lg transition-colors ${index === 0 || isReordering ? 'text-muted opacity-40 cursor-not-allowed' : 'text-muted hover:text-foreground hover:bg-surface-alt'}`} title="Monter">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => handleMoveDown(status.id)} disabled={index === sortedStatuses.length - 1 || isReordering} aria-label="Descendre le statut" className={`p-0.5 rounded-lg transition-colors ${index === sortedStatuses.length - 1 || isReordering ? 'text-muted opacity-40 cursor-not-allowed' : 'text-muted hover:text-foreground hover:bg-surface-alt'}`} title="Descendre">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: status.color || '#6b7280' }} />
                    <span className="text-sm font-medium text-foreground">{status.name}</span>
                    {status.isFinal && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-surface-alt border border-border-default text-muted rounded">Final</span>
                    )}
                    {status._count && status._count.tickets > 0 && (
                      <span className="text-xs text-muted tabular-nums">({status._count.tickets} ticket{status._count.tickets > 1 ? 's' : ''})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEditing(status)} className="text-xs text-[color:var(--accent)] hover:opacity-80 transition-opacity">Modifier</button>
                    <button onClick={() => handleDeleteStatus(status.id, status._count?.tickets || 0)} className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors">Supprimer</button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {sortedStatuses.length > 0 && (
        <p className="text-xs text-muted">L&apos;ordre des statuts définit l&apos;ordre des colonnes dans le kanban.</p>
      )}
    </div>
  );
}
