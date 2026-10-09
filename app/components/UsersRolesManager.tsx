'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import {
  createLocalUser,
  resetLocalUserPassword,
  setUserActive,
  setUserRole,
  type ManagedUser,
} from '@/lib/actions/users';

type Role = 'ADMIN' | 'MANAGER' | 'MAINTAINER' | 'BASIC';
const ROLES: Role[] = ['ADMIN', 'MANAGER', 'MAINTAINER', 'BASIC'];

const PROVIDER_LABEL: Record<string, string> = {
  LOCAL: 'Local',
  LDAP: 'LDAP',
  ENTRA: 'Microsoft',
};

export default function UsersRolesManager({ users }: { users: ManagedUser[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', displayName: '', role: 'BASIC' as Role, password: '' });

  const run = (fn: () => Promise<unknown>, okMsg: string) => {
    startTransition(async () => {
      try {
        await fn();
        toast.success(okMsg);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Action impossible.');
      }
    });
  };

  return (
    <div className="space-y-3">
      {/* Création d'un compte local */}
      <div className="card p-3">
        <div className="flex items-center justify-between">
          <span className="card-head-title">Compte local</span>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="text-xs font-medium text-[color:var(--accent)] hover:opacity-80"
          >
            {showCreate ? 'Annuler' : '+ Nouveau compte local'}
          </button>
        </div>
        {showCreate && (
          <form
            className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await createLocalUser(form);
                setForm({ email: '', displayName: '', role: 'BASIC', password: '' });
                setShowCreate(false);
              }, 'Compte local créé.');
            }}
          >
            <input
              type="email" required placeholder="email@exemple.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm"
            />
            <input
              type="text" required placeholder="Nom affiché" value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              className="rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              type="password" required minLength={10} placeholder="Mot de passe (10+ car.)" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm"
            />
            <button
              type="submit" disabled={pending}
              className="sm:col-span-2 rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-sm font-medium text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50"
            >
              Créer
            </button>
          </form>
        )}
      </div>

      {/* Table des utilisateurs */}
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border-default">
            <tr className="text-left">
              <th className="px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-muted">Utilisateur</th>
              <th className="px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-muted">Méthode</th>
              <th className="px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-muted">Rôle</th>
              <th className="px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-muted">Accès</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border-default last:border-0">
                <td className="px-3 py-2">
                  <p className="font-medium text-foreground">{u.displayName}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                </td>
                <td className="px-3 py-2">
                  <span className="tag-ribbon">{PROVIDER_LABEL[u.authProvider] ?? u.authProvider}</span>
                </td>
                <td className="px-3 py-2">
                  <select
                    defaultValue={u.role}
                    disabled={pending}
                    onChange={(e) => run(() => setUserRole(u.id, e.target.value as Role), 'Rôle mis à jour.')}
                    className="rounded-lg border border-border-default bg-surface px-2 py-1 text-xs"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {u.isActive ? (
                    <span className="badge badge-success">Actif</span>
                  ) : (
                    <span className="badge badge-warn">En attente</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button" disabled={pending}
                      onClick={() => run(() => setUserActive(u.id, !u.isActive), u.isActive ? 'Accès révoqué.' : 'Accès accordé.')}
                      className="rounded border border-border-default px-2 py-1 text-xs text-foreground hover:bg-surface-alt disabled:opacity-50"
                    >
                      {u.isActive ? 'Désactiver' : 'Activer'}
                    </button>
                    {u.authProvider === 'LOCAL' && (
                      <button
                        type="button" disabled={pending}
                        onClick={() => {
                          const pwd = window.prompt('Nouveau mot de passe (10 caractères minimum) :');
                          if (pwd == null) return;
                          run(() => resetLocalUserPassword(u.id, pwd), 'Mot de passe réinitialisé.');
                        }}
                        className="rounded border border-border-default px-2 py-1 text-xs text-foreground hover:bg-surface-alt disabled:opacity-50"
                      >
                        Mot de passe
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
