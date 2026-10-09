import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { getSkills, getTechniciansWithSkills, getTimesheet } from '@/lib/actions/technicians';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import TechniciansManager from '@/components/TechniciansManager';

export default async function TechniciansPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const [skills, technicians, timesheet, criticalCount] = await Promise.all([
    getSkills(),
    getTechniciansWithSkills(),
    getTimesheet(30),
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
                <h1 className="page-toolbar-title">Techniciens &amp; compétences</h1>
                <span className="page-toolbar-subtitle tabular-nums">{technicians.length} technicien(s)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <TechniciansManager skills={skills} technicians={technicians} timesheet={timesheet} />
        </div>
      </div>
    </>
  );
}
