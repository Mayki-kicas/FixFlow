import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { getAppConfig } from '@/lib/app-config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import AppConfigForm from '@/components/AppConfigForm';

export default async function BackofficeSettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    redirect('/tickets');
  }

  const [config, criticalCount] = await Promise.all([
    getAppConfig(),
    getVisibleCriticalTicketsCountForUser(user),
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
                <h1 className="page-toolbar-title">Réglages globaux</h1>
                <span className="page-toolbar-subtitle">Réservé aux administrateurs</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
            <div className="section-band">
              <h2 className="section-band-title">SLA de prise en charge</h2>
            </div>
            <AppConfigForm firstResponseHours={config.firstResponseHours} laborRateCents={config.laborRateCents} />
          </div>

          <p className="text-[11px] text-muted">
            Les délais devis (jours) et le SLA correctif (heures) se règlent par type d&apos;intervention dans{' '}
            <Link href="/backoffice/categories" className="text-[color:var(--accent)] hover:opacity-80">
              Catégories d&apos;équipements
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
