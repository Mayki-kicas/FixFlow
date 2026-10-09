import type { Priority } from '@prisma/client';

// Métadonnée d'affichage des priorités. P1 = la plus haute.
export const PRIORITY_META: Record<Priority, { label: string; short: string; color: string }> = {
  P1: { label: 'Priorité 1', short: 'P1', color: '#e8513b' },
  P2: { label: 'Priorité 2', short: 'P2', color: '#c97e1a' },
  P3: { label: 'Priorité 3', short: 'P3', color: '#2f6f9e' },
};

export const PRIORITIES: Priority[] = ['P1', 'P2', 'P3'];

// P1 est la priorité la plus élevée. En base, un tri `priority: 'asc'` place P1 en tête.
export function isHighPriority(priority: Priority): boolean {
  return priority === 'P1';
}

type CategoryDelays = {
  p1DelayDays: number | null;
  p2DelayDays: number | null;
  p3DelayDays: number | null;
};

// Délai (en jours) pour obtenir un devis selon la priorité et les délais de la
// catégorie d'équipement. null = "à définir" (pas d'échéance).
export function quoteDelayDays(priority: Priority, category: CategoryDelays): number | null {
  switch (priority) {
    case 'P1':
      return category.p1DelayDays;
    case 'P2':
      return category.p2DelayDays;
    case 'P3':
      return category.p3DelayDays;
  }
}

// Échéance devis = base + délai catégorie. null si le délai est "à définir".
export function computeQuoteDeadline(
  base: Date,
  priority: Priority,
  category: CategoryDelays,
): Date | null {
  const days = quoteDelayDays(priority, category);
  if (days == null) return null;
  const deadline = new Date(base);
  deadline.setDate(deadline.getDate() + days);
  return deadline;
}

// Un devis est "en retard" quand son échéance est dépassée.
export function isQuoteOverdue(
  quoteDeadline: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return !!quoteDeadline && quoteDeadline.getTime() < now.getTime();
}
