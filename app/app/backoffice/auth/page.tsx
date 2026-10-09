import Link from 'next/link';
import Header from '@/components/Header';
import AuthConfigForm from '@/components/AuthConfigForm';
import { getCurrentUser } from '@/lib/session';
import { getAuthConfig } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export default async function BackofficeAuthPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'ADMIN') {
    redirect('/tickets');
  }

  const [criticalCount, config] = await Promise.all([
    prisma.ticket.count({ where: { priority: 'P1', isArchived: false } }),
    getAuthConfig(),
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
                <h1 className="page-toolbar-title">Authentification</h1>
                <span className="page-toolbar-subtitle">Méthode SSO et paramètres (ADMIN)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <AuthConfigForm
            config={{
              activeProvider: config.activeProvider,
              ldapUrl: config.ldapUrl,
              ldapSearchBase: config.ldapSearchBase,
              ldapBindDn: config.ldapBindDn,
              entraTenantId: config.entraTenantId,
              entraClientId: config.entraClientId,
            }}
            hasLdapBindPassword={!!process.env.LDAP_BIND_PASSWORD}
            hasEntraSecret={!!process.env.ENTRA_CLIENT_SECRET}
          />
        </div>
      </div>
    </>
  );
}
