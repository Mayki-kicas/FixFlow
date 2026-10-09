import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { getAppConfig } from '@/lib/app-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import {
  meanTimeToRepairHours,
  meanTimeBetweenFailuresHours,
  preventiveCompliance,
  availabilityEstimate,
  formatHours,
} from '@/lib/reliability-core';
import { computeTicketCost, formatEuros } from '@/lib/costs-core';
import { PRIORITY_META } from '@/lib/priority';

const PERIOD_DAYS = 365;

export default async function FiabilitePage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const now = Date.now();
  const periodStart = new Date(now - PERIOD_DAYS * 24 * 3_600_000);
  const periodMs = now - periodStart.getTime();

  const [corrective, preventive, backlogOpen, backlogByPriorityRaw, workLogs, costLines, appConfig, criticalCount] =
    await Promise.all([
      prisma.ticket.findMany({
        where: { nature: 'CORRECTIVE', openedAt: { gte: periodStart } },
        select: { openedAt: true, closedAt: true, equipmentId: true, equipment: { select: { name: true, refCode: true } } },
      }),
      prisma.ticket.findMany({
        where: { nature: 'PREVENTIVE', openedAt: { gte: periodStart } },
        select: { closedAt: true, dueDate: true },
      }),
      prisma.ticket.count({ where: { isArchived: false, status: { isFinal: false } } }),
      prisma.ticket.groupBy({
        by: ['priority'],
        where: { isArchived: false, status: { isFinal: false } },
        _count: { _all: true },
      }),
      prisma.workLog.findMany({
        where: { ticket: { openedAt: { gte: periodStart } } },
        select: { minutes: true, ticket: { select: { equipmentId: true } } },
      }),
      prisma.costLine.findMany({
        where: { ticket: { openedAt: { gte: periodStart } } },
        select: { amountCents: true, quantity: true, ticket: { select: { equipmentId: true } } },
      }),
      getAppConfig(),
      getVisibleCriticalTicketsCountForUser(user),
    ]);

  // --- KPI globaux ---
  const mttrGlobal = meanTimeToRepairHours(corrective);
  const pm = preventiveCompliance(preventive);

  // --- Top codes panne (correctifs de la période) ---
  const failureCodeCounts = await prisma.ticket.groupBy({
    by: ['failureCodeId'],
    where: { nature: 'CORRECTIVE', openedAt: { gte: periodStart }, failureCodeId: { not: null } },
    _count: { _all: true },
  });
  const codeLabels = failureCodeCounts.length
    ? await prisma.failureCode.findMany({
        where: { id: { in: failureCodeCounts.map((c) => c.failureCodeId).filter((x): x is string => !!x) } },
        select: { id: true, label: true },
      })
    : [];
  const labelById = new Map(codeLabels.map((c) => [c.id, c.label]));
  const topFailureCodes = failureCodeCounts
    .map((c) => ({ label: labelById.get(c.failureCodeId ?? '') ?? '—', count: c._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // --- Coût par équipement (période) ---
  const minutesByEq = new Map<string, number>();
  for (const w of workLogs) {
    const id = w.ticket.equipmentId;
    minutesByEq.set(id, (minutesByEq.get(id) ?? 0) + w.minutes);
  }
  const linesByEq = new Map<string, number>();
  for (const l of costLines) {
    const id = l.ticket.equipmentId;
    linesByEq.set(id, (linesByEq.get(id) ?? 0) + l.amountCents * l.quantity);
  }

  // --- Agrégat par équipement (correctifs) ---
  type EqAgg = { id: string; name: string; refCode: string; opened: Date[]; closed: { openedAt: Date; closedAt: Date }[] };
  const byEq = new Map<string, EqAgg>();
  for (const t of corrective) {
    if (!t.equipmentId) continue;
    let a = byEq.get(t.equipmentId);
    if (!a) {
      a = { id: t.equipmentId, name: t.equipment.name, refCode: t.equipment.refCode, opened: [], closed: [] };
      byEq.set(t.equipmentId, a);
    }
    a.opened.push(t.openedAt);
    if (t.closedAt) a.closed.push({ openedAt: t.openedAt, closedAt: t.closedAt });
  }

  const rows = [...byEq.values()]
    .map((a) => {
      const laborMinutes = minutesByEq.get(a.id) ?? 0;
      const cost = computeTicketCost({
        workLogMinutes: laborMinutes,
        laborRateCents: appConfig.laborRateCents,
        costLines: [{ amountCents: linesByEq.get(a.id) ?? 0, quantity: 1 }],
      });
      return {
        id: a.id,
        name: a.name,
        refCode: a.refCode,
        failures: a.opened.length,
        mttr: meanTimeToRepairHours(a.closed),
        mtbf: meanTimeBetweenFailuresHours(a.opened),
        availability: availabilityEstimate(a.closed, periodMs),
        costCents: cost.totalCents,
      };
    })
    .sort((x, y) => y.failures - x.failures)
    .slice(0, 20);

  const backlogByPriority = backlogByPriorityRaw
    .map((b) => ({ priority: b.priority, count: b._count._all }))
    .sort((a, b) => a.priority.localeCompare(b.priority));

  const kpis = [
    { label: 'MTTR correctif', value: formatHours(mttrGlobal) },
    { label: 'Respect préventif', value: pm.rate == null ? '—' : `${Math.round(pm.rate * 100)} %`, hint: `${pm.onTime}/${pm.total}` },
    { label: 'Backlog (OT ouverts)', value: String(backlogOpen) },
    { label: 'Correctifs (12 mois)', value: String(corrective.length) },
  ];

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
                <h1 className="page-toolbar-title">Fiabilité (GMAO)</h1>
                <span className="page-toolbar-subtitle">12 derniers mois</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
          {/* KPI globaux */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="stat-tile">
                <p className="stat-label">{k.label}</p>
                <p className="stat-value tabular-nums">{k.value}</p>
                {k.hint && <p className="text-[10px] text-muted tabular-nums">{k.hint}</p>}
              </div>
            ))}
          </div>

          {/* Backlog par priorité */}
          <div className="card">
            <div className="card-head"><span className="card-head-title">Backlog par priorité</span></div>
            <div className="flex flex-wrap gap-2 p-3">
              {backlogByPriority.length === 0 ? (
                <span className="text-xs text-muted">Aucun OT ouvert.</span>
              ) : (
                backlogByPriority.map((b) => {
                  const meta = PRIORITY_META[b.priority] || PRIORITY_META.P2;
                  return (
                    <span
                      key={b.priority}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold tabular-nums"
                      style={{ color: meta.color, backgroundColor: meta.color + '1a' }}
                    >
                      {meta.short} · {b.count}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {/* Top codes panne */}
          {topFailureCodes.length > 0 && (
            <div className="card">
              <div className="card-head"><span className="card-head-title">Top codes panne</span></div>
              <ul className="divide-y divide-[color:var(--border-default)]">
                {topFailureCodes.map((c, i) => (
                  <li key={i} className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-xs text-foreground">{c.label}</span>
                    <span className="text-xs font-medium text-foreground tabular-nums">{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Par équipement */}
          <div className="card overflow-hidden">
            <div className="card-head">
              <span className="card-head-title">Par équipement (top pannes)</span>
              <span className="badge badge-neutral">{rows.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[color:var(--border-default)]">
                <thead className="bg-surface-alt">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted">Équipement</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-muted">Pannes</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-muted">MTTR</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-muted">MTBF</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-muted">Dispo. est.</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-muted">Coût</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-default)]">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">Aucun correctif sur la période.</td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-alt">
                        <td className="px-3 py-2">
                          <Link href={`/backoffice/equipments/${r.id}`} className="text-xs font-medium text-foreground hover:text-[color:var(--accent)]">
                            {r.name}
                          </Link>
                          <span className="ml-1 font-mono text-[10px] text-muted">{r.refCode}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{r.failures}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-muted">{formatHours(r.mttr)}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-muted">{formatHours(r.mtbf)}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-muted">
                          {r.availability == null ? '—' : `${Math.round(r.availability * 100)} %`}
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{formatEuros(r.costCents)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="px-3 py-2 text-[10px] text-muted">
              Disponibilité estimée à partir du temps d&apos;ouverture des OT correctifs (indicateur).
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
