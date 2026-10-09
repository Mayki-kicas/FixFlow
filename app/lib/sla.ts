// Helpers SLA du process maintenance. Fonctions pures (testables sans DB).
// Deux échelles coexistent :
// - correctif : résolution en HEURES selon le type d'intervention (catégorie d'équipement),
//   portée par ticket.dueDate.
// - prise en charge (triage) : ticket.firstResponseDueAt = création + AppConfig.firstResponseHours.
// (L'amélioratif garde son échéance devis en JOURS : voir lib/priority.ts.)

// Ajoute un nombre d'heures à une date (sans muter l'entrée).
function addHours(base: Date, hours: number): Date {
  const d = new Date(base);
  d.setHours(d.getHours() + hours);
  return d;
}

// Échéance de résolution d'un ticket correctif = base + SLA catégorie (heures).
// null si la catégorie n'a pas de SLA correctif défini.
export function computeCorrectiveDueDate(
  base: Date,
  correctiveSlaHours: number | null | undefined,
): Date | null {
  if (correctiveSlaHours == null) return null;
  return addHours(base, correctiveSlaHours);
}

// Échéance de prise en charge (triage) = base + délai global (heures).
export function computeFirstResponseDueAt(base: Date, firstResponseHours: number): Date {
  return addHours(base, firstResponseHours);
}

// En retard de prise en charge : pas encore qualifié (firstRespondedAt null) et échéance dépassée.
export function isFirstResponseOverdue(
  firstResponseDueAt: Date | null | undefined,
  firstRespondedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (firstRespondedAt) return false;
  if (!firstResponseDueAt) return false;
  return firstResponseDueAt.getTime() < now.getTime();
}

// En retard de résolution : échéance dépassée et ticket non clos.
export function isResolutionOverdue(
  dueDate: Date | null | undefined,
  closedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (closedAt) return false;
  if (!dueDate) return false;
  return dueDate.getTime() < now.getTime();
}
