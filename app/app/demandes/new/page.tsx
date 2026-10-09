import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { canDeclareTicket } from '@/lib/access-policy';
import DemandeForm from '@/components/DemandeForm';
import Header from '@/components/Header';

export default async function NewDemandePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!canDeclareTicket(user.role)) redirect('/');

  const [criticalCount, locations] = await Promise.all([
    getVisibleCriticalTicketsCountForUser(user),
    prisma.location.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <h1 className="page-toolbar-title">Soumettre une demande</h1>
                <span className="page-toolbar-subtitle">
                  Proposer une idée ou une amélioration — étudiée par un responsable avant de devenir un ticket
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <DemandeForm locations={locations} />
        </div>
      </div>
    </>
  );
}
