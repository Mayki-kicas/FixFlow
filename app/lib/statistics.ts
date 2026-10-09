type ResolutionTicket = {
  openedAt: Date;
  closedAt: Date | null;
  teamId?: string;
};

type TrendPoint = {
  dayKey: string;
  count: number;
};

export function calculateAverageResolutionHours(tickets: ResolutionTicket[]): number {
  // Ne compter que les tickets réellement résolus (numérateur ET dénominateur),
  // sinon la moyenne est sous-estimée dès qu'on passe un mélange ouverts/clos.
  const closed = tickets.filter((ticket) => ticket.closedAt);
  if (closed.length === 0) return 0;

  const totalHours = closed.reduce((sum, ticket) => {
    const hours = (new Date(ticket.closedAt!).getTime() - new Date(ticket.openedAt).getTime()) / (1000 * 60 * 60);
    return sum + hours;
  }, 0);

  return totalHours / closed.length;
}

export function calculateResolutionRate(totalTickets: number, resolvedTickets: number): number {
  if (totalTickets <= 0) return 0;
  return (resolvedTickets / totalTickets) * 100;
}

export function buildTrendSeries(since: Date, days: number, createdAtDates: Date[]): TrendPoint[] {
  const rows = Array.from({ length: days }, (_, i) => {
    const date = new Date(since);
    date.setDate(since.getDate() + i);
    return {
      dayKey: date.toISOString().slice(0, 10),
      count: 0,
    };
  });

  const map = new Map(rows.map((row) => [row.dayKey, row.count]));
  for (const createdAt of createdAtDates) {
    const key = new Date(createdAt).toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + 1);
  }

  return rows.map((row) => ({ ...row, count: map.get(row.dayKey) || 0 }));
}

export function detectIncidentPeaks(series: TrendPoint[], minFloor = 2, limit = 5): TrendPoint[] {
  if (series.length === 0) return [];

  const values = series.map((point) => point.count);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const threshold = Math.max(minFloor, Math.ceil(average + stdDev));

  return series
    .filter((point) => point.count >= threshold)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function calculateTeamPerformance(tickets: ResolutionTicket[]) {
  const map = new Map<string, { totalHours: number; count: number }>();

  for (const ticket of tickets) {
    if (!ticket.teamId || !ticket.closedAt) continue;
    const hours = (new Date(ticket.closedAt).getTime() - new Date(ticket.openedAt).getTime()) / (1000 * 60 * 60);
    const current = map.get(ticket.teamId) || { totalHours: 0, count: 0 };
    current.totalHours += hours;
    current.count += 1;
    map.set(ticket.teamId, current);
  }

  return map;
}
