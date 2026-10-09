'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/session';
import { TICKET_MANAGER_ROLES } from '@/lib/access-policy';
import { ticketVisibilityWhere } from '@/lib/visibility';
import {
  putObject,
  deleteObject,
  buildFloorPlanKey,
  buildFloorPlanSourceKey,
} from '@/lib/storage';
import { convertDwgToSvg } from '@/lib/dwg';
import { logAudit } from '@/lib/audit';

const MAX_PLAN_BYTES = Number(process.env.FLOOR_PLAN_MAX_BYTES || 25 * 1024 * 1024);

// Types directement affichables par la visionneuse (le reste doit être converti).
const DISPLAYABLE_TYPES = new Set(['image/svg+xml', 'image/png', 'image/jpeg', 'application/pdf']);

function isDwgFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return lower.endsWith('.dwg') || file.type === 'image/vnd.dwg' || file.type === 'application/acad';
}

// Upload d'un plan d'étage. DWG -> converti en SVG ; sinon le fichier (SVG/PDF/image)
// est affiché tel quel. MANAGER/ADMIN.
export async function uploadFloorPlan(formData: FormData) {
  const user = await requireRole(TICKET_MANAGER_ROLES);

  const locationId = String(formData.get('locationId') || '').trim();
  const name = String(formData.get('name') || '').trim();
  const file = formData.get('file') as File | null;

  if (!locationId) throw new Error('Centre requis');
  if (!name || name.length < 1 || name.length > 80) throw new Error('Nom d’étage invalide');
  if (!file || file.size === 0) throw new Error('Fichier requis');
  if (file.size > MAX_PLAN_BYTES) {
    throw new Error(`Fichier trop volumineux (max ${Math.round(MAX_PLAN_BYTES / (1024 * 1024))} Mo)`);
  }

  const location = await prisma.location.findUnique({ where: { id: locationId }, select: { id: true } });
  if (!location) throw new Error('Centre introuvable');

  const buffer = Buffer.from(await file.arrayBuffer());
  const dwg = isDwgFile(file);
  if (!dwg && !DISPLAYABLE_TYPES.has(file.type)) {
    throw new Error('Format non supporté. Attendu : DWG, SVG, PDF, PNG ou JPEG.');
  }

  const count = await prisma.floorPlan.count({ where: { locationId } });

  // Ligne créée d'abord (id nécessaire aux clés de stockage), puis fichiers.
  const plan = await prisma.floorPlan.create({
    data: { locationId, name, order: count, svgStorageKey: 'pending' },
  });

  let dwgKey: string | null = null;
  try {
    let displayBuffer: Buffer = buffer;
    let contentType = file.type || 'application/octet-stream';

    if (dwg) {
      dwgKey = buildFloorPlanSourceKey(plan.id);
      await putObject(dwgKey, buffer);
      displayBuffer = await convertDwgToSvg(buffer);
      contentType = 'image/svg+xml';
    }

    const svgKey = buildFloorPlanKey(plan.id);
    await putObject(svgKey, displayBuffer);

    const saved = await prisma.floorPlan.update({
      where: { id: plan.id },
      data: { svgStorageKey: svgKey, contentType, dwgStorageKey: dwgKey },
    });

    revalidatePath('/plans');
    revalidatePath(`/plans/${locationId}`);
    await logAudit({ actorId: user.id, entity: 'FLOOR_PLAN', entityId: plan.id, action: 'FLOOR_PLAN_CREATED', changes: { name } });
    return saved;
  } catch (error) {
    // Rien de réutilisable : on nettoie la ligne et les fichiers partiels.
    await prisma.floorPlan.delete({ where: { id: plan.id } }).catch(() => {});
    if (dwgKey) await deleteObject(dwgKey).catch(() => {});
    await deleteObject(buildFloorPlanKey(plan.id)).catch(() => {});
    throw error;
  }
}

export async function renameFloorPlan(floorPlanId: string, name: string) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  const clean = name?.trim();
  if (!clean || clean.length > 80) throw new Error('Nom d’étage invalide');

  const plan = await prisma.floorPlan.update({
    where: { id: floorPlanId },
    data: { name: clean },
    select: { id: true, locationId: true },
  });

  revalidatePath(`/plans/${plan.locationId}`);
  await logAudit({ actorId: user.id, entity: 'FLOOR_PLAN', entityId: floorPlanId, action: 'FLOOR_PLAN_RENAMED', changes: { name: clean } });
  return { id: plan.id };
}

export async function deleteFloorPlan(floorPlanId: string) {
  const user = await requireRole(TICKET_MANAGER_ROLES);

  const plan = await prisma.floorPlan.findUnique({
    where: { id: floorPlanId },
    select: { id: true, locationId: true, svgStorageKey: true, dwgStorageKey: true },
  });
  if (!plan) throw new Error('Plan introuvable');

  // Les placements d'équipements sont détachés automatiquement (FK ON DELETE SET NULL).
  await prisma.floorPlan.delete({ where: { id: floorPlanId } });
  if (plan.svgStorageKey && plan.svgStorageKey !== 'pending') await deleteObject(plan.svgStorageKey).catch(() => {});
  if (plan.dwgStorageKey) await deleteObject(plan.dwgStorageKey).catch(() => {});

  revalidatePath('/plans');
  revalidatePath(`/plans/${plan.locationId}`);
  await logAudit({ actorId: user.id, entity: 'FLOOR_PLAN', entityId: floorPlanId, action: 'FLOOR_PLAN_DELETED' });
  return { ok: true };
}

// Pose / déplace un équipement sur un plan (coordonnées normalisées 0→1).
export async function placeEquipment(equipmentId: string, floorPlanId: string, x: number, y: number) {
  const user = await requireRole(TICKET_MANAGER_ROLES);

  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Coordonnées invalides');

  const plan = await prisma.floorPlan.findUnique({ where: { id: floorPlanId }, select: { id: true, locationId: true } });
  if (!plan) throw new Error('Plan introuvable');

  await prisma.equipment.update({
    where: { id: equipmentId },
    data: { floorPlanId, planX: clamp(x), planY: clamp(y) },
  });

  revalidatePath(`/plans/${plan.locationId}`);
  await logAudit({ actorId: user.id, entity: 'EQUIPMENT', entityId: equipmentId, action: 'EQUIPMENT_PLACED', changes: { floorPlanId } });
  return { ok: true };
}

const ALLOWED_ICONS = new Set(['gate', 'camera', 'door', 'elevator', 'generic']);

// Définit l'icône de marqueur d'un équipement (depuis la visionneuse). MANAGER/ADMIN.
export async function setEquipmentIcon(equipmentId: string, icon: string | null) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  const clean = icon && ALLOWED_ICONS.has(icon) ? icon : null;

  const eq = await prisma.equipment.update({
    where: { id: equipmentId },
    data: { icon: clean },
    select: { id: true, locationId: true },
  });
  if (eq.locationId) revalidatePath(`/plans/${eq.locationId}`);
  await logAudit({ actorId: user.id, entity: 'EQUIPMENT', entityId: equipmentId, action: 'EQUIPMENT_ICON_SET', changes: { icon: clean } });
  return { ok: true };
}

export async function unplaceEquipment(equipmentId: string) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  const eq = await prisma.equipment.update({
    where: { id: equipmentId },
    data: { floorPlanId: null, planX: null, planY: null },
    select: { id: true, locationId: true },
  });
  if (eq.locationId) revalidatePath(`/plans/${eq.locationId}`);
  await logAudit({ actorId: user.id, entity: 'EQUIPMENT', entityId: equipmentId, action: 'EQUIPMENT_UNPLACED' });
  return { ok: true };
}

// --- Lectures (visionneuse, ouverte à tout utilisateur authentifié) ---------

// Centres disposant d'au moins un plan (index de la rubrique).
export async function getLocationsWithPlans() {
  await requireAuth();
  return prisma.location.findMany({
    where: { floorPlans: { some: {} } },
    select: {
      id: true,
      code: true,
      name: true,
      city: true,
      _count: { select: { floorPlans: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getFloorPlansForLocation(locationId: string) {
  await requireAuth();
  return prisma.floorPlan.findMany({
    where: { locationId },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, order: true, contentType: true },
  });
}

// Plan + équipements posés dessus (pour le rendu des marqueurs).
export async function getFloorPlanWithEquipments(floorPlanId: string) {
  await requireAuth();
  return prisma.floorPlan.findUnique({
    where: { id: floorPlanId },
    select: {
      id: true,
      name: true,
      locationId: true,
      contentType: true,
      location: { select: { id: true, name: true, code: true } },
      placedEquipments: {
        where: { planX: { not: null }, planY: { not: null } },
        select: {
          id: true,
          name: true,
          refCode: true,
          planX: true,
          planY: true,
          icon: true,
          category: { select: { name: true, icon: true } },
        },
      },
    },
  });
}

// Équipements d'un centre (placés ou non) — pour le mode édition.
export async function getEquipmentsForLocationPlans(locationId: string) {
  await requireRole(TICKET_MANAGER_ROLES);
  return prisma.equipment.findMany({
    where: { locationId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      refCode: true,
      floorPlanId: true,
      planX: true,
      planY: true,
      icon: true,
      category: { select: { name: true, icon: true } },
    },
  });
}

// Kanban des tickets d'un équipement (colonnes = statuts de son équipe), filtré par
// la visibilité de l'utilisateur. Réutilisé par le panneau au clic sur un marqueur.
export async function getEquipmentKanban(equipmentId: string) {
  const user = await requireAuth();

  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      name: true,
      refCode: true,
      category: { select: { name: true } },
      team: {
        select: {
          id: true,
          name: true,
          statuses: { orderBy: { order: 'asc' } },
        },
      },
    },
  });
  if (!equipment) return null;

  const tickets = await prisma.ticket.findMany({
    where: {
      equipmentId,
      isArchived: false,
      ...ticketVisibilityWhere(user),
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    include: {
      status: true,
      equipment: true,
      location: true,
      requester: { select: { id: true, displayName: true } },
      _count: { select: { chatMessages: true, attachments: true } },
    },
  });

  return { equipment, statuses: equipment.team.statuses, tickets };
}
