'use server';

import { revalidatePath } from 'next/cache';
import type { ReportType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

function isUnknownReportTypeArgument(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('Unknown argument `reportType`');
}

function isUnknownInterventionFieldArgument(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('Unknown argument `company`') ||
    error.message.includes('Unknown argument `interventionReason`') ||
    error.message.includes('Unknown argument `requestedBy`') ||
    error.message.includes('Unknown argument `intervenedBy`')
  );
}

export type CreateIncidentReportInput = {
  reportType?: ReportType;
  dateTime: string;
  subject?: string;
  description?: string;
  company?: string;
  interventionReason?: string;
  requestedBy?: string;
  intervenedBy?: string;
  resolutionTime?: string;
  personsInvolved?: string;
  correctiveActions?: string;
  notes?: string;
  locationId?: string;
};

export type UpdateIncidentReportInput = {
  id: string;
  reportType?: ReportType;
  dateTime?: string;
  subject?: string;
  description?: string;
  company?: string;
  interventionReason?: string;
  requestedBy?: string;
  intervenedBy?: string;
  resolutionTime?: string;
  personsInvolved?: string;
  correctiveActions?: string;
  notes?: string;
  locationId?: string;
};

export async function createIncidentReport(input: CreateIncidentReportInput) {
  const user = await requireRole(['ADMIN', 'MANAGER']);
  const reportType = input.reportType ?? 'INCIDENT';

  if (reportType === 'INCIDENT') {
    if (!input.subject?.trim() || !input.description?.trim()) {
      throw new Error("Pour un incident, les champs objet et description sont obligatoires.");
    }
  } else {
    if (!input.company?.trim() || !input.interventionReason?.trim() || !input.requestedBy?.trim() || !input.intervenedBy?.trim()) {
      throw new Error("Pour une intervention, entreprise, raison, demandée par et intervenant sont obligatoires.");
    }
  }

  let report;
  try {
    report = await prisma.incidentReport.create({
      data: {
        reportType,
        dateTime: new Date(input.dateTime),
        subject: reportType === 'INCIDENT' ? input.subject?.trim() || null : null,
        description: reportType === 'INCIDENT' ? input.description?.trim() || null : null,
        company: reportType === 'INTERVENTION' ? input.company?.trim() || null : null,
        interventionReason: reportType === 'INTERVENTION' ? input.interventionReason?.trim() || null : null,
        requestedBy: reportType === 'INTERVENTION' ? input.requestedBy?.trim() || null : null,
        intervenedBy: reportType === 'INTERVENTION' ? input.intervenedBy?.trim() || null : null,
        resolutionTime: reportType === 'INCIDENT' ? input.resolutionTime || null : null,
        personsInvolved: reportType === 'INCIDENT' ? input.personsInvolved || null : null,
        correctiveActions: reportType === 'INCIDENT' ? input.correctiveActions || null : null,
        notes: input.notes || null,
        locationId: reportType === 'INCIDENT' ? input.locationId || null : null,
        createdById: user.id,
      },
    });
  } catch (error) {
    if (isUnknownReportTypeArgument(error) || isUnknownInterventionFieldArgument(error)) {
      if (reportType === 'INTERVENTION') {
        throw new Error("Mode intervention indisponible: migration Prisma non appliquée.");
      }
      report = await prisma.incidentReport.create({
        data: {
          dateTime: new Date(input.dateTime),
          subject: input.subject?.trim() || null,
          description: input.description?.trim() || null,
          resolutionTime: input.resolutionTime || null,
          personsInvolved: input.personsInvolved || null,
          correctiveActions: input.correctiveActions || null,
          notes: input.notes || null,
          locationId: input.locationId || null,
          createdById: user.id,
        },
      });
    } else {
      throw error;
    }
  }

  revalidatePath('/backoffice/incident-reports');
  return report;
}

export async function updateIncidentReport(input: UpdateIncidentReportInput) {
  await requireRole(['ADMIN', 'MANAGER']);
  const existing = await prisma.incidentReport.findUnique({
    where: { id: input.id },
    select: { reportType: true },
  });
  if (!existing) {
    throw new Error('Rapport introuvable');
  }
  const reportType = input.reportType ?? existing.reportType;

  if (reportType === 'INCIDENT') {
    if (!input.subject?.trim() || !input.description?.trim()) {
      throw new Error("Pour un incident, les champs objet et description sont obligatoires.");
    }
  } else {
    if (!input.company?.trim() || !input.interventionReason?.trim() || !input.requestedBy?.trim() || !input.intervenedBy?.trim()) {
      throw new Error("Pour une intervention, entreprise, raison, demandée par et intervenant sont obligatoires.");
    }
  }

  let report;
  try {
    report = await prisma.incidentReport.update({
      where: { id: input.id },
      data: {
        reportType,
        ...(input.dateTime !== undefined && { dateTime: new Date(input.dateTime) }),
        subject: reportType === 'INCIDENT' ? input.subject?.trim() || null : null,
        description: reportType === 'INCIDENT' ? input.description?.trim() || null : null,
        company: reportType === 'INTERVENTION' ? input.company?.trim() || null : null,
        interventionReason: reportType === 'INTERVENTION' ? input.interventionReason?.trim() || null : null,
        requestedBy: reportType === 'INTERVENTION' ? input.requestedBy?.trim() || null : null,
        intervenedBy: reportType === 'INTERVENTION' ? input.intervenedBy?.trim() || null : null,
        resolutionTime: reportType === 'INCIDENT' ? input.resolutionTime || null : null,
        personsInvolved: reportType === 'INCIDENT' ? input.personsInvolved || null : null,
        correctiveActions: reportType === 'INCIDENT' ? input.correctiveActions || null : null,
        notes: input.notes || null,
        locationId: reportType === 'INCIDENT' ? input.locationId || null : null,
      },
    });
  } catch (error) {
    if (isUnknownReportTypeArgument(error) || isUnknownInterventionFieldArgument(error)) {
      if (reportType === 'INTERVENTION') {
        throw new Error("Mode intervention indisponible: migration Prisma non appliquée.");
      }
      report = await prisma.incidentReport.update({
        where: { id: input.id },
        data: {
          ...(input.dateTime !== undefined && { dateTime: new Date(input.dateTime) }),
          subject: input.subject?.trim() || null,
          description: input.description?.trim() || null,
          resolutionTime: input.resolutionTime || null,
          personsInvolved: input.personsInvolved || null,
          correctiveActions: input.correctiveActions || null,
          notes: input.notes || null,
          locationId: input.locationId || null,
        },
      });
    } else {
      throw error;
    }
  }

  revalidatePath('/backoffice/incident-reports');
  revalidatePath(`/backoffice/incident-reports/${input.id}`);
  return report;
}

export async function deleteIncidentReport(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  await prisma.incidentReport.delete({
    where: { id },
  });

  revalidatePath('/backoffice/incident-reports');
}

export async function getIncidentReports(reportType?: ReportType) {
  await requireRole(['ADMIN', 'MANAGER']);

  try {
    return await prisma.incidentReport.findMany({
      ...(reportType ? { where: { reportType } } : {}),
      include: {
        createdBy: {
          select: { displayName: true },
        },
        location: {
          select: { name: true, code: true },
        },
      },
      orderBy: { dateTime: 'desc' },
    });
  } catch (error) {
    if (!isUnknownReportTypeArgument(error)) throw error;
    const reports = await prisma.incidentReport.findMany({
      include: {
        createdBy: {
          select: { displayName: true },
        },
        location: {
          select: { name: true, code: true },
        },
      },
      orderBy: { dateTime: 'desc' },
    });
    return reports
      .map((report) => ({
        ...report,
        reportType: 'INCIDENT' as const,
        company: null,
        interventionReason: null,
        requestedBy: null,
        intervenedBy: null,
      }))
      .filter((report) => !reportType || report.reportType === reportType);
  }
}

export async function getIncidentReportById(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  let report;
  try {
    report = await prisma.incidentReport.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { displayName: true, email: true },
        },
        location: {
          select: { name: true, code: true },
        },
      },
    });
  } catch (error) {
    if (!isUnknownReportTypeArgument(error) && !isUnknownInterventionFieldArgument(error)) throw error;
    const legacyReport = await prisma.incidentReport.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { displayName: true, email: true },
        },
        location: {
          select: { name: true, code: true },
        },
      },
    });
    report = legacyReport
      ? {
          ...legacyReport,
          reportType: 'INCIDENT' as const,
          company: null,
          interventionReason: null,
          requestedBy: null,
          intervenedBy: null,
        }
      : null;
  }

  if (!report) {
    throw new Error('Rapport introuvable');
  }

  return report;
}
