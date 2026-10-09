import { getMaintainers } from '@/lib/actions/maintainers';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import MaintainerManager from '@/components/MaintainerManager';

export default async function MaintainersPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const [maintainers, criticalCount] = await Promise.all([
    getMaintainers(),
    prisma.ticket.count({ where: { priority: 'P1', isArchived: false } }),
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
                <h1 className="page-toolbar-title">Mainteneurs</h1>
                <span className="page-toolbar-subtitle tabular-nums">{maintainers.length} mainteneur(s) / prestataire(s) externe(s)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="card p-4">
            <MaintainerManager maintainers={maintainers} />
          </div>
        </div>
      </div>
    </>
  );
}
