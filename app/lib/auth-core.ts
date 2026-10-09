import type { UserRole } from '@prisma/client';

// Logique d'accès/rôle PURE (sans dépendance serveur), testable isolément.
// Le rôle n'est PLUS dérivé des groupes AD : il est géré en base / depuis l'UI.

export function parseBootstrapAdminEmails(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function isBootstrapAdmin(email: string, bootstrapEmails: string[]): boolean {
  return bootstrapEmails.includes(email.trim().toLowerCase());
}

export type UserAccess = { role: UserRole; isActive: boolean };

// Accès d'un NOUVEau compte SSO : un email d'amorçage devient ADMIN actif ;
// sinon le compte est créé « en attente » (BASIC inactif, à valider par un admin).
export function resolveNewSsoUserAccess(email: string, bootstrapEmails: string[]): UserAccess {
  if (isBootstrapAdmin(email, bootstrapEmails)) {
    return { role: 'ADMIN', isActive: true };
  }
  return { role: 'BASIC', isActive: false };
}

// Promotion d'amorçage pour un compte EXISTANT qui se reconnecte : si son email
// est dans la liste et qu'il n'est pas déjà ADMIN actif, on le promeut. Sinon null
// (on ne touche jamais au rôle d'un compte déjà géré par un admin).
export function bootstrapPromotion(
  user: { email: string; role: UserRole; isActive: boolean },
  bootstrapEmails: string[],
): UserAccess | null {
  if (!isBootstrapAdmin(user.email, bootstrapEmails)) return null;
  if (user.role === 'ADMIN' && user.isActive) return null;
  return { role: 'ADMIN', isActive: true };
}

// Connexion autorisée uniquement si le compte est actif (accès accordé par un admin).
export function isLoginPermitted(user: { isActive: boolean }): boolean {
  return user.isActive === true;
}

// Message surfacé sur la page de connexion quand le compte existe mais n'a pas
// encore reçu d'accès (détecté côté UI pour afficher l'explication / lien).
export const ACCESS_PENDING_MESSAGE =
  'Compte en attente de validation par un administrateur.';
