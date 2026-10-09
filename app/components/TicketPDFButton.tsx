'use client';

import { useState } from 'react';
import jsPDF from 'jspdf';

type TicketPDFData = {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  status: { name: string };
  team: { name: string };
  equipment: { name: string; refCode: string };
  location: { name: string } | null;
  requester: { displayName: string; email: string };
  maintainer: { name: string; contact: string | null } | null;
  quoteNumber: string | null;
  invoiceNumber: string | null;
  createdAt: Date;
  openedAt: Date;
  dueDate: Date | null;
  closedAt: Date | null;
  isArchived: boolean;
};

export default function TicketPDFButton({ ticket }: { ticket: TicketPDFData }) {
  const [generating, setGenerating] = useState(false);

  const generatePDF = () => {
    setGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const addBlock = (label: string, value: string) => {
        const labelHeight = 5;
        const lines = doc.splitTextToSize(value || '-', contentWidth);
        const blockHeight = labelHeight + lines.length * 4.5 + 4;

        if (y + blockHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(label, margin, y);
        y += labelHeight;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(lines, margin, y);
        y += lines.length * 4.5 + 4;
      };

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text('Ticket de maintenance', margin, y);
      y += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Reference: #${ticket.ticketNumber} (${ticket.id})`, margin, y);
      y += 4.5;
      doc.text(`Genere le ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`, margin, y);
      y += 5;

      doc.setDrawColor(148, 163, 184);
      doc.line(margin, y, pageWidth - margin, y);
      y += 7;

      addBlock('Titre', ticket.title);
      addBlock('Description', ticket.description);
      addBlock('Statut', ticket.status.name);
      addBlock('Equipe', ticket.team.name);
      addBlock('Equipement', `${ticket.equipment.refCode} - ${ticket.equipment.name}`);
      addBlock('Localisation', ticket.location?.name || 'Global');
      addBlock('Demandeur', `${ticket.requester.displayName} (${ticket.requester.email})`);
      addBlock('Mainteneur', ticket.maintainer ? `${ticket.maintainer.name}${ticket.maintainer.contact ? ` (${ticket.maintainer.contact})` : ''}` : 'Non assigne');
      addBlock('Devis / Facture', `${ticket.quoteNumber || '-'} / ${ticket.invoiceNumber || '-'}`);
      addBlock(
        'Dates',
        [
          `Creation: ${new Date(ticket.createdAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`,
          `Ouverture: ${new Date(ticket.openedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`,
          `Echeance: ${ticket.dueDate ? new Date(ticket.dueDate).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '-'}`,
          `Fermeture: ${ticket.closedAt ? new Date(ticket.closedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '-'}`,
          `Archive: ${ticket.isArchived ? 'Oui' : 'Non'}`,
        ].join('\n')
      );

      doc.save(`ticket-${ticket.ticketNumber}.pdf`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={generatePDF}
      disabled={generating}
      className="px-3 py-1.5 text-sm font-medium bg-surface-alt text-foreground border border-border-default rounded-lg transition-colors hover:bg-surface disabled:opacity-50"
    >
      {generating ? 'Generation...' : 'Exporter PDF'}
    </button>
  );
}
