'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

export type CreateLocationInput = {
  code: string;
  name: string;
  address?: string;
  city?: string;
  postalCode?: string;
  email?: string;
  description?: string;
};

export type UpdateLocationInput = {
  id: string;
  code?: string;
  name?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  email?: string;
  description?: string;
};

export async function createLocation(input: CreateLocationInput) {
  await requireRole(['ADMIN', 'MANAGER']);

  const location = await prisma.location.create({
    data: input,
  });

  revalidatePath('/backoffice/locations');
  return location;
}

export async function updateLocation(input: UpdateLocationInput) {
  await requireRole(['ADMIN', 'MANAGER']);

  const { id, ...data } = input;

  const location = await prisma.location.update({
    where: { id },
    data,
  });

  revalidatePath('/backoffice/locations');
  revalidatePath(`/backoffice/locations/${id}`);
  return location;
}

export async function deleteLocation(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  // Vérifier qu'il n'y a pas d'équipements liés
  const equipmentCount = await prisma.equipment.count({
    where: { locationId: id },
  });

  if (equipmentCount > 0) {
    throw new Error(
      `Impossible de supprimer cette localisation : ${equipmentCount} équipement(s) y sont rattachés`
    );
  }

  await prisma.location.delete({
    where: { id },
  });

  revalidatePath('/backoffice/locations');
}

export async function getLocations() {
  await requireRole(['ADMIN', 'MANAGER']);

  const locations = await prisma.location.findMany({
    include: {
      _count: {
        select: {
          equipments: true,
          tickets: true,
          managers: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return locations;
}

export async function getLocationById(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  const location = await prisma.location.findUnique({
    where: { id },
    include: {
      managers: {
        select: { id: true, displayName: true, email: true },
        orderBy: { displayName: 'asc' },
      },
      equipments: {
        include: {
          category: true,
          team: true,
        },
      },
      tickets: {
        take: 10,
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

  if (!location) {
    throw new Error('Localisation introuvable');
  }

  return location;
}

// Managers assignables comme responsables d'un site.
export async function getAssignableManagers() {
  await requireRole(['ADMIN']);

  return prisma.user.findMany({
    where: { role: 'MANAGER' },
    select: { id: true, displayName: true, email: true },
    orderBy: { displayName: 'asc' },
  });
}

// Définit les managers responsables d'un site (valideurs de ses demandes).
// ADMIN uniquement : délègue le pouvoir de validation.
export async function setLocationManagers(locationId: string, managerIds: string[]) {
  await requireRole(['ADMIN']);

  const uniqueIds = [...new Set(managerIds.filter(Boolean))];

  // Garde-fou : on ne rattache que des utilisateurs réellement MANAGER.
  const validManagers = uniqueIds.length
    ? await prisma.user.findMany({
        where: { id: { in: uniqueIds }, role: 'MANAGER' },
        select: { id: true },
      })
    : [];

  await prisma.location.update({
    where: { id: locationId },
    data: { managers: { set: validManagers.map((m) => ({ id: m.id })) } },
  });

  revalidatePath(`/backoffice/locations/${locationId}`);
  return { count: validManagers.length };
}
