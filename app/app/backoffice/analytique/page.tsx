import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import LocationStatsFilter from '@/components/LocationStatsFilter';
import {
  buildTrendSeries,
  calculateAverageResolutionHours,
  calculateResolutionRate,
  calculateTeamPerformance,
  detectIncidentPeaks,
} from '@/lib/statistics';

type PeriodKey = '7' | '30' | '90' | '365';

const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: '7', label: '7j', days: 7 },
  { key: '30', label: '30j', days: 30 },
  { key: '90', label: '90j', days: 90 },
  { key: '365', label: '1 an', days: 365 },
];

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; locations?: string; start?: string; end?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const params = await searchParams;
  const periodKey = (params.period && PERIODS.some((p) => p.key === params.period) ? params.period : '30') as PeriodKey;
  const period = PERIODS.find((p) => p.key === periodKey)!;
  const selectedLocationIds = params.locations ? params.locations.split(',').filter(Boolean) : [];
  const startParam = params.start || '';
  const endParam = params.end || '';
  const since = new Date();
  since.setDate(since.getDate() - period.days);
  const startDate = startParam ? new Date(startParam) : null;
  const endDate = endParam ? new Date(endParam) : null;
  const hasCustomRange = !!(startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()));
  const rangeStart = hasCustomRange ? new Date(startDate!) : since;
  const rangeEnd = hasCustomRange ? new Date(endDate!) : null;
  if (rangeEnd) {
    rangeEnd.setHours(23, 59, 59, 999);
  }

  const locationFilter = selectedLocationIds.length > 0 ? { locationId: { in: selectedLocationIds } } : {};
  const dateFilter = rangeEnd ? { createdAt: { gte: rangeStart, lte: rangeEnd } } : { createdAt: { gte: rangeStart } };

  const [criticalCount, totalTickets, resolvedTickets, priorityCounts, statusCountsRaw, locationCountsRaw, teamCountsRaw, resolutionTickets] = await Promise.all([
    prisma.ticket.count({
      where: { priority: 'P1', isArchived: false, ...dateFilter, ...locationFilter },
    }),
    prisma.ticket.count({
      where: { ...dateFilter, ...locationFilter },
    }),
    prisma.ticket.count({
      where: {
        ...dateFilter,
        closedAt: { not: null },
        ...locationFilter,
      },
    }),
    prisma.ticket.groupBy({
      by: ['priority'],
      where: { ...dateFilter, ...locationFilter },
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ['statusId'],
      where: { ...dateFilter, ...locationFilter },
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ['locationId'],
      where: { ...dateFilter, ...locationFilter },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 8,
    }),
    prisma.ticket.groupBy({
      by: ['teamId'],
      where: { ...dateFilter, ...locationFilter },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 8,
    }),
    prisma.ticket.findMany({
      where: {
        ...dateFilter,
        closedAt: { not: null },
        ...locationFilter,
      },
      select: {
        teamId: true,
        openedAt: true,
        closedAt: true,
      },
    }),
  ]);

  const [statuses, locations, teams, equipmentCountsRaw, maintainerOpenLoadRaw, maintainers] = await Promise.all([
    prisma.ticketStatus.findMany({
      select: { id: true, name: true },
    }),
    prisma.location.findMany({
      select: { id: true, code: true, name: true },
    }),
    prisma.team.findMany({
      select: { id: true, name: true },
    }),
    prisma.ticket.groupBy({
      by: ['equipmentId'],
      where: { ...dateFilter, ...locationFilter },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 12,
    }),
    prisma.ticket.groupBy({
      by: ['maintainerId'],
      where: {
        ...dateFilter,
        maintainerId: { not: null },
        closedAt: null,
        ...locationFilter,
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 12,
    }),
    prisma.maintainer.findMany({
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  const statusMap = new Map(statuses.map((s) => [s.id, s.name]));
  const locationMap = new Map(locations.map((l) => [l.id, `${l.code} - ${l.name}`]));
  const teamMap = new Map(teams.map((t) => [t.id, t.name]));
  const maintainerMap = new Map(maintainers.map((m) => [m.id, m.name]));

  const equipmentIds = equipmentCountsRaw.map((e) => e.equipmentId);
  const equipments = equipmentIds.length
    ? await prisma.equipment.findMany({
        where: { id: { in: equipmentIds } },
        select: {
          id: true,
          name: true,
          refCode: true,
          location: {
            select: { name: true, code: true },
          },
        },
      })
    : [];
  const equipmentMap = new Map(
    equipments.map((e) => [
      e.id,
      {
        label: `${e.refCode} - ${e.name}`,
        site: e.location ? `${e.location.code} - ${e.location.name}` : 'Global',
      },
    ])
  );

  const avgResolutionHours = calculateAverageResolutionHours(resolutionTickets);
  const resolutionRate = calculateResolutionRate(totalTickets, resolvedTickets);

  // --- KPIs devis / SLA / priorité (chantier 5) ---
  const nowKpi = new Date();
  const [quoteStatusCounts, receivedQuotes, priorityChangeCount, overdueQuotes] = await Promise.all([
    prisma.quote.groupBy({
      by: ['status'],
      where: { ticket: { ...dateFilter, ...locationFilter } },
      _count: { _all: true },
    }),
    prisma.quote.findMany({
      where: { receivedAt: { not: null }, ticket: { ...dateFilter, ...locationFilter } },
      select: { requestedAt: true, receivedAt: true, ticket: { select: { quoteDeadline: true } } },
    }),
    // Vrais changements de priorité (hors entrée initiale de création, fromPriority = null).
    prisma.priorityChange.count({
      where: { fromPriority: { not: null }, ticket: { ...dateFilter, ...locationFilter } },
    }),
    // Devis toujours attendus au-delà de l'échéance SLA (dépassement).
    prisma.quote.count({
      where: {
        status: 'REQUESTED',
        ticket: { isArchived: false, status: { isFinal: false }, quoteDeadline: { not: null, lt: nowKpi }, ...locationFilter },
      },
    }),
  ]);

  const quotesByStatus: Record<string, number> = { REQUESTED: 0, RECEIVED: 0, ACCEPTED: 0, REJECTED: 0 };
  for (const row of quoteStatusCounts) quotesByStatus[row.status] = row._count._all;
  const totalQuotes = quoteStatusCounts.reduce((sum, r) => sum + r._count._all, 0);

  // NB: le "% dans les délais" compare receivedAt à l'échéance ACTUELLE du ticket.
  // Si la priorité a changé après réception, l'échéance a été recalculée : approximation
  // assumée (un snapshot de l'échéance au moment de la demande serait plus exact).
  let quoteDelaySumHours = 0;
  let quotesOnTime = 0;
  let quotesWithDeadline = 0;
  for (const q of receivedQuotes) {
    if (!q.receivedAt) continue;
    quoteDelaySumHours += (q.receivedAt.getTime() - q.requestedAt.getTime()) / 3_600_000;
    if (q.ticket.quoteDeadline) {
      quotesWithDeadline += 1;
      if (q.receivedAt.getTime() <= q.ticket.quoteDeadline.getTime()) quotesOnTime += 1;
    }
  }
  const avgQuoteReceptionHours = receivedQuotes.length > 0 ? quoteDelaySumHours / receivedQuotes.length : null;
  const quoteOnTimeRate = quotesWithDeadline > 0 ? (quotesOnTime / quotesWithDeadline) * 100 : null;
  const formatDelay = (hours: number | null) =>
    hours == null ? '—' : hours >= 48 ? `${(hours / 24).toFixed(1)} j` : `${hours.toFixed(1)} h`;
  const quoteSeries = (['REQUESTED', 'RECEIVED', 'ACCEPTED', 'REJECTED'] as const).map((s) => ({
    label: { REQUESTED: 'Demandés', RECEIVED: 'Reçus', ACCEPTED: 'Acceptés', REJECTED: 'Refusés' }[s],
    count: quotesByStatus[s],
  }));
  const maxQuoteBar = Math.max(1, ...quoteSeries.map((x) => x.count));

  const prioritySeries = priorityCounts
    .map((p) => ({
      label: p.priority,
      count: p._count._all,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const statusSeries = statusCountsRaw
    .map((s) => ({
      label: statusMap.get(s.statusId) || 'Inconnu',
      count: s._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  const locationSeries = locationCountsRaw.map((l) => ({
    label: l.locationId ? locationMap.get(l.locationId) || 'Inconnu' : 'Global',
    count: l._count._all,
  }));

  const teamSeries = teamCountsRaw.map((t) => ({
    label: teamMap.get(t.teamId) || 'Inconnu',
    count: t._count._all,
  }));

  const equipmentSeries = equipmentCountsRaw.map((e) => ({
    label: equipmentMap.get(e.equipmentId)?.label || e.equipmentId,
    site: equipmentMap.get(e.equipmentId)?.site || 'Inconnu',
    count: e._count.id,
  }));

  const locationRanking = [...locationSeries].sort((a, b) => b.count - a.count);

  const maxBar = Math.max(
    1,
    ...prioritySeries.map((x) => x.count),
    ...statusSeries.map((x) => x.count),
    ...locationSeries.map((x) => x.count),
    ...teamSeries.map((x) => x.count),
    ...equipmentSeries.map((x) => x.count)
  );

  const createdTickets = await prisma.ticket.findMany({
    where: { ...dateFilter, ...locationFilter },
    select: {
      createdAt: true,
      equipmentId: true,
      locationId: true,
    },
  });

  const closedTickets = await prisma.ticket.findMany({
    where: {
      closedAt: {
        not: null,
        gte: rangeStart,
        ...(rangeEnd ? { lte: rangeEnd } : {}),
      },
      ...locationFilter,
    },
    select: { closedAt: true },
  });

  const backlogStartCount = await prisma.ticket.count({
    where: {
      createdAt: { lt: rangeStart },
      OR: [{ closedAt: null }, { closedAt: { gte: rangeStart } }],
      ...locationFilter,
    },
  });

  const rangeDays = rangeEnd ? Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24))) : period.days;
  const trendSeries = buildTrendSeries(
    rangeStart,
    rangeDays,
    createdTickets.map((ticket) => ticket.createdAt)
  );
  const closedSeries = buildTrendSeries(
    rangeStart,
    rangeDays,
    closedTickets.map((ticket) => ticket.closedAt as Date)
  );
  const incidentPeaks = detectIncidentPeaks(trendSeries);
  const dayKeys = trendSeries.map((row) => row.dayKey);
  const dayIndexMap = new Map(dayKeys.map((key, index) => [key, index]));

  const backlogSeries = [];
  let backlogRunning = backlogStartCount;
  for (let i = 0; i < trendSeries.length; i += 1) {
    backlogRunning += trendSeries[i].count;
    backlogRunning -= closedSeries[i].count;
    backlogSeries.push({ dayKey: trendSeries[i].dayKey, count: Math.max(0, backlogRunning) });
  }

  const bucketize = (values: number[], maxPoints = 30) => {
    if (values.length <= maxPoints) return { buckets: values, size: 1 };
    const size = Math.ceil(values.length / maxPoints);
    const buckets = [];
    for (let i = 0; i < values.length; i += size) {
      buckets.push(values.slice(i, i + size).reduce((sum, value) => sum + value, 0));
    }
    return { buckets, size };
  };

  const bucketMeta = (size: number, index: number) => {
    const start = new Date(rangeStart);
    start.setDate(rangeStart.getDate() + index * size);
    const end = new Date(start);
    end.setDate(start.getDate() + size - 1);
    return `${start.toLocaleDateString('fr-FR')} – ${end.toLocaleDateString('fr-FR')}`;
  };

  const topEquipmentIds = equipmentCountsRaw.map((row) => row.equipmentId);
  const topLocationIds = locationCountsRaw.map((row) => row.locationId || 'global');

  const equipmentSparkData = topEquipmentIds.map((equipmentId) => {
    const values = new Array(rangeDays).fill(0);
    for (const ticket of createdTickets) {
      if (ticket.equipmentId !== equipmentId) continue;
      const key = new Date(ticket.createdAt).toISOString().slice(0, 10);
      const index = dayIndexMap.get(key);
      if (index !== undefined) values[index] += 1;
    }
    const { buckets, size } = bucketize(values);
    return {
      id: equipmentId,
      label: equipmentMap.get(equipmentId)?.label || equipmentId,
      site: equipmentMap.get(equipmentId)?.site || 'Inconnu',
      total: values.reduce((sum, value) => sum + value, 0),
      buckets,
      bucketSize: size,
    };
  });

  const locationSparkData = topLocationIds.map((locationId) => {
    const values = new Array(rangeDays).fill(0);
    for (const ticket of createdTickets) {
      const key = ticket.locationId || 'global';
      if (key !== locationId) continue;
      const dayKey = new Date(ticket.createdAt).toISOString().slice(0, 10);
      const index = dayIndexMap.get(dayKey);
      if (index !== undefined) values[index] += 1;
    }
    const { buckets, size } = bucketize(values);
    return {
      id: locationId,
      label: locationId === 'global' ? 'Global' : locationMap.get(locationId) || 'Inconnu',
      total: values.reduce((sum, value) => sum + value, 0),
      buckets,
      bucketSize: size,
    };
  });

  const { buckets: backlogBuckets, size: backlogBucketSize } = bucketize(backlogSeries.map((row) => row.count), 36);
  const backlogMax = Math.max(1, ...backlogBuckets);
  const backlogMin = Math.min(...backlogBuckets);
  const backlogLatest = backlogBuckets[backlogBuckets.length - 1] || 0;

  const teamPerformanceMap = calculateTeamPerformance(resolutionTickets);
  const teamPerformanceSeries = Array.from(teamPerformanceMap.entries())
    .map(([teamId, values]) => ({
      label: teamMap.get(teamId) || 'Inconnu',
      avgHours: values.count > 0 ? values.totalHours / values.count : 0,
      resolvedCount: values.count,
    }))
    .sort((a, b) => a.avgHours - b.avgHours)
    .slice(0, 10);

  const maintainerLoadSeries = maintainerOpenLoadRaw
    .filter((m) => m.maintainerId)
    .map((m) => ({
      label: maintainerMap.get(m.maintainerId as string) || 'Inconnu',
      count: m._count.id,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const periodHref = (key: PeriodKey) => {
    const locationQuery = selectedLocationIds.length > 0 ? `&locations=${selectedLocationIds.join(',')}` : '';
    return `?period=${key}${locationQuery}`;
  };

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <Link href="/backoffice" className="text-xs text-muted hover:text-foreground transition-colors duration-150 ease-out">
                  ← Retour au backoffice
                </Link>
                <span className="text-border-default">|</span>
                <h1 className="page-toolbar-title">Analytique</h1>
                <span className="page-toolbar-subtitle">KPIs et tendances sur la période sélectionnée</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="card p-3 mb-4">
            <div className="section-band">
              <h2 className="section-band-title">Filtres</h2>
              <span className="text-[11px] text-muted">
                {hasCustomRange ? 'Plage custom active' : 'Période standard'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-8 border border-border-default rounded-xl p-2.5 bg-surface-alt">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wide text-muted">Période et plage</p>
                  <span className="text-[10px] text-muted">
                    {hasCustomRange ? 'plage active' : `période ${period.label}`}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-[auto,1fr] lg:items-end">
                  <div className={`inline-flex bg-surface-alt border border-border-default rounded-lg p-0.5 ${hasCustomRange ? 'opacity-40 pointer-events-none' : ''}`}>
                    {PERIODS.map((p) => (
                      <Link
                        key={p.key}
                        href={periodHref(p.key)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors duration-150 ease-out ${
                          p.key === period.key
                            ? 'bg-surface text-foreground shadow-soft-md'
                            : 'text-muted hover:text-foreground'
                        }`}
                      >
                        {p.label}
                      </Link>
                    ))}
                  </div>
                  <form className="flex flex-wrap items-end gap-2 justify-end" method="get">
                    <input type="hidden" name="period" value={period.key} />
                    {selectedLocationIds.length > 0 && (
                      <input type="hidden" name="locations" value={selectedLocationIds.join(',')} />
                    )}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">Début</label>
                      <input
                        type="date"
                        name="start"
                        defaultValue={startParam}
                        className="w-full px-2.5 py-1.5 text-xs border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-[color:var(--accent)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">Fin</label>
                      <input
                        type="date"
                        name="end"
                        defaultValue={endParam}
                        className="w-full px-2.5 py-1.5 text-xs border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-[color:var(--accent)]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-2.5 py-1.5 text-xs font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] transition-colors duration-150 ease-out"
                    >
                      Appliquer la plage
                    </button>
                    {hasCustomRange && (
                      <Link
                        href={periodHref(period.key)}
                        className="px-2.5 py-1.5 text-xs text-muted border border-border-default rounded-lg hover:bg-surface-alt hover:text-foreground transition-colors duration-150 ease-out"
                      >
                        Revenir à la période
                      </Link>
                    )}
                  </form>
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  {hasCustomRange ? 'Période désactivée tant que la plage est active.' : 'La plage custom écrase la période.'}
                </p>
              </div>
              <div className="lg:col-span-4 border border-border-default rounded-xl p-2.5 bg-surface-alt">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wide text-muted">Localisations</p>
                  <span className="text-[10px] text-muted tabular-nums">{selectedLocationIds.length} sélection</span>
                </div>
                <div className="mt-2">
                  <LocationStatsFilter
                    locations={locations}
                    selectedIds={selectedLocationIds}
                    periodKey={period.key}
                    startDate={startParam}
                    endDate={endParam}
                    inline
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="stat-tile">
              <p className="stat-label">Tickets créés</p>
              <p className="stat-value mt-0.5">{totalTickets.toLocaleString('fr-FR')}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Tickets résolus</p>
              <p className="stat-value mt-0.5">{resolvedTickets.toLocaleString('fr-FR')}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Taux de résolution</p>
              <p className="stat-value mt-0.5">{resolutionRate.toFixed(1)}%</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Temps moyen de résolution</p>
              <p className="stat-value mt-0.5">{avgResolutionHours.toFixed(1)} h</p>
            </div>
          </div>

          {/* KPIs devis / SLA / priorité */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="stat-tile">
              <p className="stat-label">Délai moyen réception devis</p>
              <p className="stat-value mt-0.5">{formatDelay(avgQuoteReceptionHours)}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Devis reçus dans les délais</p>
              <p className="stat-value mt-0.5">
                {quoteOnTimeRate == null ? '—' : `${quoteOnTimeRate.toFixed(0)}%`}
              </p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Devis en retard (SLA dépassé)</p>
              <p className={`mt-0.5 text-lg font-semibold tabular-nums ${overdueQuotes > 0 ? 'text-[color:var(--accent)]' : 'text-foreground'}`}>
                {overdueQuotes.toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">Changements de priorité</p>
              <p className="stat-value mt-0.5">{priorityChangeCount.toLocaleString('fr-FR')}</p>
            </div>
          </div>

          {totalQuotes > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
              <div className="card p-3">
                <div className="section-band">
                  <h2 className="section-band-title">Devis — répartition par statut ({totalQuotes})</h2>
                </div>
                <div className="space-y-2">
                  {quoteSeries.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className="w-20 text-xs text-muted">{item.label}</div>
                      <div className="flex-1 h-2 bg-surface-alt border border-border-default rounded overflow-hidden">
                        <div className="h-full bg-[color:var(--accent-2)]" style={{ width: `${(item.count / maxQuoteBar) * 100}%` }} />
                      </div>
                      <div className="w-10 text-right text-xs text-muted tabular-nums">{item.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <div className="card p-3">
              <div className="section-band">
                <h2 className="section-band-title">Répartition par priorité</h2>
              </div>
              <div className="space-y-2">
                {prioritySeries.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="flex items-center gap-2">
                    <div className="w-20 text-xs text-muted">{item.label}</div>
                    <div className="flex-1 h-2 bg-surface-alt border border-border-default rounded overflow-hidden">
                      <div className="h-full bg-[color:var(--accent-2)]" style={{ width: `${(item.count / maxBar) * 100}%` }} />
                    </div>
                    <div className="w-10 text-right text-xs text-muted tabular-nums">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-3">
              <div className="section-band">
                <h2 className="section-band-title">Répartition par statut</h2>
              </div>
              <div className="space-y-2">
                {statusSeries.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="flex items-center gap-2">
                    <div className="w-32 text-xs text-muted truncate">{item.label}</div>
                    <div className="flex-1 h-2 bg-surface-alt border border-border-default rounded overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${(item.count / maxBar) * 100}%` }} />
                    </div>
                    <div className="w-10 text-right text-xs text-muted tabular-nums">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <div className="card p-3">
              <div className="section-band">
                <h2 className="section-band-title">Tickets par localisation</h2>
              </div>
              <div className="space-y-2">
                {locationSeries.length === 0 ? (
                  <p className="text-xs text-muted">Aucune donnée</p>
                ) : (
                  locationSeries.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="flex items-center gap-2">
                      <div className="w-40 text-xs text-muted truncate">{item.label}</div>
                      <div className="flex-1 h-2 bg-surface-alt border border-border-default rounded overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${(item.count / maxBar) * 100}%` }} />
                      </div>
                      <div className="w-10 text-right text-xs text-muted tabular-nums">{item.count}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card p-3">
              <div className="section-band">
                <h2 className="section-band-title">Tickets par équipe</h2>
              </div>
              <div className="space-y-2">
                {teamSeries.length === 0 ? (
                  <p className="text-xs text-muted">Aucune donnée</p>
                ) : (
                  teamSeries.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="flex items-center gap-2">
                      <div className="w-32 text-xs text-muted truncate">{item.label}</div>
                      <div className="flex-1 h-2 bg-surface-alt border border-border-default rounded overflow-hidden">
                        <div className="h-full bg-purple-500" style={{ width: `${(item.count / maxBar) * 100}%` }} />
                      </div>
                      <div className="w-10 text-right text-xs text-muted tabular-nums">{item.count}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <div className="card p-3">
              <div className="section-band">
                <h2 className="section-band-title">Équipements les plus problématiques (par site)</h2>
              </div>
              <div className="space-y-2">
                {equipmentSeries.length === 0 ? (
                  <p className="text-xs text-muted">Aucune donnée</p>
                ) : (
                  equipmentSeries.map((item, index) => (
                    <div key={`${item.site}-${item.label}-${index}`} className="flex items-center gap-2">
                      <div className="w-48 truncate">
                        <p className="text-xs text-foreground truncate">{item.label}</p>
                        <p className="text-[10px] text-muted truncate">{item.site}</p>
                      </div>
                      <div className="flex-1 h-2 bg-surface-alt border border-border-default rounded overflow-hidden">
                        <div className="h-full bg-rose-500" style={{ width: `${(item.count / maxBar) * 100}%` }} />
                      </div>
                      <div className="w-10 text-right text-xs text-muted tabular-nums">{item.count}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card p-3">
              <div className="section-band">
                <h2 className="section-band-title">Classement des sites par volume</h2>
              </div>
              <div className="max-h-64 overflow-y-auto border border-border-default rounded-xl">
                <table className="min-w-full">
                  <thead className="bg-surface-alt sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Rang</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Site</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-muted uppercase tracking-wide">Tickets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-default)]">
                    {locationRanking.map((item, index) => (
                      <tr key={`${item.label}-${index}`} className="hover:bg-surface-alt transition-colors duration-150 ease-out">
                        <td className="px-3 py-2 text-xs text-foreground tabular-nums">{index + 1}</td>
                        <td className="px-3 py-2 text-xs text-foreground truncate">{item.label}</td>
                        <td className="px-3 py-2 text-right text-xs text-foreground tabular-nums">{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <div className="card p-3">
              <div className="section-band">
                <h2 className="section-band-title">Performance par équipe (résolution)</h2>
              </div>
              <div className="max-h-64 overflow-y-auto border border-border-default rounded-xl">
                <table className="min-w-full">
                  <thead className="bg-surface-alt sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Équipe</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-muted uppercase tracking-wide">Tickets résolus</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-muted uppercase tracking-wide">Temps moyen (h)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-default)]">
                    {teamPerformanceSeries.length === 0 ? (
                      <tr><td className="px-3 py-2 text-xs text-muted" colSpan={3}>Aucune donnée</td></tr>
                    ) : (
                      teamPerformanceSeries.map((item, index) => (
                        <tr key={`${item.label}-${index}`} className="hover:bg-surface-alt transition-colors duration-150 ease-out">
                          <td className="px-3 py-2 text-xs text-foreground">{item.label}</td>
                          <td className="px-3 py-2 text-right text-xs text-foreground tabular-nums">{item.resolvedCount}</td>
                          <td className="px-3 py-2 text-right text-xs text-foreground tabular-nums">{item.avgHours.toFixed(1)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-3">
              <div className="section-band">
                <h2 className="section-band-title">Charge de travail par mainteneur</h2>
              </div>
              <div className="space-y-2">
                {maintainerLoadSeries.length === 0 ? (
                  <p className="text-xs text-muted">Aucune donnée (tickets ouverts assignés)</p>
                ) : (
                  maintainerLoadSeries.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="flex items-center gap-2">
                      <div className="w-40 text-xs text-foreground truncate">{item.label}</div>
                      <div className="flex-1 h-2 bg-surface-alt border border-border-default rounded overflow-hidden">
                        <div className="h-full bg-cyan-500" style={{ width: `${(item.count / maxBar) * 100}%` }} />
                      </div>
                      <div className="w-10 text-right text-xs text-muted tabular-nums">{item.count}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card p-3 mb-4">
            <div className="section-band">
              <h2 className="section-band-title">Backlog ouvert dans le temps</h2>
            </div>
            <div className="mt-3 h-20 flex items-end gap-1">
              {backlogBuckets.map((value, index) => (
                <div
                  key={`backlog-${index}`}
                  className="flex-1 min-w-[4px] bg-[color:var(--accent-2)] rounded-[2px]"
                  style={{ height: `${Math.max(6, (value / backlogMax) * 100)}%` }}
                  title={`${bucketMeta(backlogBucketSize, index)} : ${value}`}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
              <span>Min {backlogMin}</span>
              <span>Dernier {backlogLatest}</span>
              <span>Max {backlogMax}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <div className="card p-3">
              <div className="section-band">
                <h2 className="section-band-title">Top équipements en évolution</h2>
              </div>
              <div className="space-y-2">
                {equipmentSparkData.length === 0 ? (
                  <p className="text-xs text-muted">Aucune donnée</p>
                ) : (
                  equipmentSparkData.map((item, index) => {
                    const localMax = Math.max(1, ...item.buckets);
                    return (
                      <div key={`${item.id}-${index}`} className="border border-border-default rounded-xl p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs text-foreground">{item.label}</p>
                            <p className="text-[10px] text-muted">{item.site}</p>
                          </div>
                          <span className="text-xs text-foreground tabular-nums">{item.total}</span>
                        </div>
                        <div className="mt-2 h-10 flex items-end gap-0.5">
                          {item.buckets.map((value, bucketIndex) => (
                            <div
                              key={`${item.id}-bucket-${bucketIndex}`}
                              className="flex-1 min-w-[3px] bg-emerald-500/80 rounded-[2px]"
                              style={{ height: `${Math.max(4, (value / localMax) * 100)}%` }}
                              title={`${bucketMeta(item.bucketSize, bucketIndex)} : ${value}`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="card p-3">
              <div className="section-band">
                <h2 className="section-band-title">Top localisations en évolution</h2>
              </div>
              <div className="space-y-2">
                {locationSparkData.length === 0 ? (
                  <p className="text-xs text-muted">Aucune donnée</p>
                ) : (
                  locationSparkData.map((item, index) => {
                    const localMax = Math.max(1, ...item.buckets);
                    return (
                      <div key={`${item.id}-${index}`} className="border border-border-default rounded-xl p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-foreground">{item.label}</p>
                          <span className="text-xs text-foreground tabular-nums">{item.total}</span>
                        </div>
                        <div className="mt-2 h-10 flex items-end gap-0.5">
                          {item.buckets.map((value, bucketIndex) => (
                            <div
                              key={`${item.id}-bucket-${bucketIndex}`}
                              className="flex-1 min-w-[3px] bg-cyan-500/80 rounded-[2px]"
                              style={{ height: `${Math.max(4, (value / localMax) * 100)}%` }}
                              title={`${bucketMeta(item.bucketSize, bucketIndex)} : ${value}`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="card p-3">
            <div className="section-band">
              <h2 className="section-band-title">Tendance (tickets créés par jour)</h2>
            </div>
            {trendSeries.length === 0 ? (
              <p className="text-xs text-muted">Aucune donnée sur la période.</p>
            ) : (
              <>
                {/* Graphe d'aire (SVG inline, sans dépendance) */}
                {(() => {
                  const w = 900;
                  const h = 160;
                  const pad = 6;
                  const n = trendSeries.length;
                  const max = Math.max(1, ...trendSeries.map((row) => row.count));
                  const x = (i: number) => (n <= 1 ? pad : pad + (i / (n - 1)) * (w - pad * 2));
                  const y = (v: number) => h - pad - (v / max) * (h - 28);
                  const line = trendSeries
                    .map((row, i) => `${x(i).toFixed(1)},${y(row.count).toFixed(1)}`)
                    .join(' ');
                  const areaPts = `${x(0).toFixed(1)},${h - pad} ${line} ${x(n - 1).toFixed(1)},${h - pad}`;
                  return (
                    <svg
                      viewBox={`0 0 ${w} ${h}`}
                      preserveAspectRatio="none"
                      className="w-full h-40"
                      role="img"
                      aria-label={`Tendance des tickets créés par jour, maximum ${max} sur une journée`}
                    >
                      <defs>
                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.25" />
                          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polygon points={areaPts} fill="url(#trendGrad)" />
                      <polyline
                        points={line}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  );
                })()}
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted tabular-nums">
                  <span>{new Date(trendSeries[0].dayKey).toLocaleDateString('fr-FR')}</span>
                  <span className="text-foreground font-medium">
                    {trendSeries.reduce((acc, row) => acc + row.count, 0).toLocaleString('fr-FR')} tickets sur la période
                  </span>
                  <span>{new Date(trendSeries[trendSeries.length - 1].dayKey).toLocaleDateString('fr-FR')}</span>
                </div>
                {/* Alternative accessible : tableau détaillé repliable */}
                <details className="mt-2">
                  <summary className="text-[11px] text-muted cursor-pointer transition-colors hover:text-foreground">
                    Voir le détail par jour
                  </summary>
                  <div className="mt-2 max-h-64 overflow-y-auto border border-border-default rounded-xl">
                    <table className="min-w-full">
                      <thead className="bg-surface-alt sticky top-0">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Date</th>
                          <th className="px-3 py-1.5 text-right text-xs font-medium text-muted uppercase tracking-wide">Tickets</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--border-default)]">
                        {trendSeries
                          .filter((row) => row.count > 0)
                          .map((row) => (
                            <tr key={row.dayKey} className="hover:bg-surface-alt transition-colors duration-150 ease-out">
                              <td className="px-3 py-2 text-xs text-foreground">{new Date(row.dayKey).toLocaleDateString('fr-FR')}</td>
                              <td className="px-3 py-2 text-right text-xs text-foreground tabular-nums">{row.count}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
            <div className="mt-3">
              <div className="section-band">
                <h3 className="section-band-title">Pics d&apos;incidents détectés</h3>
              </div>
              {incidentPeaks.length === 0 ? (
                <p className="text-xs text-muted">Aucun pic notable sur la période.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {incidentPeaks.map((peak) => (
                    <span
                      key={peak.dayKey}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-[color:var(--accent)] bg-[#e8513b]/10 text-[color:var(--accent)]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                        <path d="M12 9v4" />
                        <path d="M12 17h.01" />
                      </svg>
                      {new Date(peak.dayKey).toLocaleDateString('fr-FR')}:
                      <span className="tabular-nums">{peak.count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
