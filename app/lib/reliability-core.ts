// KPI de fiabilité (GMAO), dérivés des ordres de travail. Fonctions pures, testables.
// Toutes les durées sont renvoyées en HEURES.

const MS_PER_HOUR = 3_600_000;

// MTTR — temps moyen de réparation : moyenne (clôture − ouverture) des OT correctifs clos.
export function meanTimeToRepairHours(
  tickets: { openedAt: Date; closedAt: Date | null }[],
): number | null {
  const closed = tickets.filter((t) => t.closedAt);
  if (closed.length === 0) return null;
  const sum = closed.reduce((s, t) => s + (t.closedAt!.getTime() - t.openedAt.getTime()), 0);
  return sum / closed.length / MS_PER_HOUR;
}

// MTBF — temps moyen entre pannes : moyenne des écarts entre ouvertures successives
// d'OT correctifs d'un même équipement (nécessite ≥ 2 pannes).
export function meanTimeBetweenFailuresHours(openedAtList: Date[]): number | null {
  if (openedAtList.length < 2) return null;
  const sorted = [...openedAtList].sort((a, b) => a.getTime() - b.getTime());
  let sum = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    sum += sorted[i].getTime() - sorted[i - 1].getTime();
  }
  return sum / (sorted.length - 1) / MS_PER_HOUR;
}

// Taux de respect du préventif : OT préventifs clos à temps (avant ou à l'échéance)
// sur le total des OT préventifs considérés.
export function preventiveCompliance(
  tickets: { closedAt: Date | null; dueDate: Date | null }[],
): { total: number; onTime: number; rate: number | null } {
  const total = tickets.length;
  if (total === 0) return { total: 0, onTime: 0, rate: null };
  const onTime = tickets.filter(
    (t) => t.closedAt && t.dueDate && t.closedAt.getTime() <= t.dueDate.getTime(),
  ).length;
  return { total, onTime, rate: onTime / total };
}

// Disponibilité estimée : 1 − (immobilisation / durée de la période). L'immobilisation
// est approximée par le temps d'ouverture des OT correctifs clos (indicateur).
export function availabilityEstimate(
  correctiveClosed: { openedAt: Date; closedAt: Date }[],
  periodMs: number,
): number | null {
  if (periodMs <= 0) return null;
  const downtime = correctiveClosed.reduce(
    (s, t) => s + Math.max(0, t.closedAt.getTime() - t.openedAt.getTime()),
    0,
  );
  return Math.max(0, Math.min(1, 1 - downtime / periodMs));
}

export function formatHours(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} j`;
}
