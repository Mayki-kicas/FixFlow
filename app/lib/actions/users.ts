'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { ldapService } from '@/lib/ldap';
import { UserRole } from '@prisma/client';
import { removesLastActiveAdmin } from '@/lib/auth-core';
import { hashPassword } from '@/lib/password';

const ROLE_VALUES: UserRole[] = ['ADMIN', 'MANAGER', 'MAINTAINER', 'BASIC'];

export type LDAPImportCandidate = {
  dn: string;
  uid: string;
  displayName: string;
  email: string;
  suggestedRole: UserRole;
  isAlreadyInApp: boolean;
};

export async function getLdapImportCandidates(): Promise<LDAPImportCandidate[]> {
  await requireRole(['ADMIN']);

  const [ldapUsers, existingUsers] = await Promise.all([
    ldapService.listActiveUsers(),
    prisma.user.findMany({
      select: {
        ldapId: true,
      },
    }),
  ]);

  const existingByLdapId = new Set(existingUsers.map((user) => user.ldapId));

  // On ne propose à l'import que les utilisateurs qui ont un rôle (donc un accès).
  // Ceux sans groupe de rôle ne peuvent pas se connecter → inutile de les lister.
  return ldapUsers
    .map((user) => {
      const suggestedRole = ldapService.determineRole(user.memberOf || []);
      if (!suggestedRole) return null;
      return {
        dn: user.dn,
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        suggestedRole,
        isAlreadyInApp: existingByLdapId.has(user.dn),
      };
    })
    .filter((candidate): candidate is LDAPImportCandidate => candidate !== null);
}

export async function importLdapUsers(dns: string[]) {
  await requireRole(['ADMIN']);

  const selectedDns = Array.from(new Set(dns.map((dn) => dn.trim()).filter((dn) => dn.length > 0)));

  if (selectedDns.length === 0) {
    throw new Error('Aucun utilisateur sélectionné');
  }

  const ldapUsers = await ldapService.listActiveUsers();
  const usersToImport = ldapUsers
    .filter((user) => selectedDns.includes(user.dn))
    .map((ldapUser) => ({ ldapUser, role: ldapService.determineRole(ldapUser.memberOf || []) }))
    // On n'importe pas les utilisateurs sans rôle (pas d'accès).
    .filter((entry) => entry.role !== null);

  if (usersToImport.length === 0) {
    throw new Error('Aucun utilisateur LDAP actif avec un rôle correspondant à la sélection');
  }

  const importedUsers = await prisma.$transaction(
    usersToImport.map(({ ldapUser, role }) =>
      prisma.user.upsert({
        where: {
          ldapId: ldapUser.dn,
        },
        update: {
          email: ldapUser.email,
          displayName: ldapUser.displayName,
          authProvider: 'LDAP',
        },
        create: {
          ldapId: ldapUser.dn,
          email: ldapUser.email,
          displayName: ldapUser.displayName,
          authProvider: 'LDAP',
          role: role!,
          // Import = ajout délibéré par un admin → accès accordé d'emblée.
          isActive: true,
        },
      })
    )
  );

  revalidatePath('/backoffice/users');
  revalidatePath('/backoffice/groups');
  revalidatePath('/backoffice/categories');

  return {
    importedCount: importedUsers.length,
  };
}

// ---- Gestion des utilisateurs & rôles (depuis l'UI, remplace les groupes AD) ----

export type ManagedUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  authProvider: string;
  createdAt: Date;
};

export async function listManagedUsers(): Promise<ManagedUser[]> {
  await requireRole(['ADMIN']);
  return prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      isActive: true,
      authProvider: true,
      createdAt: true,
    },
  });
}

async function countActiveAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
}

export async function setUserRole(userId: string, role: UserRole) {
  const actor = await requireRole(['ADMIN']);
  if (!ROLE_VALUES.includes(role)) throw new Error('Rôle invalide');
  if (userId === actor.id) throw new Error('Vous ne pouvez pas modifier votre propre rôle.');

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!target) throw new Error('Utilisateur introuvable');

  if (removesLastActiveAdmin(target, role, target.isActive, await countActiveAdmins())) {
    throw new Error('Impossible : ce compte est le dernier administrateur actif.');
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath('/backoffice/users');
}

export async function setUserActive(userId: string, isActive: boolean) {
  const actor = await requireRole(['ADMIN']);
  if (userId === actor.id) throw new Error('Vous ne pouvez pas désactiver votre propre compte.');

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!target) throw new Error('Utilisateur introuvable');

  if (removesLastActiveAdmin(target, target.role, isActive, await countActiveAdmins())) {
    throw new Error('Impossible : ce compte est le dernier administrateur actif.');
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  revalidatePath('/backoffice/users');
}

export async function createLocalUser(input: {
  email: string;
  displayName: string;
  role: UserRole;
  password: string;
}) {
  await requireRole(['ADMIN']);
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!email || !displayName) throw new Error('Email et nom requis.');
  if (!ROLE_VALUES.includes(input.role)) throw new Error('Rôle invalide');
  if (input.password.length < 10) throw new Error('Mot de passe : 10 caractères minimum.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Un compte existe déjà avec cet email.');

  await prisma.user.create({
    data: {
      email,
      displayName,
      role: input.role,
      authProvider: 'LOCAL',
      isActive: true,
      passwordHash: await hashPassword(input.password),
    },
  });
  revalidatePath('/backoffice/users');
}

export async function resetLocalUserPassword(userId: string, password: string) {
  await requireRole(['ADMIN']);
  if (password.length < 10) throw new Error('Mot de passe : 10 caractères minimum.');

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!target) throw new Error('Utilisateur introuvable');
  if (!target.passwordHash) throw new Error('Ce compte n’est pas un compte local (pas de mot de passe).');

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });
  revalidatePath('/backoffice/users');
}
