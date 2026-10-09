'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

function norm(value: string | undefined | null): string | null {
  const v = (value ?? '').trim();
  return v.length > 0 ? v : null;
}

// Met à jour la configuration d'authentification (réglages non-secrets).
// Les secrets (LDAP_BIND_PASSWORD, ENTRA_CLIENT_SECRET) restent dans .env.
export async function updateAuthConfig(input: {
  activeProvider: 'LDAP' | 'ENTRA';
  ldapUrl?: string;
  ldapSearchBase?: string;
  ldapBindDn?: string;
  entraTenantId?: string;
  entraClientId?: string;
}) {
  await requireRole(['ADMIN']);

  const activeProvider = input.activeProvider === 'ENTRA' ? 'ENTRA' : 'LDAP';
  const data = {
    activeProvider,
    ldapUrl: norm(input.ldapUrl),
    ldapSearchBase: norm(input.ldapSearchBase),
    ldapBindDn: norm(input.ldapBindDn),
    entraTenantId: norm(input.entraTenantId),
    entraClientId: norm(input.entraClientId),
  } as const;

  await prisma.authConfig.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data },
  });

  revalidatePath('/backoffice/auth');
}
