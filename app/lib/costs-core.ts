// Calcul de coût d'un OT (pur, testable). Montants en centimes.
// Coût = main d'œuvre (temps passé valorisé au taux horaire) + lignes de coût.

export type CostLineAmount = { amountCents: number; quantity: number };

export function computeTicketCost(input: {
  workLogMinutes: number;
  laborRateCents: number | null | undefined;
  costLines: CostLineAmount[];
}): { laborCents: number; linesCents: number; totalCents: number } {
  const laborCents = input.laborRateCents
    ? Math.round((input.workLogMinutes / 60) * input.laborRateCents)
    : 0;
  const linesCents = input.costLines.reduce((sum, l) => sum + l.amountCents * l.quantity, 0);
  return { laborCents, linesCents, totalCents: laborCents + linesCents };
}

export function formatEuros(cents: number): string {
  try {
    return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  } catch {
    return `${(cents / 100).toFixed(2)} €`;
  }
}

// "1h30" / "90" (minutes) -> minutes. Accepte "1h", "1h30", "90", "1.5h".
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m}`;
  if (h) return `${h} h`;
  return `${m} min`;
}
