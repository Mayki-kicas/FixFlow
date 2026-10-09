import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { getAssignableTechnicians } from '@/lib/actions/technicians';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { startOfWeekUtc, addDaysUtc, ymdUtc, parseYmdUtc } from '@/lib/planning-core';
import { PRIORITY_META } from '@/lib/priority';

type PlanTicket = {
  id: string;
  ticketNumber: number;
  title: string;
  priority: string;
  nature: string;
  interventionStartAt: Date | null;
  dueDate: Date | null;
  assigneeId: string | null;
};

const NATURE_LETTER: Record<string, string> = { CORRECTIVE: 'C', IMPROVEMENT: 'A', PREVENTIVE: 'P' };

function TicketChip({ t }: { t: { id: string; ticketNumber: number; title: string; priority: string; nature: string } }) {
  const color = (PRIORITY_META[t.priority as keyof typeof PRIORITY_META] || PRIORITY_META.P2).color;
  return (
    <Link
      href={`/tickets/${t.id}`}
      className="block rounded border border-border-default bg-surface px-1.5 py-1 text-[11px] hover:border-[color:var(--accent)]"
      style={{ borderLeft: `3px solid ${color}` }}
      title={t.title}
    >
      <span className="font-semibold tabular-nums text-foreground">#{t.ticketNumber}</span>
      <span className="ml-1 text-[9px] text-muted">{NATURE_LETTER[t.nature] ?? 'C'}</span>
      <span className="block truncate text-muted">{t.title}</span>
    </Link>
  );
}

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const sp = await searchParams;
  const weekStart = startOfWeekUtc(parseYmdUtc(sp.start) ?? new Date());
  const weekEnd = addDaysUtc(weekStart, 7);
  const days = Array.from({ length: 7 }, (_, i) => addDaysUtc(weekStart, i));
  const todayYmd = ymdUtc(new Date());

  const [weekTickets, technicians, toPlan, criticalCount] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        isArchived: false,
        status: { isFinal: false },
        OR: [
          { interventionStartAt: { gte: weekStart, lt: weekEnd } },
          { interventionStartAt: null, dueDate: { gte: weekStart, lt: weekEnd } },
        ],
      },
      select: { id: true, ticketNumber: true, title: true, priority: true, nature: true, interventionStartAt: true, dueDate: true, assigneeId: true },
      orderBy: [{ priority: 'asc' }],
    }),
    getAssignableTechnicians(),
    prisma.ticket.findMany({
      where: { isArchived: false, status: { isFinal: false }, interventionStartAt: null, dueDate: null },
      select: { id: true, ticketNumber: true, title: true, priority: true, nature: true, assignee: { select: { displayName: true } } },
      orderBy: [{ priority: 'asc' }, { openedAt: 'asc' }],
      take: 40,
    }),
    getVisibleCriticalTicketsCountForUser(user),
  ]);

  // Bucket : assigné -> jour -> tickets.
  const byAssignee = new Map<string, Map<string, PlanTicket[]>>();
  for (const t of weekTickets) {
    const key = t.assigneeId ?? '__unassigned__';
    const planned = t.interventionStartAt ?? t.dueDate;
    if (!planned) continue;
    const day = ymdUtc(planned);
    let m = byAssignee.get(key);
    if (!m) {
      m = new Map();
      byAssignee.set(key, m);
    }
    const arr = m.get(day) ?? [];
    arr.push(t);
    m.set(day, arr);
  }

  const rows: { id: string; name: string; map: Map<string, PlanTicket[]>; count: number }[] = [];
  for (const tech of technicians) {
    const m = byAssignee.get(tech.id);
    if (m) rows.push({ id: tech.id, name: tech.displayName, map: m, count: weekTickets.filter((t) => t.assigneeId === tech.id).length });
  }
  const unassigned = byAssignee.get('__unassigned__');
  if (unassigned) rows.push({ id: '__unassigned__', name: 'Non affecté', map: unassigned, count: weekTickets.filter((t) => !t.assigneeId).length });

  const prevStart = ymdUtc(addDaysUtc(weekStart, -7));
  const nextStart = ymdUtc(addDaysUtc(weekStart, 7));
  const fmtDayHead = (d: Date) => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(d);

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
                <h1 className="page-toolbar-title">Planification</h1>
                <span className="page-toolbar-subtitle tabular-nums">
                  Semaine du {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', timeZone: 'UTC' }).format(weekStart)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Link href={`/backoffice/planning?start=${prevStart}`} className="rounded border border-border-default px-2 py-1 text-xs text-muted hover:text-foreground">← Semaine</Link>
                <Link href="/backoffice/planning" className="rounded border border-border-default px-2 py-1 text-xs text-muted hover:text-foreground">Aujourd&apos;hui</Link>
                <Link href={`/backoffice/planning?start=${nextStart}`} className="rounded border border-border-default px-2 py-1 text-xs text-muted hover:text-foreground">Semaine →</Link>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
          {/* Grille planning */}
          <div className="card overflow-hidden">
            <div className="card-head"><span className="card-head-title">Dispatch par technicien</span></div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-surface-alt">
                    <th className="sticky left-0 z-10 bg-surface-alt px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">Technicien</th>
                    {days.map((d) => (
                      <th key={ymdUtc(d)} className={`min-w-[130px] px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide ${ymdUtc(d) === todayYmd ? 'text-[color:var(--accent)]' : 'text-muted'}`}>
                        {fmtDayHead(d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted">Aucune intervention planifiée cette semaine.</td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="border-t border-border-default align-top">
                        <td className="sticky left-0 z-10 bg-surface px-2 py-2 align-top">
                          <div className="text-xs font-medium text-foreground">{row.name}</div>
                          <div className="text-[10px] text-muted tabular-nums">{row.count} OT</div>
                        </td>
                        {days.map((d) => {
                          const list = row.map.get(ymdUtc(d)) ?? [];
                          return (
                            <td key={ymdUtc(d)} className={`px-1.5 py-1.5 align-top ${ymdUtc(d) === todayYmd ? 'bg-[#e8513b]/5' : ''}`}>
                              <div className="space-y-1">
                                {list.map((t) => <TicketChip key={t.id} t={t} />)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="px-3 py-2 text-[10px] text-muted">
              Date de planification = début de chantier, sinon échéance (préventif). C = correctif · A = amélioratif · P = préventif.
            </p>
          </div>

          {/* À planifier */}
          <div className="card">
            <div className="card-head">
              <span className="card-head-title">À planifier</span>
              <span className="badge badge-neutral">{toPlan.length}</span>
            </div>
            <div className="p-2">
              {toPlan.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted">Tous les OT ouverts ont une date.</p>
              ) : (
                <ul className="divide-y divide-[color:var(--border-default)]">
                  {toPlan.map((t) => (
                    <li key={t.id}>
                      <Link href={`/tickets/${t.id}`} className="flex items-center gap-2 px-1.5 py-1.5 hover:bg-surface-alt rounded">
                        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: (PRIORITY_META[t.priority as keyof typeof PRIORITY_META] || PRIORITY_META.P2).color }} />
                        <span className="text-[11px] font-semibold text-accent tabular-nums flex-shrink-0">#{t.ticketNumber}</span>
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">{t.title}</span>
                        <span className="flex-shrink-0 text-[10px] text-muted">{t.assignee?.displayName ?? 'Non affecté'}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
