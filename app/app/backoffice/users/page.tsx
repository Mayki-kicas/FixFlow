import Link from 'next/link';
import Header from '@/components/Header';
import LdapUserImportManager from '@/components/LdapUserImportManager';
import UsersRolesManager from '@/components/UsersRolesManager';
import { getCurrentUser } from '@/lib/session';
import { getLdapImportCandidates, listManagedUsers } from '@/lib/actions/users';
import { getAuthConfig } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export default async function BackofficeUsersPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'ADMIN') {
    redirect('/tickets');
  }

  const authConfig = await getAuthConfig();
  const ldapActive = authConfig.activeProvider === 'LDAP';

  const [criticalCount, managedUsers, ldapUsers] = await Promise.all([
    prisma.ticket.count({ where: { priority: 'P1', isArchived: false } }),
    listManagedUsers(),
    ldapActive ? getLdapImportCandidates() : Promise.resolve([]),
  ]);

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <Link href="/backoffice" className="text-xs text-muted hover:text-foreground transition-colors duration-150 ease-out">
                  ← Retour au backoffice
                </Link>
                <span className="text-border-default">|</span>
                <h1 className="page-toolbar-title">Utilisateurs &amp; rôles</h1>
                <span className="page-toolbar-subtitle">Attribution des rôles et des accès (ADMIN)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
          <UsersRolesManager users={managedUsers} />

          {ldapActive && (
            <section className="space-y-2">
              <div className="section-band">
                <h2 className="section-band-title">Import d&apos;utilisateurs LDAP</h2>
                <span className="text-[11px] text-muted tabular-nums">{ldapUsers.length} compte(s) actif(s)</span>
              </div>
              <div className="card p-4">
                <p className="mb-3 text-xs text-muted">
                  Intégrez des comptes LDAP actifs. Les comptes importés sont activés ; ajustez
                  leur rôle ci-dessus si besoin.
                </p>
                <LdapUserImportManager users={ldapUsers} />
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
