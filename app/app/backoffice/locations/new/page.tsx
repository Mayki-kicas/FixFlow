import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import LocationForm from '@/components/LocationForm';
import Header from '@/components/Header';

export default async function NewLocationPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const criticalCount = await getVisibleCriticalTicketsCountForUser(user);

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
      <div className="page-toolbar">
        <div className="page-toolbar-inner">
          <div className="page-toolbar-row">
            <div className="flex items-center gap-3">
              <Link href="/backoffice/locations" className="text-xs text-muted hover:text-foreground transition-colors duration-150 ease-out">
                ← Retour aux localisations
              </Link>
              <span className="text-border-default">|</span>
              <h1 className="page-toolbar-title">Ajouter un site</h1>
              <span className="page-toolbar-subtitle">Créer une nouvelle localisation</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

        <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
          <LocationForm />
        </div>
      </div>
      </div>
    </>
  );
}
