'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/session';
import { canDeclareTicket, TICKET_MANAGER_ROLES } from '@/lib/access-policy';
import {
  isDemandeReviewer,
  getManagedLocationIds,
  demandeReviewWhere,
  canReviewDemandeLocation,
} from '@/lib/demande-review';
import { createTicketRecord } from '@/lib/tickets-core';
import { storeUploadedFiles } from '@/lib/attachments-core';
import { createNotificationsForUsers } from '@/lib/notifications-core';
import { logAudit } from '@/lib/audit';
import { getAttachmentLimits } from '@/lib/security';
import { Priority } from '@prisma/client';

// Soumission d'une DEMANDE (idée/suggestion) : simple — titre + description + localisation
// (optionnelle) + photos. PAS d'équipement ni de priorité : le manager les fixe à la
// validation. BASIC+ (hors MAINTAINER).
export async function createDemandeWithAttachments(formData: FormData) {
  const user = await requireAuth();
  if (!canDeclareTicket(user.role)) {
    throw new Error('Accès refusé');
  }

  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const locationId = String(formData.get('locationId') || '').trim() || null;
  const files = formData.getAll('files') as File[];
  const { ticketMaxFiles } = getAttachmentLimits();

  if (!title || !description) {
    throw new Error('Veuillez remplir le titre et la description');
  }
  if (title.length < 3 || title.length > 160) {
    throw new Error('Titre invalide');
  }
  if (description.length < 3 || description.length > 5000) {
    throw new Error('Description invalide');
  }
  if (files.length > ticketMaxFiles) {
    throw new Error(`Nombre max de pieces jointes depasse (${ticketMaxFiles})`);
  }

  const demande = await prisma.demande.create({
    data: { title, description, locationId, requesterId: user.id, status: 'PENDING' },
  });

  await storeUploadedFiles(files, { demandeId: demande.id }, user.id);

  // Notifier les valideurs : tous les ADMIN + les managers responsables du site
  // (ou tous les managers si la demande n'a pas de site).
  const reviewers = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'ADMIN' },
        locationId
          ? { role: 'MANAGER', managedLocations: { some: { id: locationId } } }
          : { role: 'MANAGER' },
      ],
    },
    select: { id: true },
  });
  await createNotificationsForUsers({
    userIds: reviewers.map((r) => r.id),
    type: 'SYSTEM',
    title: 'Nouvelle demande',
    message: `${user.displayName} a soumis une demande : "${title}"`,
    link: '/demandes',
  });

  revalidatePath('/demandes');
  await logAudit({ actorId: user.id, entity: 'DEMANDE', entityId: demande.id, action: 'DEMANDE_CREATED', changes: { title } });
  return { id: demande.id };
}

export async function getPendingDemandes() {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  const managed = user.role === 'ADMIN' ? [] : await getManagedLocationIds(user.id);
  return prisma.demande.findMany({
    where: { status: 'PENDING', ...demandeReviewWhere(user.role, managed) },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      suggestedPriority: true,
      requester: { select: { displayName: true, email: true } },
      equipment: { select: { name: true, refCode: true } },
      location: { select: { name: true } },
      _count: { select: { attachments: true } },
    },
  });
}

// Demandes de l'utilisateur courant (vue "mes demandes").
export async function getMyDemandes() {
  const user = await requireAuth();
  return prisma.demande.findMany({
    where: { requesterId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      decidedAt: true,
      ticket: { select: { id: true, ticketNumber: true } },
    },
  });
}

// Détail d'une demande : accessible à son auteur OU à un valideur (ADMIN/MANAGER).
export async function getDemandeById(id: string) {
  const user = await requireAuth();
  const demande = await prisma.demande.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      suggestedPriority: true,
      rejectionReason: true,
      createdAt: true,
      decidedAt: true,
      requesterId: true,
      locationId: true,
      requester: { select: { displayName: true, email: true } },
      equipment: { select: { name: true, refCode: true } },
      location: { select: { name: true } },
      decidedBy: { select: { displayName: true } },
      ticket: { select: { id: true, ticketNumber: true } },
      attachments: { select: { id: true, type: true, fileName: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!demande) return null;

  const isOwner = demande.requesterId === user.id;
  let canReview = false;
  if (isDemandeReviewer(user.role)) {
    const managed = user.role === 'ADMIN' ? [] : await getManagedLocationIds(user.id);
    canReview = canReviewDemandeLocation(user.role, managed, demande.locationId);
  }
  if (!isOwner && !canReview) {
    return null; // 404 côté page (ne révèle pas l'existence)
  }
  return { ...demande, canReview };
}

export async function convertDemandeToTicket(demandeId: string, equipmentId: string, priority?: Priority) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  const targetEquipmentId = equipmentId?.trim();
  if (!targetEquipmentId) {
    throw new Error('Choisis un équipement pour créer le ticket');
  }

  const demande = await prisma.demande.findUnique({
    where: { id: demandeId },
    select: {
      id: true,
      status: true,
      title: true,
      description: true,
      equipmentId: true,
      locationId: true,
      suggestedPriority: true,
      requesterId: true,
      requester: { select: { displayName: true } },
    },
  });
  if (!demande) throw new Error('Demande introuvable');
  if (demande.status !== 'PENDING') throw new Error('Cette demande a déjà été traitée');

  // Scope : seul un responsable du site de la demande (ou un ADMIN) peut la valider.
  const managed = user.role === 'ADMIN' ? [] : await getManagedLocationIds(user.id);
  if (!canReviewDemandeLocation(user.role, managed, demande.locationId)) {
    throw new Error("Vous n'êtes pas responsable du site de cette demande");
  }

  // Claim atomique : une seule validation concurrente passe (évite de créer 2 tickets).
  const claim = await prisma.demande.updateMany({
    where: { id: demande.id, status: 'PENDING' },
    data: { status: 'CONVERTED', decidedByUserId: user.id, decidedAt: new Date() },
  });
  if (claim.count === 0) {
    throw new Error('Cette demande a déjà été traitée');
  }

  let ticket;
  try {
    ticket = await createTicketRecord({
      title: demande.title,
      description: demande.description,
      equipmentId: targetEquipmentId,
      locationId: demande.locationId,
      nature: 'IMPROVEMENT',
      priority: priority ?? demande.suggestedPriority ?? undefined,
      requesterId: demande.requesterId,
      requesterName: demande.requester.displayName,
      actorId: user.id,
      actorName: user.displayName,
    });
  } catch (error) {
    // Rien créé : on rend la demande de nouveau traitable.
    await prisma.demande.update({
      where: { id: demande.id },
      data: { status: 'PENDING', decidedByUserId: null, decidedAt: null },
    });
    throw error;
  }

  // Rattache les photos de la demande au ticket créé + lie le ticket.
  await prisma.attachment.updateMany({
    where: { demandeId: demande.id },
    data: { ticketId: ticket.id, demandeId: null },
  });
  await prisma.demande.update({
    where: { id: demande.id },
    data: { ticketId: ticket.id },
  });

  await createNotificationsForUsers({
    userIds: [demande.requesterId],
    type: 'SYSTEM',
    title: 'Demande validée',
    message: `Votre demande "${demande.title}" a été transformée en ticket #${ticket.ticketNumber}.`,
    link: `/tickets/${ticket.id}`,
  });

  revalidatePath('/demandes');
  await logAudit({
    actorId: user.id,
    entity: 'DEMANDE',
    entityId: demande.id,
    ticketId: ticket.id,
    action: 'DEMANDE_CONVERTED',
    changes: { ticketNumber: ticket.ticketNumber },
  });
  return { ticketId: ticket.id, ticketNumber: ticket.ticketNumber };
}

export async function rejectDemande(demandeId: string, reason: string) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  const cleanReason = reason?.trim();
  if (!cleanReason) throw new Error('Motif de rejet requis');

  const demande = await prisma.demande.findUnique({
    where: { id: demandeId },
    select: { id: true, status: true, title: true, requesterId: true, locationId: true },
  });
  if (!demande) throw new Error('Demande introuvable');
  if (demande.status !== 'PENDING') throw new Error('Cette demande a déjà été traitée');

  // Scope : seul un responsable du site (ou un ADMIN) peut rejeter.
  const managed = user.role === 'ADMIN' ? [] : await getManagedLocationIds(user.id);
  if (!canReviewDemandeLocation(user.role, managed, demande.locationId)) {
    throw new Error("Vous n'êtes pas responsable du site de cette demande");
  }

  // Claim atomique : anti double-traitement concurrent.
  const claim = await prisma.demande.updateMany({
    where: { id: demande.id, status: 'PENDING' },
    data: { status: 'REJECTED', rejectionReason: cleanReason, decidedByUserId: user.id, decidedAt: new Date() },
  });
  if (claim.count === 0) throw new Error('Cette demande a déjà été traitée');

  await createNotificationsForUsers({
    userIds: [demande.requesterId],
    type: 'SYSTEM',
    title: 'Demande rejetée',
    message: `Votre demande "${demande.title}" a été rejetée. Motif : ${cleanReason}`,
    link: '/demandes/mine',
  });

  revalidatePath('/demandes');
  await logAudit({ actorId: user.id, entity: 'DEMANDE', entityId: demande.id, action: 'DEMANDE_REJECTED', changes: { reason: cleanReason } });
  return { status: 'REJECTED' as const };
}
