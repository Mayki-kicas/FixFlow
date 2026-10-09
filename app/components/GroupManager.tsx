'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createGroup, updateGroup, deleteGroup } from '@/lib/actions/groups';

type Group = {
  id: string;
  name: string;
  description: string | null;
  _count: {
    members: number;
    teams: number;
  };
};

type GroupManagerProps = {
  groups: Group[];
};

const inputClass = "w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out";

export default function GroupManager({ groups }: GroupManagerProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const [editGroup, setEditGroup] = useState({ name: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddGroup = async () => {
    if (!newGroup.name.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await createGroup({ name: newGroup.name, description: newGroup.description || undefined });
      setNewGroup({ name: '', description: '' });
      setIsAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateGroup = async (groupId: string) => {
    if (!editGroup.name.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await updateGroup({ id: groupId, name: editGroup.name, description: editGroup.description || undefined });
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, memberCount: number) => {
    if (memberCount > 0) {
      setError(`Ce groupe contient ${memberCount} membre(s). Retirez-les d'abord.`);
      return;
    }
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce groupe ?')) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await deleteGroup(groupId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (group: Group) => {
    setEditingId(group.id);
    setEditGroup({ name: group.name, description: group.description || '' });
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
          + Créer un groupe
        </button>
      )}

      {isAdding && (
        <div className="p-3 bg-surface-alt rounded-xl border border-border-default">
          <h3 className="text-sm font-medium text-foreground mb-2">Nouveau groupe</h3>
          <div className="space-y-2">
            <input type="text" value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} placeholder="Nom du groupe *" className={inputClass} autoFocus />
            <input type="text" value={newGroup.description} onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })} placeholder="Description (optionnel)" className={inputClass} />
            <div className="flex gap-2">
              <button onClick={handleAddGroup} disabled={isSubmitting || !newGroup.name.trim()} className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors duration-150 ease-out">
                {isSubmitting ? 'Création...' : 'Créer'}
              </button>
              <button onClick={() => { setIsAdding(false); setNewGroup({ name: '', description: '' }); setError(null); }} className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.length === 0 ? (
          <div className="col-span-full p-4 text-center text-sm text-muted bg-surface-alt rounded-xl border border-border-default">
            Aucun groupe. Créez-en un pour commencer.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="bg-surface border border-border-default rounded-xl p-3">
              {editingId === group.id ? (
                <div className="space-y-2">
                  <input type="text" value={editGroup.name} onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })} className={inputClass} autoFocus />
                  <input type="text" value={editGroup.description} onChange={(e) => setEditGroup({ ...editGroup, description: e.target.value })} placeholder="Description (optionnel)" className={inputClass} />
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdateGroup(group.id)} disabled={isSubmitting} className="px-2.5 py-1 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors duration-150 ease-out">Sauver</button>
                    <button onClick={() => setEditingId(null)} className="px-2.5 py-1 text-sm text-muted hover:text-foreground transition-colors">Annuler</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{group.name}</h3>
                      {group.description && <p className="text-xs text-muted mt-0.5">{group.description}</p>}
                    </div>
                    <span className="text-lg font-bold text-[color:var(--accent)] tabular-nums">
                      {group._count.members}
                    </span>
                  </div>
                  <p className="text-xs text-muted mb-2 tabular-nums">
                    {group._count.members} membre(s) · {group._count.teams} équipe(s)
                  </p>
                  <div className="flex items-center gap-2 pt-2 border-t border-border-default">
                    <Link href={`/backoffice/groups/${group.id}`} className="text-xs text-[color:var(--accent)] hover:opacity-80 transition-opacity">Gérer les membres</Link>
                    <button onClick={() => startEditing(group)} className="text-xs text-muted hover:text-foreground transition-colors">Modifier</button>
                    <button onClick={() => handleDeleteGroup(group.id, group._count.members)} className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors">Supprimer</button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
