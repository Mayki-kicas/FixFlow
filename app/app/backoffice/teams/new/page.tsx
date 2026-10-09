import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import TeamForm from '@/components/TeamForm';

export default async function NewTeamPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const criticalCount = await prisma.ticket.count({ where: { priority: 'P1', isArchived: false } });

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <Link href="/backoffice/teams" className="text-xs text-muted hover:text-foreground transition-colors duration-150 ease-out">
                  ← Retour aux équipes
                </Link>
                <span className="text-border-default">|</span>
                <h1 className="page-toolbar-title">Nouvelle équipe</h1>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
            <TeamForm />
          </div>
        </div>
      </div>
    </>
  );
}
