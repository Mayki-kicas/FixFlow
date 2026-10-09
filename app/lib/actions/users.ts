'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { ldapService } from '@/lib/ldap';
import { UserRole } from '@prisma/client';

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
          role: role!,
        },
        create: {
          ldapId: ldapUser.dn,
          email: ldapUser.email,
          displayName: ldapUser.displayName,
          role: role!,
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
