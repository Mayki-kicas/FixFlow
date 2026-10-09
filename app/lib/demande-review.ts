import { prisma } from '@/lib/prisma';
import type { Prisma, UserRole } from '@prisma/client';

// Rôles pouvant potentiellement valider une demande (gate grossier).
export function isDemandeReviewer(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'MANAGER';
}

// Sites dont un manager est responsable (valide les demandes de ces sites).
export async function getManagedLocationIds(userId: string): Promise<string[]> {
  const rows = await prisma.location.findMany({
    where: { managers: { some: { id: userId } } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// Fragment `where` des demandes qu'un utilisateur peut traiter.
// ADMIN : tout. MANAGER : les demandes de ses sites OU sans site (aucun responsable défini).
export function demandeReviewWhere(
  role: UserRole,
  managedLocationIds: string[],
): Prisma.DemandeWhereInput {
  if (role === 'ADMIN') return {};
  if (role !== 'MANAGER') return { id: '__none__' }; // ne matchera rien
  return { OR: [{ locationId: null }, { locationId: { in: managedLocationIds } }] };
}

// Ce manager peut-il traiter CETTE demande (selon le site) ?
export function canReviewDemandeLocation(
  role: UserRole,
  managedLocationIds: string[],
  demandeLocationId: string | null,
): boolean {
  if (role === 'ADMIN') return true;
  if (role !== 'MANAGER') return false;
  if (demandeLocationId == null) return true; // sans site => tout manager peut trancher
  return managedLocationIds.includes(demandeLocationId);
}
