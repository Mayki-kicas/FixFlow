'use client';

import { useState } from 'react';
import jsPDF from 'jspdf';

type Report = {
  id: string;
  reportType: 'INCIDENT' | 'INTERVENTION';
  dateTime: Date;
  subject: string | null;
  description: string | null;
  company: string | null;
  interventionReason: string | null;
  requestedBy: string | null;
  intervenedBy: string | null;
  resolutionTime: string | null;
  personsInvolved: string | null;
  correctiveActions: string | null;
  notes: string | null;
  location: { name: string; code: string } | null;
  createdBy: { displayName: string; email: string };
  createdAt: Date;
};

type IncidentReportPDFProps = {
  report: Report;
};

export default function IncidentReportPDF({ report }: IncidentReportPDFProps) {
  const [generating, setGenerating] = useState(false);

  const generatePDF = () => {
    setGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = 20;

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text("FixFlow", margin, y);
      y += 8;
      doc.setFontSize(14);
      doc.text('Rapport operationnel', margin, y);
      y += 4;
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 12;

      const addField = (label: string, value: string) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text(label, margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const lines = doc.splitTextToSize(value, contentWidth);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 6;
      };

      const dateStr = new Date(report.dateTime).toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      addField('Type de rapport', report.reportType === 'INCIDENT' ? 'Incident' : 'Intervention');
      addField('Date et heure', dateStr);

      if (report.reportType === 'INTERVENTION') {
        if (report.company) addField('Entreprise', report.company);
        if (report.interventionReason) addField('Raison', report.interventionReason);
        if (report.requestedBy) addField('Demandee par', report.requestedBy);
        if (report.intervenedBy) addField('Intervenant', report.intervenedBy);
      } else {
        if (report.location) {
          addField('Localisation', `${report.location.code} - ${report.location.name}`);
        }
        if (report.subject) addField('Objet du rapport', report.subject);
        if (report.description) addField('Description', report.description);
        if (report.resolutionTime) addField('Temps de resolution', report.resolutionTime);
        if (report.personsInvolved) addField('Personnes impliquees', report.personsInvolved);
        if (report.correctiveActions) addField('Actions correctives', report.correctiveActions);
      }

      if (report.notes) {
        addField('Notes supplementaires', report.notes);
      }

      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Redige par : ${report.createdBy.displayName}`,
        margin,
        y
      );
      y += 4;
      doc.text(
        `Document genere le ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`,
        margin,
        y
      );

      const now = new Date();
      const parts = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(now);

      const getPart = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value || '00';

      const fileTimestamp = `${getPart('year')}${getPart('month')}${getPart('day')}-${getPart('hour')}${getPart('minute')}${getPart('second')}`;
      doc.save(`rapport-${fileTimestamp}.pdf`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={generatePDF}
      disabled={generating}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
      {generating ? 'Generation...' : 'Telecharger le PDF'}
    </button>
  );
}
