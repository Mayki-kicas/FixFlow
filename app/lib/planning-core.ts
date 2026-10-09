// Helpers de planification (semaine) — purs, en UTC pour un bucketing stable
// (les dates planifiées sont stockées à midi UTC : cf. saisie date-only / échéances).

// Lundi 00:00 UTC de la semaine contenant `date`.
export function startOfWeekUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const mondayOffset = (d.getUTCDay() + 6) % 7; // dimanche=0 -> 6, lundi=1 -> 0
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  return d;
}

export function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function ymdUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

// Parse un "YYYY-MM-DD" en Date UTC (midi), ou null.
export function parseYmdUtc(value: string | undefined | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}
