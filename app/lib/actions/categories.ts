'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { Priority } from '@prisma/client';

// Champs SLA/priorité paramétrables par catégorie (éditables au backoffice) :
// - defaultPriority : priorité par défaut des tickets de la catégorie.
// - p1/p2/p3DelayDays : délai devis (JOURS) par priorité pour l'amélioratif. null = à définir.
// - correctiveSlaHours : SLA de résolution (HEURES) pour le correctif. null = pas de SLA.
type CategorySlaFields = {
  defaultPriority?: Priority;
  p1DelayDays?: number | null;
  p2DelayDays?: number | null;
  p3DelayDays?: number | null;
  correctiveSlaHours?: number | null;
  // Icône de marqueur sur les plans (clé : gate/camera/door/elevator/generic).
  icon?: string | null;
};

export type CreateCategoryInput = {
  name: string;
  description?: string;
} & CategorySlaFields;

export type UpdateCategoryInput = {
  id: string;
  name?: string;
  description?: string;
} & CategorySlaFields;

// Normalise un délai : null autorisé (= à définir / pas de SLA), sinon entier >= 0.
function sanitizeDelay(value: number | null | undefined, label: string): number | null | undefined {
  if (value === undefined) return undefined; // champ non fourni : inchangé
  if (value === null) return null;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} invalide (entier positif ou vide)`);
  }
  return value;
}

const ALLOWED_ICONS = new Set(['gate', 'camera', 'door', 'elevator', 'generic']);

function sanitizeSlaFields(input: CategorySlaFields) {
  return {
    defaultPriority: input.defaultPriority,
    p1DelayDays: sanitizeDelay(input.p1DelayDays, 'Délai P1'),
    p2DelayDays: sanitizeDelay(input.p2DelayDays, 'Délai P2'),
    p3DelayDays: sanitizeDelay(input.p3DelayDays, 'Délai P3'),
    correctiveSlaHours: sanitizeDelay(input.correctiveSlaHours, 'SLA correctif (heures)'),
    icon: input.icon === undefined ? undefined : input.icon && ALLOWED_ICONS.has(input.icon) ? input.icon : null,
  };
}

export async function createCategory(input: CreateCategoryInput) {
  await requireRole(['ADMIN', 'MANAGER']);

  const category = await prisma.equipmentCategory.create({
    data: {
      name: input.name,
      description: input.description || null,
      ...sanitizeSlaFields(input),
    },
  });

  revalidatePath('/backoffice/categories');
  revalidatePath('/backoffice/equipments');
  return category;
}

export async function updateCategory(input: UpdateCategoryInput) {
  await requireRole(['ADMIN', 'MANAGER']);

  const { id, name, description } = input;

  const category = await prisma.equipmentCategory.update({
    where: { id },
    data: {
      name,
      description,
      ...sanitizeSlaFields(input),
    },
  });

  revalidatePath('/backoffice/categories');
  revalidatePath('/backoffice/equipments');
  return category;
}

export async function deleteCategory(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  // Vérifier qu'il n'y a pas d'équipements liés
  const equipmentCount = await prisma.equipment.count({
    where: { categoryId: id },
  });

  if (equipmentCount > 0) {
    throw new Error(
      `Impossible de supprimer cette catégorie : ${equipmentCount} équipement(s) y sont rattachés`
    );
  }

  await prisma.equipmentCategory.delete({
    where: { id },
  });

  revalidatePath('/backoffice/categories');
  revalidatePath('/backoffice/equipments');
}

export async function getCategories() {
  await requireRole(['ADMIN', 'MANAGER']);
  const categories = await prisma.equipmentCategory.findMany({
    include: {
      _count: {
        select: {
          equipments: true,
        },
      },
      groupSubscriptions: {
        include: {
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      userSubscriptions: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              role: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return categories;
}

export async function getCategoryById(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  const category = await prisma.equipmentCategory.findUnique({
    where: { id },
    include: {
      equipments: {
        include: {
          location: true,
          team: true,
        },
      },
    },
  });

  if (!category) {
    throw new Error('Catégorie introuvable');
  }

  return category;
}

export async function subscribeGroupToCategory(categoryId: string, groupId: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  try {
    await prisma.groupCategorySubscription.create({
      data: { categoryId, groupId },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new Error('Ce groupe est deja abonne a cette categorie');
    }
    throw error;
  }

  revalidatePath('/backoffice/categories');
}

export async function unsubscribeGroupFromCategory(categoryId: string, groupId: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  await prisma.groupCategorySubscription.deleteMany({
    where: { categoryId, groupId },
  });

  revalidatePath('/backoffice/categories');
}

export async function subscribeUserToCategory(categoryId: string, userId: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  try {
    await prisma.userCategorySubscription.create({
      data: { categoryId, userId },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new Error('Cet utilisateur est deja abonne a cette categorie');
    }
    throw error;
  }

  revalidatePath('/backoffice/categories');
}

export async function unsubscribeUserFromCategory(categoryId: string, userId: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  await prisma.userCategorySubscription.deleteMany({
    where: { categoryId, userId },
  });

  revalidatePath('/backoffice/categories');
}
