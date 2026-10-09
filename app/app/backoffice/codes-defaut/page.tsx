import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { getFailureCodes } from '@/lib/actions/failure-codes';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import FailureCodesManager from '@/components/FailureCodesManager';

export default async function FailureCodesPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const [codes, criticalCount] = await Promise.all([
    getFailureCodes(),
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
                <h1 className="page-toolbar-title">Codes défaut</h1>
                <span className="page-toolbar-subtitle">Panne · Cause · Remède</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="mb-3 text-xs text-muted">
            Renseignés à la clôture d&apos;un OT correctif ; analysés dans la page Fiabilité.
          </p>
          <FailureCodesManager codes={codes} />
        </div>
      </div>
    </>
  );
}
