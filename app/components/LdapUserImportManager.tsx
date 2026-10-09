'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { importLdapUsers, type LDAPImportCandidate } from '@/lib/actions/users';

type LdapUserImportManagerProps = {
  users: LDAPImportCandidate[];
};

function roleLabel(role: LDAPImportCandidate['suggestedRole']) {
  if (role === 'ADMIN') return 'Admin';
  if (role === 'MANAGER') return 'Manager';
  if (role === 'MAINTAINER') return 'Mainteneur';
  return 'Utilisateur';
}

export default function LdapUserImportManager({ users }: LdapUserImportManagerProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      user.displayName.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      user.uid.toLowerCase().includes(q)
    );
  }, [users, search]);

  const selectedDns = useMemo(
    () => Object.entries(selected).filter(([, value]) => value).map(([dn]) => dn),
    [selected]
  );

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selected[user.dn]);

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg" aria-live="polite">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher par nom, email ou uid"
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2.5 py-1 text-xs font-medium border border-border-default rounded-lg text-foreground hover:bg-surface-alt transition-colors duration-150 ease-out"
            onClick={() => {
              const next = { ...selected };
              for (const user of filteredUsers) {
                next[user.dn] = !allFilteredSelected;
              }
              setSelected(next);
            }}
          >
            {allFilteredSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>

          <button
            type="button"
            disabled={isPending || selectedDns.length === 0}
            className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] disabled:opacity-50 transition-colors duration-150 ease-out"
            onClick={() => {
              setError(null);
              setSuccess(null);
              startTransition(async () => {
                try {
                  const result = await importLdapUsers(selectedDns);
                  setSuccess(`${result.importedCount} utilisateur(s) importé(s) ou mis à jour.`);
                  setSelected({});
                  router.refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Erreur lors de l\'import');
                }
              });
            }}
          >
            {isPending ? 'Import en cours...' : `Importer (${selectedDns.length})`}
          </button>
        </div>
      </div>

      <div className="border border-border-default rounded-xl overflow-hidden">
        <div className="grid grid-cols-[36px_1.4fr_1.4fr_0.8fr_0.9fr] px-3 py-2 bg-surface-alt text-[11px] uppercase tracking-wide text-muted">
          <span />
          <span>Nom</span>
          <span>Email</span>
          <span>UID</span>
          <span>Rôle</span>
        </div>

        <div className="max-h-[28rem] overflow-y-auto divide-y divide-[color:var(--border-default)] bg-surface">
          {filteredUsers.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted">
              Aucun utilisateur LDAP actif trouvé pour ce filtre.
            </div>
          ) : (
            filteredUsers.map((user) => (
              <label
                key={user.dn}
                className="grid grid-cols-[36px_1.4fr_1.4fr_0.8fr_0.9fr] items-center px-3 py-2 text-xs text-foreground hover:bg-surface-alt cursor-pointer transition-colors duration-150 ease-out"
              >
                <input
                  type="checkbox"
                  checked={!!selected[user.dn]}
                  onChange={(event) =>
                    setSelected((prev) => ({
                      ...prev,
                      [user.dn]: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-border-default accent-[#e8513b]"
                />
                <div className="pr-2">
                  <p className="text-sm font-medium text-foreground">{user.displayName}</p>
                  {user.isAlreadyInApp && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Déjà présent dans l&apos;application</p>
                  )}
                </div>
                <p className="pr-2 truncate text-muted" title={user.email}>{user.email}</p>
                <p className="pr-2 text-[11px] text-muted truncate" title={user.uid}>{user.uid}</p>
                <span className="inline-flex w-fit px-1.5 py-0.5 rounded text-[11px] bg-surface-alt border border-border-default text-muted">
                  {roleLabel(user.suggestedRole)}
                </span>
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
