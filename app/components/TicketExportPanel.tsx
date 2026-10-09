'use client';

import { useState } from 'react';
import jsPDF from 'jspdf';
import { exportTicketsToCSV, getTicketsForExport } from '@/lib/actions/exports';

type FilterOption = {
  id: string;
  label: string;
};

export default function TicketExportPanel({
  teams,
  locations,
  statuses,
}: {
  teams: FilterOption[];
  locations: FilterOption[];
  statuses: FilterOption[];
}) {
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    teamId: '',
    locationId: '',
    statusId: '',
  });

  const buildFilters = () => ({
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    teamId: filters.teamId || undefined,
    locationId: filters.locationId || undefined,
    statusId: filters.statusId || undefined,
  });

  const handleExportCsv = async () => {
    setLoadingCsv(true);
    try {
      const csvContent = await exportTicketsToCSV(buildFilters());

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `tickets-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (error: any) {
      alert(error.message || "Erreur lors de l'export");
    } finally {
      setLoadingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    setLoadingPdf(true);
    try {
      const tickets = await getTicketsForExport(buildFilters());

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Export tickets filtres', margin, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Genere le ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`, margin, y);
      y += 6;
      doc.setDrawColor(148, 163, 184);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      if (tickets.length === 0) {
        doc.setFontSize(10);
        doc.text('Aucun ticket pour ces filtres.', margin, y);
      } else {
        for (const ticket of tickets) {
          const lines = [
            `${ticket.title} (${ticket.status.name})`,
            `Equipe: ${ticket.team.name} | Site: ${ticket.location?.name || 'Global'}`,
            `Equipement: ${ticket.equipment.refCode} - ${ticket.equipment.name}`,
            `Demandeur: ${ticket.requester.displayName} | Date: ${new Date(ticket.createdAt).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`,
          ];

          const wrapped = lines.flatMap((line) => doc.splitTextToSize(line, contentWidth));
          const blockHeight = wrapped.length * 4.5 + 6;

          if (y + blockHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text(wrapped[0], margin, y);
          y += 4.5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          for (const line of wrapped.slice(1)) {
            doc.text(line, margin, y);
            y += 4.5;
          }
          y += 1.5;
          doc.setDrawColor(226, 232, 240);
          doc.line(margin, y, pageWidth - margin, y);
          y += 4.5;
        }
      }

      doc.save(`tickets-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error: any) {
      alert(error.message || "Erreur lors de l'export");
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Date début
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            className="w-full rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Date fin
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            className="w-full rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Équipe
          </label>
          <select
            value={filters.teamId}
            onChange={(e) => setFilters((prev) => ({ ...prev, teamId: e.target.value }))}
            className="w-full rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
          >
            <option value="">Toutes</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Localisation
          </label>
          <select
            value={filters.locationId}
            onChange={(e) => setFilters((prev) => ({ ...prev, locationId: e.target.value }))}
            className="w-full rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
          >
            <option value="">Toutes</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Statut
          </label>
          <select
            value={filters.statusId}
            onChange={(e) => setFilters((prev) => ({ ...prev, statusId: e.target.value }))}
            className="w-full rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
          >
            <option value="">Tous</option>
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExportCsv}
          disabled={loadingCsv || loadingPdf}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          {loadingCsv ? 'Export CSV...' : 'Télécharger CSV filtré'}
        </button>
        <button
          onClick={handleExportPdf}
          disabled={loadingCsv || loadingPdf}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-surface-alt text-foreground border border-border-default rounded-lg transition-colors hover:bg-surface disabled:opacity-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          {loadingPdf ? 'Export PDF...' : 'Télécharger PDF filtré'}
        </button>
      </div>
    </div>
  );
}
