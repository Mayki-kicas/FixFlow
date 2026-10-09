'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeUserToTicket, unsubscribeUserFromTicket, subscribeGroupToTicket } from '@/lib/actions/tickets';
import { UserRole } from '@prisma/client';

type Subscription = {
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

type AvailableGroup = {
  id: string;
  name: string;
  _count: { members: number };
};

type TicketSubscriptionManagerProps = {
  ticketId: string;
  requesterId: string;
  subscriptions: Subscription[];
  availableUsers: AvailableUser[];
  availableGroups: AvailableGroup[];
  canManage: boolean;
  forceOpen?: boolean;
  hideToggle?: boolean;
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

export default function TicketSubscriptionManager({
  ticketId,
  requesterId,
  subscriptions,
  availableUsers,
  availableGroups,
  canManage,
  forceOpen = false,
  hideToggle = false,
}: TicketSubscriptionManagerProps) {
  const router = useRouter();
  const [isOpenState, setIsOpenState] = useState(forceOpen);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const isOpen = forceOpen || isOpenState;

  const handleAddUser = async () => {
    if (!selectedUserId) return;
    setError(null); setSuccess(null); setIsSubmitting(true);
    try {
      await subscribeUserToTicket(ticketId, selectedUserId);
      setSelectedUserId('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'ajout");
    } finally { setIsSubmitting(false); }
  };

  const handleAddGroup = async () => {
    if (!selectedGroupId) return;
    setError(null); setSuccess(null); setIsSubmitting(true);
    try {
      const count = await subscribeGroupToTicket(ticketId, selectedGroupId);
      setSelectedGroupId('');
      setSuccess(`${count} membre(s) ajouté(s)`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'ajout");
    } finally { setIsSubmitting(false); }
  };

  const handleRemove = async (userId: string) => {
    setError(null); setSuccess(null); setRemovingId(userId);
    try {
      await unsubscribeUserFromTicket(ticketId, userId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du retrait');
    } finally { setRemovingId(null); }
  };

  const selectClass = "flex-1 px-2 py-1 text-xs border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/40";

  return (
    <div className="bg-surface border border-border-default rounded-xl p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-sm font-semibold text-foreground">
          Abonnés <span className="text-xs font-normal text-muted tabular-nums">({subscriptions.length})</span>
        </h2>
        {!hideToggle && (
          <button
            type="button"
            onClick={() => setIsOpenState((prev) => !prev)}
            className="px-2 py-0.5 text-[11px] font-medium border border-border-default rounded-lg text-foreground transition-colors hover:bg-surface-alt"
          >
            {isOpen ? 'Masquer' : 'Afficher'}
          </button>
        )}
      </div>

      {!isOpen && (
        <p className="text-xs text-muted">Clique sur Afficher pour gérer les abonnements.</p>
      )}

      {isOpen && (
        <>
          {error && (
            <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400">{error}</div>
          )}
          {success && (
            <div className="mb-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-600 dark:text-green-400">{success}</div>
          )}

          <ul className="space-y-1.5 mb-2">
            {subscriptions.map((sub) => (
              <li key={sub.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium text-foreground truncate text-xs">{sub.user.displayName}</span>
                  <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${roleColors[sub.user.role]}`}>{roleLabels[sub.user.role]}</span>
                  {sub.user.id === requesterId && (
                    <span className="text-xs text-muted">(demandeur)</span>
                  )}
                </div>
                {canManage && sub.user.id !== requesterId && (
                  <button onClick={() => handleRemove(sub.user.id)} disabled={removingId === sub.user.id} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 ml-2 flex-shrink-0 text-xs">
                    {removingId === sub.user.id ? '...' : '×'}
                  </button>
                )}
              </li>
            ))}
            {subscriptions.length === 0 && (
              <li className="text-xs text-muted italic">Aucun abonné</li>
            )}
          </ul>

          {canManage && (
            <div className="space-y-1.5 pt-1.5 border-t border-border-default">
              <div className="flex gap-1.5">
                <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className={selectClass}>
                  <option value="">Ajouter un utilisateur...</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>{user.displayName} - {roleLabels[user.role]}</option>
                ))}
                </select>
                <button type="button" aria-label="Ajouter l'utilisateur sélectionné" onClick={handleAddUser} disabled={!selectedUserId || isSubmitting} className="px-2 py-1 text-xs font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg transition-colors hover:bg-[color:var(--primary-hover)] disabled:opacity-50">+</button>
              </div>
              <div className="flex gap-1.5">
                <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className={selectClass}>
                  <option value="">Ajouter un groupe...</option>
                {availableGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name} ({group._count.members} membre(s))</option>
                ))}
                </select>
                <button type="button" aria-label="Ajouter le groupe sélectionné" onClick={handleAddGroup} disabled={!selectedGroupId || isSubmitting} className="px-2 py-1 text-xs font-medium bg-emerald-600 text-white rounded-lg transition-colors hover:bg-emerald-700 disabled:opacity-50">+</button>
              </div>
              {availableUsers.length === 0 && (
                <p className="text-xs text-muted">Aucun utilisateur disponible à ajouter.</p>
              )}
              {availableGroups.length === 0 && (
                <p className="text-xs text-muted">Aucun groupe disponible à ajouter.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
