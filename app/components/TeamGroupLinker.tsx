'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { linkGroupToTeam, unlinkGroupFromTeam } from '@/lib/actions/groups';

type LinkedGroup = {
  id: string;
  name: string;
  _count: { members: number };
};

type AvailableGroup = {
  id: string;
  name: string;
  _count: { members: number };
};

type TeamGroupLinkerProps = {
  teamId: string;
  linkedGroups: LinkedGroup[];
  availableGroups: AvailableGroup[];
};

export default function TeamGroupLinker({ teamId, linkedGroups, availableGroups }: TeamGroupLinkerProps) {
  const router = useRouter();
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleLink = async () => {
    if (!selectedGroupId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await linkGroupToTeam(selectedGroupId, teamId);
      setSelectedGroupId('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la liaison');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlink = async (groupId: string) => {
    if (!confirm('Retirer ce groupe des abonnements automatiques ?')) return;
    setError(null);
    setRemovingId(groupId);
    try {
      await unlinkGroupFromTeam(groupId, teamId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du retrait');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {availableGroups.length > 0 ? (
        <div className="flex gap-2">
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
          >
            <option value="">Sélectionner un groupe...</option>
            {availableGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group._count.members} membre(s))
              </option>
            ))}
          </select>
          <button onClick={handleLink} disabled={!selectedGroupId || isSubmitting} className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] disabled:opacity-50 transition-colors duration-150 ease-out">
            {isSubmitting ? 'Ajout...' : 'Lier'}
          </button>
        </div>
      ) : linkedGroups.length > 0 ? (
        <p className="text-xs text-muted italic">Tous les groupes sont déjà liés à cette équipe.</p>
      ) : null}

      {linkedGroups.length === 0 ? (
        <p className="text-xs text-muted italic">
          Aucun groupe lié. Les membres des groupes liés seront automatiquement abonnés aux nouveaux tickets.
        </p>
      ) : (
        <table className="min-w-full divide-y divide-[color:var(--border-default)] border border-border-default rounded-xl overflow-hidden">
          <thead className="bg-surface-alt">
            <tr>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Groupe</th>
              <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Membres</th>
              <th className="px-3 py-1.5 text-right text-xs font-medium text-muted uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--border-default)]">
            {linkedGroups.map((group) => (
              <tr key={group.id} className="hover:bg-surface-alt transition-colors duration-150 ease-out">
                <td className="px-3 py-1.5 text-sm font-medium text-foreground">{group.name}</td>
                <td className="px-3 py-1.5 text-sm text-muted tabular-nums">{group._count.members} membre(s)</td>
                <td className="px-3 py-1.5 text-right">
                  <button onClick={() => handleUnlink(group.id)} disabled={removingId === group.id} className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50 transition-colors">
                    {removingId === group.id ? 'Retrait...' : 'Retirer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
