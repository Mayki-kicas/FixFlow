import { prisma } from '@/lib/prisma';
import type { AuthConfig } from '@prisma/client';

// Lecture du singleton de configuration d'authentification (réglages non-secrets).
// Les secrets (bind password LDAP, client secret Entra) vivent uniquement dans .env.
export async function getAuthConfig(): Promise<AuthConfig> {
  const existing = await prisma.authConfig.findUnique({ where: { id: 'singleton' } });
  if (existing) return existing;
  return prisma.authConfig.create({ data: { id: 'singleton' } });
}

// Réglages LDAP effectifs : la base DB prime, sinon fallback .env (compat).
export function effectiveLdapSettings(cfg: AuthConfig) {
  return {
    url: cfg.ldapUrl || process.env.LDAP_URL || 'ldap://localhost:389',
    searchBase: cfg.ldapSearchBase || process.env.LDAP_SEARCH_BASE || '',
    bindDn: cfg.ldapBindDn || process.env.LDAP_BIND_DN || '',
    // secret : toujours .env
    bindPassword: process.env.LDAP_BIND_PASSWORD || '',
  };
}
