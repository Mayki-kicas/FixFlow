'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addMembersToGroup, removeMemberFromGroup } from '@/lib/actions/groups';
import { UserRole } from '@prisma/client';

type Member = {
  id: string;
  user: {
    id: string;
    displayName: string;
    email: string;
    role: UserRole;
  };
};

type AvailableUser = {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
};

type GroupMemberManagerProps = {
  groupId: string;
  members: Member[];
  availableUsers: AvailableUser[];
};

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  MAINTAINER: 'Mainteneur',
  BASIC: 'Utilisateur',
};

const roleColors: Record<UserRole, string> = {
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  MANAGER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  MAINTAINER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  BASIC: 'bg-surface-alt text-muted border border-border-default',
};

export default function GroupMemberManager({ groupId, members, availableUsers }: GroupMemberManagerProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const filteredAvailableUsers = availableUsers.filter((user) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      user.displayName.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q)
    );
  });

  const selectedUserIds = Object.entries(selectedUsers)
    .filter(([, isSelected]) => isSelected)
    .map(([userId]) => userId);

  const handleAddMembers = async () => {
    if (selectedUserIds.length === 0) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await addMembersToGroup(groupId, selectedUserIds);
      setSelectedUsers({});
      setSearchTerm('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'ajout des membres');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Retirer ce membre du groupe ?')) return;
    setError(null);
    setRemovingId(userId);
    try {
      await removeMemberFromGroup(groupId, userId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du retrait');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Ajouter un membre */}
      <div className="bg-surface border border-border-default rounded-xl p-3">
        <h2 className="text-sm font-semibold text-foreground mb-2">Ajouter un membre</h2>
        {availableUsers.length === 0 ? (
          <p className="text-xs text-muted italic">
            Tous les utilisateurs sont déjà membres de ce groupe.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher un utilisateur..."
                className="flex-1 px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
              />
              <button
                onClick={handleAddMembers}
                disabled={selectedUserIds.length === 0 || isSubmitting}
                className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] disabled:opacity-50 transition-colors duration-150 ease-out"
              >
                {isSubmitting ? 'Ajout...' : `Ajouter (${selectedUserIds.length})`}
              </button>
            </div>

            <div className="max-h-44 overflow-y-auto rounded-lg border border-border-default divide-y divide-[color:var(--border-default)]">
              {filteredAvailableUsers.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted italic">
                  Aucun utilisateur trouvé.
                </p>
              ) : (
                filteredAvailableUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-surface-alt cursor-pointer transition-colors duration-150 ease-out"
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedUsers[user.id]}
                      onChange={(e) =>
                        setSelectedUsers((prev) => ({
                          ...prev,
                          [user.id]: e.target.checked,
                        }))
                      }
                      className="h-3.5 w-3.5 rounded border-border-default accent-[#e8513b]"
                    />
                    <span className="font-medium text-foreground">
                      {user.displayName}
                    </span>
                    <span className="text-muted truncate">
                      {user.email}
                    </span>
                    <span className={`ml-auto inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded whitespace-nowrap ${roleColors[user.role]}`}>
                      {roleLabels[user.role]}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Liste des membres */}
      <div className="bg-surface border border-border-default rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-border-default">
          <h2 className="text-sm font-semibold text-foreground">Membres du groupe</h2>
        </div>
        {members.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted">
            Aucun membre dans ce groupe.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-[color:var(--border-default)]">
            <thead className="bg-surface-alt">
              <tr>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Nom</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Email</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Rôle</th>
                <th className="px-3 py-1.5 text-right text-xs font-medium text-muted uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-default)]">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-surface-alt transition-colors duration-150 ease-out">
                  <td className="px-3 py-1.5 whitespace-nowrap text-sm font-medium text-foreground">
                    {member.user.displayName}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-sm text-muted">
                    {member.user.email}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${roleColors[member.user.role]}`}>
                      {roleLabels[member.user.role]}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-right">
                    <button onClick={() => handleRemoveMember(member.user.id)} disabled={removingId === member.user.id} className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50 transition-colors">
                      {removingId === member.user.id ? 'Retrait...' : 'Retirer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
