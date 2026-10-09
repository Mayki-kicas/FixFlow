'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { hashPassword } from '@/lib/password';
import crypto from 'node:crypto';

export type CreateMaintainerInput = {
  name: string;
  email?: string;
  password?: string;
  contact?: string;
  phone?: string;
  specialties?: string;
  notes?: string;
};

export type UpdateMaintainerInput = {
  id: string;
  name?: string;
  email?: string;
  password?: string;
  contact?: string;
  phone?: string;
  specialties?: string;
  notes?: string;
};

export async function createMaintainer(input: CreateMaintainerInput) {
  await requireRole(['ADMIN', 'MANAGER']);

  const name = input.name.trim();
  if (!name) {
    throw new Error('Nom mainteneur obligatoire');
  }

  const email = input.email?.trim().toLowerCase() || null;
  const password = input.password?.trim() || null;
  if ((email && !password) || (!email && password)) {
    throw new Error('Email et mot de passe doivent etre fournis ensemble');
  }

  let userId: string | null = null;
  if (email && password) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new Error('Un utilisateur existe deja avec cet email');
    }
    const passwordHash = await hashPassword(password);
    const localUser = await prisma.user.create({
      data: {
        ldapId: `local:${crypto.randomUUID()}`,
        email,
        passwordHash,
        displayName: name,
        role: 'MAINTAINER',
      },
      select: { id: true },
    });
    userId = localUser.id;
  }

  const maintainer = await prisma.maintainer.create({
    data: {
      name,
      email,
      userId,
      contact: input.contact || null,
      phone: input.phone?.trim() || null,
      specialties: input.specialties?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });

  revalidatePath('/backoffice/maintainers');
  return maintainer;
}

export async function updateMaintainer(input: UpdateMaintainerInput) {
  await requireRole(['ADMIN', 'MANAGER']);

  const { id, password, ...data } = input;
  const name = data.name?.trim();
  const email = data.email?.trim().toLowerCase() || null;
  const passwordTrimmed = password?.trim() || null;

  const existingMaintainer = await prisma.maintainer.findUnique({
    where: { id },
    select: { userId: true, name: true },
  });
  if (!existingMaintainer) {
    throw new Error('Mainteneur introuvable');
  }

  let linkedUserId = existingMaintainer.userId;
  if (!linkedUserId && email) {
    if (!passwordTrimmed) {
      throw new Error('Mot de passe obligatoire pour creer le compte local');
    }
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new Error('Un utilisateur existe deja avec cet email');
    }
    const passwordHash = await hashPassword(passwordTrimmed);
    const localUser = await prisma.user.create({
      data: {
        ldapId: `local:${crypto.randomUUID()}`,
        email,
        passwordHash,
        displayName: name || existingMaintainer.name,
        role: 'MAINTAINER',
      },
      select: { id: true },
    });
    linkedUserId = localUser.id;
  }

  if (linkedUserId && (name || email || passwordTrimmed)) {
    const updateUserData: { displayName?: string; email?: string; passwordHash?: string } = {};
    if (name) updateUserData.displayName = name;
    if (email) updateUserData.email = email;
    if (passwordTrimmed) {
      updateUserData.passwordHash = await hashPassword(passwordTrimmed);
    }
    if (Object.keys(updateUserData).length > 0) {
      await prisma.user.update({
        where: { id: linkedUserId },
        data: updateUserData,
      });
    }
  }

  const maintainer = await prisma.maintainer.update({
    where: { id },
    data: {
      ...data,
      ...(name ? { name } : {}),
      ...(data.email !== undefined ? { email } : {}),
      ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
      ...(data.specialties !== undefined ? { specialties: data.specialties?.trim() || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      ...(linkedUserId ? { userId: linkedUserId } : {}),
    },
  });

  revalidatePath('/backoffice/maintainers');
  return maintainer;
}

export async function deleteMaintainer(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  // Vérifier qu'il n'y a pas de tickets liés
  const ticketCount = await prisma.ticket.count({
    where: { maintainerId: id },
  });

  if (ticketCount > 0) {
    throw new Error(
      `Impossible de supprimer ce mainteneur : ${ticketCount} ticket(s) lui sont assignés`
    );
  }

  const maintainer = await prisma.maintainer.findUnique({
    where: { id },
    select: { userId: true },
  });

  await prisma.maintainer.delete({
    where: { id },
  });

  if (maintainer?.userId) {
    await prisma.user.delete({
      where: { id: maintainer.userId },
    });
  }

  revalidatePath('/backoffice/maintainers');
}

export async function getMaintainers() {
  // Renvoie noms/emails/téléphones des mainteneurs → réservé ADMIN/MANAGER.
  await requireRole(['ADMIN', 'MANAGER']);

  const maintainers = await prisma.maintainer.findMany({
    include: {
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

  return maintainers;
}

export async function getMaintainerById(id: string) {
  await requireRole(['ADMIN', 'MANAGER']);

  const maintainer = await prisma.maintainer.findUnique({
    where: { id },
    include: {
      tickets: {
        take: 20,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          status: true,
          equipment: true,
          location: true,
        },
      },
    },
  });

  if (!maintainer) {
    throw new Error('Mainteneur introuvable');
  }

  return maintainer;
}
