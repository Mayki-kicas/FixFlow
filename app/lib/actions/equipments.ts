'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import {
  buildEquipmentPhotoKey,
  buildEquipmentDocumentKey,
  deleteObject,
  putObject,
} from '@/lib/storage';
import { logAudit } from '@/lib/audit';
import { Priority, Criticality, EquipmentLifecycleStatus, EquipmentDocumentType } from '@prisma/client';

const MAX_PHOTO_BYTES = Number(process.env.ATTACHMENT_MAX_BYTES || 8 * 1024 * 1024);
const MAX_DOC_BYTES = Number(process.env.EQUIPMENT_DOC_MAX_BYTES || 15 * 1024 * 1024);

// Surcharges SLA/priorité de l'équipement (écrasent la catégorie ; null = hérite).
type EquipmentSlaInput = {
  defaultPriority?: Priority | null;
  correctiveSlaHours?: number | null;
  p1DelayDays?: number | null;
  p2DelayDays?: number | null;
  p3DelayDays?: number | null;
};

// Référentiel GMAO : identité, garantie, criticité, cycle de vie, fournisseur.
type EquipmentRegistryInput = {
  serialNumber?: string | null;
  brand?: string | null;
  model?: string | null;
  commissionedAt?: Date | null;
  warrantyUntil?: Date | null;
  criticality?: Criticality;
  lifecycleStatus?: EquipmentLifecycleStatus;
  supplierId?: string | null;
  parentEquipmentId?: string | null;
};

// `photo` : data URL (nouvelle photo) | '' ou null (retrait) | undefined (inchangée).
export type CreateEquipmentInput = {
  name: string;
  refCode: string;
  photo?: string | null;
  categoryId: string;
  locationId: string;
  teamId: string;
} & EquipmentSlaInput &
  EquipmentRegistryInput;

export type UpdateEquipmentInput = {
  id: string;
  name?: string;
  refCode?: string;
  photo?: string | null;
  categoryId?: string;
  locationId?: string | null;
  teamId?: string;
} & EquipmentSlaInput &
  EquipmentRegistryInput;

// undefined = inchangé ; '' => null ; sinon trim.
function trimOrNull(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  const t = (value ?? '').trim();
  return t === '' ? null : t;
}

// Fragment référentiel à écrire. Dates et enums passent tels quels (undefined = inchangé).
function equipmentRegistryData(input: EquipmentRegistryInput) {
  return {
    serialNumber: trimOrNull(input.serialNumber),
    brand: trimOrNull(input.brand),
    model: trimOrNull(input.model),
    commissionedAt: input.commissionedAt,
    warrantyUntil: input.warrantyUntil,
    criticality: input.criticality,
    lifecycleStatus: input.lifecycleStatus,
    supplierId: trimOrNull(input.supplierId),
    parentEquipmentId: trimOrNull(input.parentEquipmentId),
  };
}

// Empêche un cycle de hiérarchie : le parent proposé ne doit pas être l'équipement
// lui-même ni l'un de ses descendants.
async function assertNoEquipmentCycle(equipmentId: string, parentId: string | null | undefined) {
  if (!parentId) return;
  if (parentId === equipmentId) throw new Error("Un équipement ne peut pas être son propre parent");
  let cursor: string | null = parentId;
  let guard = 0;
  while (cursor && guard < 1000) {
    if (cursor === equipmentId) throw new Error('Hiérarchie invalide (cycle détecté)');
    const parent: { parentEquipmentId: string | null } | null = await prisma.equipment.findUnique({
      where: { id: cursor },
      select: { parentEquipmentId: true },
    });
    cursor = parent?.parentEquipmentId ?? null;
    guard += 1;
  }
}

// Normalise un délai override : undefined = inchangé, null = hérite, sinon entier >= 0.
function sanitizeOverrideDelay(value: number | null | undefined, label: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} invalide (entier positif ou vide)`);
  }
  return value;
}

// Fragment de surcharges SLA à écrire (defaultPriority passe tel quel : undefined/null/Priority).
function equipmentSlaData(input: EquipmentSlaInput) {
  return {
    defaultPriority: input.defaultPriority,
    correctiveSlaHours: sanitizeOverrideDelay(input.correctiveSlaHours, 'SLA correctif (heures)'),
    p1DelayDays: sanitizeOverrideDelay(input.p1DelayDays, 'Délai P1'),
    p2DelayDays: sanitizeOverrideDelay(input.p2DelayDays, 'Délai P2'),
    p3DelayDays: sanitizeOverrideDelay(input.p3DelayDays, 'Délai P3'),
  };
}

function normalizeLocationId(locationId?: string | null): string | null {
  return locationId && locationId.trim() !== '' ? locationId : null;
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || 'application/octet-stream';
  const isBase64 = !!match[2];
  const raw = match[3];
  const buffer = isBase64 ? Buffer.from(raw, 'base64') : Buffer.from(decodeURIComponent(raw), 'utf8');
  return { mime, buffer };
}

// Applique la photo au stockage et renvoie le fragment { photoStorageKey, photoContentType }
// à écrire, ou undefined si la photo ne change pas.
async function resolveEquipmentPhoto(
  equipmentId: string,
  photo: string | null | undefined,
  previousKey: string | null,
): Promise<{ photoStorageKey: string | null; photoContentType: string | null } | undefined> {
  if (photo === undefined) return undefined; // inchangée

  // Retrait explicite
  if (photo === null || photo.trim() === '') {
    if (previousKey) await deleteObject(previousKey);
    return { photoStorageKey: null, photoContentType: null };
  }

  // Nouvelle photo (data URL)
  const parsed = parseDataUrl(photo);
  if (!parsed) throw new Error('Format de photo invalide');
  if (!parsed.mime.startsWith('image/') || parsed.mime === 'image/svg+xml') {
    throw new Error('La photo doit être une image (SVG exclu)');
  }
  if (parsed.buffer.length === 0) throw new Error('Photo vide');
  if (parsed.buffer.length > MAX_PHOTO_BYTES) {
    throw new Error(`Photo trop volumineuse (max ${Math.round(MAX_PHOTO_BYTES / (1024 * 1024))} Mo)`);
  }

  // Clé stable par équipement → une nouvelle photo écrase l'ancienne.
  const key = buildEquipmentPhotoKey(equipmentId);
  await putObject(key, parsed.buffer);
  return { photoStorageKey: key, photoContentType: parsed.mime };
}

export async function createEquipment(input: CreateEquipmentInput) {
  await requireRole(['ADMIN', 'MANAGER']);

  const { photo, ...rest } = input;

  // Crée d'abord (l'id est requis pour la clé de stockage de la photo).
  const equipment = await prisma.equipment.create({
    data: {
      ...rest,
      locationId: normalizeLocationId(rest.locationId),
      ...equipmentSlaData(input),
      ...equipmentRegistryData(input),
    },
    include: { category: true, location: true, team: true },
  });

  const photoUpdate = await resolveEquipmentPhoto(equipment.id, photo, null);
  const finalEquipment = photoUpdate
    ? await prisma.equipment.update({
        where: { id: equipment.id },
        data: photoUpdate,
        include: { category: true, location: true, team: true },
      })
    : equipment;

  revalidatePath('/backoffice/equipments');
  return finalEquipment;
}

export async function updateEquipment(input: UpdateEquipmentInput) {
  await requireRole(['ADMIN', 'MANAGER']);

  const { id, photo, ...data } = input;

  if ('locationId' in data) {
    data.locationId = normalizeLocationId(data.locationId);
  }

  // Résout la photo (nécessite l'ancienne clé pour un éventuel retrait).
  let photoUpdate: { photoStorageKey: string | null; photoContentType: string | null } | undefined;
  if (photo !== undefined) {
    const current = await prisma.equipment.findUnique({
      where: { id },
      select: { photoStorageKey: true },
    });
    photoUpdate = await resolveEquipmentPhoto(id, photo, current?.photoStorageKey ?? null);
  }

  if (input.parentEquipmentId !== undefined) {
    await assertNoEquipmentCycle(id, trimOrNull(input.parentEquipmentId) ?? null);
  }

  const equipment = await prisma.equipment.update({
    where: { id },
    data: { ...data, ...(photoUpdate ?? {}), ...equipmentSlaData(input), ...equipmentRegistryData(input) },
    include: { category: true, location: true, team: true },
  });

  revalidatePath('/backoffice/equipments');
  revalidatePath(`/backoffice/equipments/${id}`);
  return equipment;
}

export async function deleteEquipment(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  // Vérifier qu'il n'y a pas de tickets liés
  const ticketCount = await prisma.ticket.count({
    where: { equipmentId: id },
  });

  if (ticketCount > 0) {
    throw new Error(
      `Impossible de supprimer cet équipement : ${ticketCount} ticket(s) y sont rattachés`
    );
  }

  await prisma.equipment.delete({
    where: { id },
  });

  revalidatePath('/backoffice/equipments');
}

export async function getEquipments() {
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
  });

  return equipments;
}

export async function getEquipmentById(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: {
      category: true,
      location: true,
      team: true,
      tickets: {
        take: 20,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          status: true,
          requester: {
            select: {
              displayName: true,
            },
          },
        },
      },
    },
  });

  if (!equipment) {
    throw new Error('Équipement introuvable');
  }

  return equipment;
}

// Categories
export async function getCategories() {
  await requireRole(['ADMIN', 'MANAGER']);
  const categories = await prisma.equipmentCategory.findMany({
    include: {
      _count: {
        select: {
          equipments: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return categories;
}

export async function createCategory(data: { name: string; description?: string }) {
  await requireRole(['ADMIN', 'MANAGER']);

  const category = await prisma.equipmentCategory.create({
    data,
  });

  revalidatePath('/backoffice/equipments');
  return category;
}

// --- Documents d'équipement (manuels, schémas, certificats…) ---------------

const ALLOWED_DOC_TYPES = new Set<EquipmentDocumentType>(['MANUAL', 'SCHEMA', 'CERTIFICATE', 'OTHER']);

export async function uploadEquipmentDocument(formData: FormData) {
  const user = await requireRole(['ADMIN', 'MANAGER']);

  const equipmentId = String(formData.get('equipmentId') || '').trim();
  const typeRaw = String(formData.get('type') || 'OTHER').trim() as EquipmentDocumentType;
  const type = ALLOWED_DOC_TYPES.has(typeRaw) ? typeRaw : 'OTHER';
  const label = String(formData.get('label') || '').trim() || null;
  const expiryRaw = String(formData.get('expiryAt') || '').trim();
  const file = formData.get('file') as File | null;

  if (!equipmentId) throw new Error('Équipement requis');
  if (!file || file.size === 0) throw new Error('Fichier requis');
  if (file.size > MAX_DOC_BYTES) {
    throw new Error(`Fichier trop volumineux (max ${Math.round(MAX_DOC_BYTES / (1024 * 1024))} Mo)`);
  }
  let expiryAt: Date | null = null;
  if (expiryRaw) {
    const d = new Date(expiryRaw);
    if (Number.isNaN(d.getTime())) throw new Error("Date d'expiration invalide");
    expiryAt = d;
  }

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: { id: true } });
  if (!equipment) throw new Error('Équipement introuvable');

  const buffer = Buffer.from(await file.arrayBuffer());
  const doc = await prisma.equipmentDocument.create({
    data: {
      equipmentId,
      storageKey: 'pending',
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      type,
      label,
      expiryAt,
      uploadedById: user.id,
    },
  });

  try {
    const key = buildEquipmentDocumentKey(doc.id);
    await putObject(key, buffer);
    const saved = await prisma.equipmentDocument.update({ where: { id: doc.id }, data: { storageKey: key } });
    revalidatePath(`/backoffice/equipments/${equipmentId}`);
    await logAudit({ actorId: user.id, entity: 'EQUIPMENT_DOCUMENT', entityId: doc.id, action: 'EQUIPMENT_DOCUMENT_ADDED', changes: { equipmentId, type, fileName: file.name } });
    return saved;
  } catch (error) {
    await prisma.equipmentDocument.delete({ where: { id: doc.id } }).catch(() => {});
    throw error;
  }
}

export async function deleteEquipmentDocument(id: string) {
  const user = await requireRole(['ADMIN', 'MANAGER']);

  const doc = await prisma.equipmentDocument.findUnique({
    where: { id },
    select: { id: true, equipmentId: true, storageKey: true },
  });
  if (!doc) throw new Error('Document introuvable');

  await prisma.equipmentDocument.delete({ where: { id } });
  if (doc.storageKey && doc.storageKey !== 'pending') await deleteObject(doc.storageKey).catch(() => {});

  revalidatePath(`/backoffice/equipments/${doc.equipmentId}`);
  await logAudit({ actorId: user.id, entity: 'EQUIPMENT_DOCUMENT', entityId: id, action: 'EQUIPMENT_DOCUMENT_DELETED', changes: { equipmentId: doc.equipmentId } });
  return { ok: true };
}
