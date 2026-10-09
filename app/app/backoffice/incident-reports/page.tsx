import { getIncidentReports } from '@/lib/actions/incidentReports';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';

type ReportTypeFilter = 'ALL' | 'INCIDENT' | 'INTERVENTION';

function parseReportTypeFilter(value?: string): ReportTypeFilter {
  if (value === 'INCIDENT' || value === 'INTERVENTION') return value;
  return 'ALL';
}

function reportTypeLabel(type: 'INCIDENT' | 'INTERVENTION') {
  return type === 'INCIDENT' ? 'Incident' : 'Intervention';
}

function reportTitle(report: {
  subject: string | null;
  interventionReason: string | null;
}) {
  return report.subject || report.interventionReason || '—';
}

export default async function IncidentReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const params = searchParams ? await searchParams : undefined;
  const selectedType = parseReportTypeFilter(params?.type);

  const [reports, criticalCount] = await Promise.all([
    getIncidentReports(selectedType === 'ALL' ? undefined : selectedType),
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
                <h1 className="page-toolbar-title">Rapports</h1>
                <span className="page-toolbar-subtitle">{reports.length} rapport(s) trouvé(s)</span>
              </div>
              <Link href="/backoffice/incident-reports/new" className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] transition-colors duration-150 ease-out">
                + Nouveau rapport
              </Link>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-muted">Type :</span>
              <Link
                href="/backoffice/incident-reports"
                className={`px-2 py-1 text-xs rounded-lg border transition-colors duration-150 ease-out ${
                  selectedType === 'ALL'
                    ? 'bg-[#e8513b]/10 border-[color:var(--accent)] text-[color:var(--accent)]'
                    : 'bg-surface border-border-default text-muted hover:text-foreground'
                }`}
              >
                Tous
              </Link>
              <Link
                href="/backoffice/incident-reports?type=INCIDENT"
                className={`px-2 py-1 text-xs rounded-lg border transition-colors duration-150 ease-out ${
                  selectedType === 'INCIDENT'
                    ? 'bg-[#e8513b]/10 border-[color:var(--accent)] text-[color:var(--accent)]'
                    : 'bg-surface border-border-default text-muted hover:text-foreground'
                }`}
              >
                Incidents
              </Link>
              <Link
                href="/backoffice/incident-reports?type=INTERVENTION"
                className={`px-2 py-1 text-xs rounded-lg border transition-colors duration-150 ease-out ${
                  selectedType === 'INTERVENTION'
                    ? 'bg-[#e8513b]/10 border-[color:var(--accent)] text-[color:var(--accent)]'
                    : 'bg-surface border-border-default text-muted hover:text-foreground'
                }`}
              >
                Interventions
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

        <div className="bg-surface border border-border-default rounded-xl shadow-soft-md overflow-hidden">
          {reports.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted">
              Aucun rapport. Créez-en un pour commencer.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-[color:var(--border-default)]">
              <thead className="bg-surface-alt">
                <tr>
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Type</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Date</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Objet</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Localisation</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Résolution</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Créé par</th>
                  <th className="px-3 py-1.5 text-right text-xs font-medium text-muted uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-default)]">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-surface-alt transition-colors duration-150 ease-out">
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded border border-border-default text-muted">
                        {reportTypeLabel(report.reportType)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-foreground tabular-nums">
                      {new Date(report.dateTime).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      <span className="text-muted ml-1">
                        {new Date(report.dateTime).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-foreground">{reportTitle(report)}</td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {report.location ? `${report.location.code} - ${report.location.name}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {report.reportType === 'INTERVENTION' ? report.intervenedBy || '—' : report.resolutionTime || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{report.createdBy.displayName}</td>
                    <td className="px-3 py-2 text-xs text-right">
                      <Link href={`/backoffice/incident-reports/${report.id}`} className="text-[color:var(--accent)] hover:opacity-80 transition-opacity">
                        Voir / Modifier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </div>
      </div>
    </>
  );
}
