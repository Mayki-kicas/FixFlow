import type { UserRole } from '@prisma/client';

// Source unique des capacités par rôle (règles métier d'accès).
// Câblé aux points d'enforcement réels (Server Actions + pages) pour éviter toute
// dérive entre la règle et son application. Testé exhaustivement (access-policy.test.ts).
//
// Rappels :
//  - MAINTAINER = technicien extérieur : ne déclare pas de ticket, ne rejoint pas de
//    groupe, n'accède qu'aux tickets où on l'a abonné explicitement (cf. visibility.ts).
//  - Cycle de vie ticket (statut / édition / archivage) et backoffice : ADMIN & MANAGER.

// Rôles autorisés à déclarer un incident (le MAINTAINER est exclu).
export const TICKET_DECLARER_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'BASIC'];

// Rôles gérant le cycle de vie d'un ticket + le backoffice.
export const TICKET_MANAGER_ROLES: UserRole[] = ['ADMIN', 'MANAGER'];

/** Peut déclarer un incident (= créer une Demande, validée ensuite par un manager). */
export function canDeclareTicket(role: UserRole): boolean {
  return TICKET_DECLARER_ROLES.includes(role);
}

/** Peut valider ou rejeter une Demande (et créer un ticket directement). */
export function canReviewDemande(role: UserRole): boolean {
  return TICKET_MANAGER_ROLES.includes(role);
}

/** Peut changer le statut, éditer ou archiver un ticket. */
export function canManageTicketLifecycle(role: UserRole): boolean {
  return TICKET_MANAGER_ROLES.includes(role);
}

/** Peut modifier la priorité d'un ticket (chaque changement est historisé). */
export function canChangeTicketPriority(role: UserRole): boolean {
  return TICKET_MANAGER_ROLES.includes(role);
}

/** Peut accepter/refuser un devis. */
export function canDecideQuote(role: UserRole): boolean {
  return TICKET_MANAGER_ROLES.includes(role);
}

/** Peut être membre d'un groupe (le MAINTAINER, en accès explicite seul, ne l'est jamais). */
export function canBelongToGroup(role: UserRole): boolean {
  return role !== 'MAINTAINER';
}
