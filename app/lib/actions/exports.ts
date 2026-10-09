'use server';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { buildCsv } from '@/lib/csv';

// Borne de sécurité pour éviter un export non borné (OOM).
const EXPORT_MAX_ROWS = 50_000;

export type ExportTicketFilters = {
  teamId?: string;
  locationId?: string;
  statusId?: string;
  startDate?: string;
  endDate?: string;
};

export async function getTicketsForExport(filters?: ExportTicketFilters) {
  await requireRole(['ADMIN', 'MANAGER']);

  const where: any = {};

  if (filters?.teamId) where.teamId = filters.teamId;
  if (filters?.locationId) where.locationId = filters.locationId;
  if (filters?.statusId) where.statusId = filters.statusId;
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = endDate;
    }
  }

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      equipment: {
        include: {
          category: true,
        },
      },
      location: true,
      team: true,
      status: true,
      requester: {
        select: {
          displayName: true,
          email: true,
        },
      },
      maintainer: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: EXPORT_MAX_ROWS,
  });

  return tickets;
}

export async function exportTicketsToCSV(filters?: ExportTicketFilters) {
  const tickets = await getTicketsForExport(filters);

  // Générer le CSV
  const headers = [
    'ID',
    'Titre',
    'Description',
    'Statut',
    'Équipement',
    'Catégorie',
    'Localisation',
    'Équipe',
    'Demandeur',
    'Email Demandeur',
    'Mainteneur',
    'N° Devis',
    'N° Facture',
    'Date Ouverture',
    'Date Fermeture',
    'Archivé',
  ];

  const rows = tickets.map((ticket) => [
    ticket.id,
    ticket.title,
    ticket.description,
    ticket.status.name,
    ticket.equipment.name,
    ticket.equipment.category.name,
    ticket.location?.name || 'Global',
    ticket.team.name,
    ticket.requester.displayName,
    ticket.requester.email,
    ticket.maintainer?.name || '',
    ticket.quoteNumber || '',
    ticket.invoiceNumber || '',
    ticket.openedAt.toISOString(),
    ticket.closedAt?.toISOString() || '',
    ticket.isArchived ? 'Oui' : 'Non',
  ]);

  return buildCsv(headers, rows);
}

export async function exportEquipmentsToCSV() {
  await requireRole(['ADMIN', 'MANAGER']);

  const equipments = await prisma.equipment.findMany({
    include: {
      category: true,
      location: true,
      team: true,
      _count: {
        select: {
          tickets: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
    take: EXPORT_MAX_ROWS,
  });

  const headers = [
    'Référence',
    'Nom',
    'Catégorie',
    'Localisation',
    'Code Site',
    'Équipe',
    'Nombre de Tickets',
  ];

  const rows = equipments.map((equipment) => [
    equipment.refCode,
    equipment.name,
    equipment.category.name,
    equipment.location?.name || 'Global',
    equipment.location?.code || '',
    equipment.team.name,
    equipment._count.tickets.toString(),
  ]);

  return buildCsv(headers, rows);
}

export async function exportLocationsToCSV() {
  await requireRole(['ADMIN', 'MANAGER']);

  const locations = await prisma.location.findMany({
    include: {
      _count: {
        select: {
          equipments: true,
          tickets: true,
        },
      },
    },
    orderBy: {
      code: 'asc',
    },
    take: EXPORT_MAX_ROWS,
  });

  const headers = [
    'Code',
    'Nom',
    'Adresse',
    'Ville',
    'Code Postal',
    'Email',
    'Nombre Équipements',
    'Nombre Tickets',
  ];

  const rows = locations.map((location) => [
    location.code,
    location.name,
    location.address || '',
    location.city || '',
    location.postalCode || '',
    location.email || '',
    location._count.equipments.toString(),
    location._count.tickets.toString(),
  ]);

  return buildCsv(headers, rows);
}

const QUOTE_STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Demandé',
  RECEIVED: 'Reçu',
  ACCEPTED: 'Accepté',
  REJECTED: 'Refusé',
};

export async function exportQuotesToCSV() {
  await requireRole(['ADMIN', 'MANAGER']);

  const quotes = await prisma.quote.findMany({
    include: {
      ticket: { select: { ticketNumber: true, title: true, quoteDeadline: true } },
      maintainer: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: EXPORT_MAX_ROWS,
  });

  const fr = (d: Date | null) => (d ? d.toLocaleDateString('fr-FR') : '');

  const headers = [
    'N° Ticket',
    'Titre Ticket',
    'Prestataire',
    'Statut',
    'Montant HT',
    'Devise',
    'Référence',
    'Demandé le',
    'Échéance SLA',
    'Reçu le',
    'Valide jusqu\'au',
    'Décidé le',
  ];

  const rows = quotes.map((quote) => [
    quote.ticket.ticketNumber.toString(),
    quote.ticket.title,
    quote.maintainer?.name || '',
    QUOTE_STATUS_LABEL[quote.status] || quote.status,
    quote.amountCents != null ? (quote.amountCents / 100).toFixed(2) : '',
    quote.currency,
    quote.reference || '',
    fr(quote.requestedAt),
    fr(quote.ticket.quoteDeadline),
    fr(quote.receivedAt),
    fr(quote.validUntil),
    fr(quote.decidedAt),
  ]);

  return buildCsv(headers, rows);
}
