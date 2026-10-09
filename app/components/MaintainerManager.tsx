'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createMaintainer, updateMaintainer, deleteMaintainer } from '@/lib/actions/maintainers';

type Maintainer = {
  id: string;
  name: string;
  email: string | null;
  contact: string | null;
  _count: {
    tickets: number;
  };
};

type MaintainerManagerProps = {
  maintainers: Maintainer[];
};

const inputClass = "w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out";

export default function MaintainerManager({ maintainers }: MaintainerManagerProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newMaintainer, setNewMaintainer] = useState({ name: '', email: '', password: '', contact: '' });
  const [editMaintainer, setEditMaintainer] = useState({ name: '', email: '', password: '', contact: '' });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddMaintainer = async () => {
    if (!newMaintainer.name.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await createMaintainer({
        name: newMaintainer.name,
        email: newMaintainer.email || undefined,
        password: newMaintainer.password || undefined,
        contact: newMaintainer.contact || undefined,
      });
      setNewMaintainer({ name: '', email: '', password: '', contact: '' });
      setIsAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMaintainer = async (maintainerId: string) => {
    if (!editMaintainer.name.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await updateMaintainer({
        id: maintainerId,
        name: editMaintainer.name,
        email: editMaintainer.email || undefined,
        password: editMaintainer.password || undefined,
        contact: editMaintainer.contact || undefined,
      });
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMaintainer = async (maintainerId: string, ticketCount: number) => {
    if (ticketCount > 0) {
      setError(`Ce mainteneur a ${ticketCount} ticket(s) assigné(s). Réassignez ou fermez ces tickets d'abord.`);
      return;
    }
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce mainteneur ?')) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await deleteMaintainer(maintainerId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (maintainer: Maintainer) => {
    setEditingId(maintainer.id);
    setEditMaintainer({ name: maintainer.name, email: maintainer.email || '', password: '', contact: maintainer.contact || '' });
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {!isAdding && (
        <button onClick={() => setIsAdding(true)} className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] transition-colors duration-150 ease-out">
          + Ajouter un mainteneur
        </button>
      )}

      {isAdding && (
        <div className="p-3 bg-surface-alt rounded-xl border border-border-default">
          <h3 className="text-sm font-medium text-foreground mb-2">Nouveau mainteneur</h3>
          <div className="space-y-2">
            <input type="text" value={newMaintainer.name} onChange={(e) => setNewMaintainer({ ...newMaintainer, name: e.target.value })} placeholder="Nom du mainteneur / entreprise *" className={inputClass} autoFocus />
            <input type="email" value={newMaintainer.email} onChange={(e) => setNewMaintainer({ ...newMaintainer, email: e.target.value })} placeholder="Email connexion (optionnel)" className={inputClass} />
            <input type="password" value={newMaintainer.password} onChange={(e) => setNewMaintainer({ ...newMaintainer, password: e.target.value })} placeholder="Mot de passe connexion (optionnel)" className={inputClass} />
            <input type="text" value={newMaintainer.contact} onChange={(e) => setNewMaintainer({ ...newMaintainer, contact: e.target.value })} placeholder="Contact (téléphone, email...)" className={inputClass} />
            <div className="flex gap-2">
              <button onClick={handleAddMaintainer} disabled={isSubmitting || !newMaintainer.name.trim()} className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors duration-150 ease-out">
                {isSubmitting ? 'Création...' : 'Créer'}
              </button>
              <button onClick={() => { setIsAdding(false); setNewMaintainer({ name: '', email: '', password: '', contact: '' }); setError(null); }} className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y divide-[color:var(--border-default)] border border-border-default rounded-xl overflow-hidden">
        {maintainers.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted">
            Aucun mainteneur. Ajoutez des prestataires externes pour les assigner aux tickets.
          </div>
        ) : (
          maintainers.map((maintainer) => (
            <div key={maintainer.id} className="px-3 py-2.5 bg-surface">
              {editingId === maintainer.id ? (
                <div className="space-y-2">
                  <input type="text" value={editMaintainer.name} onChange={(e) => setEditMaintainer({ ...editMaintainer, name: e.target.value })} className={inputClass} autoFocus />
                  <input type="email" value={editMaintainer.email} onChange={(e) => setEditMaintainer({ ...editMaintainer, email: e.target.value })} placeholder="Email connexion" className={inputClass} />
                  <input type="password" value={editMaintainer.password} onChange={(e) => setEditMaintainer({ ...editMaintainer, password: e.target.value })} placeholder="Nouveau mot de passe (optionnel)" className={inputClass} />
                  <input type="text" value={editMaintainer.contact} onChange={(e) => setEditMaintainer({ ...editMaintainer, contact: e.target.value })} placeholder="Contact (téléphone, email...)" className={inputClass} />
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdateMaintainer(maintainer.id)} disabled={isSubmitting} className="px-2.5 py-1 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors duration-150 ease-out">Sauver</button>
                    <button onClick={() => setEditingId(null)} className="px-2.5 py-1 text-sm text-muted hover:text-foreground transition-colors">Annuler</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <Link href={`/backoffice/maintainers/${maintainer.id}`} className="text-sm font-medium text-foreground hover:text-[color:var(--accent)] transition-colors">
                      {maintainer.name}
                    </Link>
                    {maintainer.email && <p className="text-xs text-muted">{maintainer.email}</p>}
                    {maintainer.contact && <p className="text-xs text-muted">{maintainer.contact}</p>}
                    <p className="text-xs text-muted mt-0.5 tabular-nums">{maintainer._count.tickets} ticket(s) assigné(s)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/backoffice/maintainers/${maintainer.id}`} className="text-xs text-[color:var(--accent)] hover:opacity-80 transition-opacity">Détail</Link>
                    <button onClick={() => startEditing(maintainer)} className="text-xs text-[color:var(--accent)] hover:opacity-80 transition-opacity">Modifier</button>
                    <button onClick={() => handleDeleteMaintainer(maintainer.id, maintainer._count.tickets)} className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors">Supprimer</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
