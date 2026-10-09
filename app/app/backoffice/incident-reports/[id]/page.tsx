import { getIncidentReportById } from '@/lib/actions/incidentReports';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import IncidentReportForm from '@/components/IncidentReportForm';
import IncidentReportPDF from '@/components/IncidentReportPDF';

export default async function EditIncidentReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const { id } = await params;

  let report;
  try {
    report = await getIncidentReportById(id);
  } catch {
    notFound();
  }

  const [locations, criticalCount] = await Promise.all([
    prisma.location.findMany({ select: { id: true, name: true, code: true }, orderBy: { code: 'asc' } }),
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
                <Link href="/backoffice/incident-reports" className="text-xs text-muted hover:text-foreground transition-colors duration-150 ease-out">
                  ← Retour aux rapports
                </Link>
                <span className="text-border-default">|</span>
                <h1 className="page-toolbar-title">Modifier le rapport</h1>
                <span className="page-toolbar-subtitle">
                  {new Date(report.createdAt).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}
                </span>
              </div>
              <IncidentReportPDF report={report} />
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-white/70 dark:bg-[#121821]/70 border border-border-default rounded-xl p-4 mb-4 backdrop-blur shadow-soft-md">
            <p className="text-xs text-muted mb-4">
              Créée par {report.createdBy.displayName}
            </p>
            <IncidentReportForm report={report} locations={locations} />
          </div>
        </div>
      </div>
    </>
  );
}
