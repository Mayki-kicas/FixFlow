import Link from 'next/link';
import Header from '@/components/Header';
import LdapUserImportManager from '@/components/LdapUserImportManager';
import { getCurrentUser } from '@/lib/session';
import { getLdapImportCandidates } from '@/lib/actions/users';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export default async function BackofficeUsersPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'ADMIN') {
    redirect('/tickets');
  }

  const [criticalCount, ldapUsers, appUserCount] = await Promise.all([
    prisma.ticket.count({
      where: { priority: 'P1', isArchived: false },
    }),
    getLdapImportCandidates(),
    prisma.user.count(),
  ]);

  const alreadyInAppCount = ldapUsers.filter((ldapUser) => ldapUser.isAlreadyInApp).length;

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
                <h1 className="page-toolbar-title">Import utilisateurs LDAP</h1>
                <span className="page-toolbar-subtitle">Réservé aux administrateurs</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 space-y-4 backdrop-blur">
          <p className="text-xs text-muted">
            Sélectionnez les comptes LDAP actifs à intégrer dans l&apos;outil.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-xl border border-border-default px-2 py-1.5 bg-surface-alt">
              <p className="text-[10px] uppercase tracking-wide text-muted">LDAP actifs</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{ldapUsers.length}</p>
            </div>
            <div className="rounded-xl border border-border-default px-2 py-1.5 bg-surface-alt">
              <p className="text-[10px] uppercase tracking-wide text-muted">Déjà présents</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{alreadyInAppCount}</p>
            </div>
            <div className="rounded-xl border border-border-default px-2 py-1.5 bg-surface-alt">
              <p className="text-[10px] uppercase tracking-wide text-muted">Nouveaux potentiels</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{ldapUsers.length - alreadyInAppCount}</p>
            </div>
            <div className="rounded-xl border border-border-default px-2 py-1.5 bg-surface-alt">
              <p className="text-[10px] uppercase tracking-wide text-muted">Utilisateurs app</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{appUserCount}</p>
            </div>
          </div>

          <LdapUserImportManager users={ldapUsers} />
        </div>
      </div>
      </div>
    </>
  );
}
