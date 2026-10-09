import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import EquipmentForm from '@/components/EquipmentForm';
import EquipmentDocumentsManager from '@/components/EquipmentDocumentsManager';
import MetersManager from '@/components/MetersManager';
import EquipmentQrCode from '@/components/EquipmentQrCode';
import { generateEquipmentQrDataUrl, equipmentScanUrl } from '@/lib/qr';
import { getAppConfig } from '@/lib/app-config';
import { computeTicketCost, formatEuros, formatMinutes } from '@/lib/costs-core';

export default async function EditEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const { id } = await params;

  const [equipment, locations, teams, categories, maintainers, documents, recentTickets, criticalCount] =
    await Promise.all([
      prisma.equipment.findUnique({
        where: { id },
        include: {
          parent: { select: { id: true, name: true, refCode: true } },
          children: { select: { id: true, name: true, refCode: true }, orderBy: { name: 'asc' } },
          meters: {
            orderBy: { name: 'asc' },
            select: { id: true, name: true, unit: true, readings: { orderBy: { readAt: 'desc' }, take: 1, select: { value: true, readAt: true } } },
          },
        },
      }),
      prisma.location.findMany({ orderBy: { code: 'asc' } }),
      prisma.team.findMany({ orderBy: { name: 'asc' } }),
      prisma.equipmentCategory.findMany({ orderBy: { name: 'asc' } }),
      prisma.maintainer.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.equipmentDocument.findMany({
        where: { equipmentId: id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, fileName: true, type: true, label: true, expiryAt: true, createdAt: true },
      }),
      prisma.ticket.findMany({
        where: { equipmentId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          nature: true,
          createdAt: true,
          closedAt: true,
          status: { select: { name: true, color: true } },
        },
      }),
      prisma.ticket.count({ where: { priority: 'P1', isArchived: false } }),
    ]);

  if (!equipment) {
    notFound();
  }

  // Coût cumulé de l'équipement (main d'œuvre valorisée + lignes de coût de ses OT).
  const [workLogAgg, costLinesForEq, appConfig, parentOptions] = await Promise.all([
    prisma.workLog.aggregate({ where: { ticket: { equipmentId: id } }, _sum: { minutes: true } }),
    prisma.costLine.findMany({ where: { ticket: { equipmentId: id } }, select: { amountCents: true, quantity: true } }),
    getAppConfig(),
    prisma.equipment.findMany({ where: { id: { not: id } }, select: { id: true, name: true, refCode: true }, orderBy: { name: 'asc' } }),
  ]);
  const totalMinutes = workLogAgg._sum.minutes ?? 0;
  const equipmentCost = computeTicketCost({
    workLogMinutes: totalMinutes,
    laborRateCents: appConfig.laborRateCents,
    costLines: costLinesForEq,
  });

  const qrDataUrl = await generateEquipmentQrDataUrl(equipment.refCode);
  const scanUrl = equipmentScanUrl(equipment.refCode);

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <Link href="/backoffice/equipments" className="text-xs text-muted hover:text-foreground transition-colors duration-150 ease-out">
                  ← Retour aux équipements
                </Link>
                <span className="text-border-default">|</span>
                <h1 className="page-toolbar-title">Modifier l&apos;équipement</h1>
                <span className="page-toolbar-subtitle tabular-nums">{equipment.refCode} - {equipment.name}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
            <EquipmentForm equipment={equipment} locations={locations} teams={teams} categories={categories} maintainers={maintainers} parentOptions={parentOptions} />
          </div>

          <div className="card">
            <div className="card-head"><span className="card-head-title">Documents</span></div>
            <div className="p-3">
              <EquipmentDocumentsManager equipmentId={equipment.id} documents={documents} />
            </div>
          </div>

          {/* Hiérarchie */}
          {(equipment.parent || equipment.children.length > 0) && (
            <div className="card">
              <div className="card-head"><span className="card-head-title">Hiérarchie</span></div>
              <div className="p-3 space-y-2">
                {equipment.parent && (
                  <div>
                    <span className="field-label">Parent</span>
                    <Link href={`/backoffice/equipments/${equipment.parent.id}`} className="block text-sm font-medium text-[color:var(--accent)] hover:opacity-80">
                      {equipment.parent.name} <span className="font-mono text-xs">({equipment.parent.refCode})</span>
                    </Link>
                  </div>
                )}
                {equipment.children.length > 0 && (
                  <div>
                    <span className="field-label">Sous-équipements ({equipment.children.length})</span>
                    <ul className="mt-0.5 space-y-0.5">
                      {equipment.children.map((c) => (
                        <li key={c.id}>
                          <Link href={`/backoffice/equipments/${c.id}`} className="text-xs text-foreground hover:text-[color:var(--accent)]">
                            {c.name} <span className="font-mono text-[10px] text-muted">({c.refCode})</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compteurs */}
          <div className="card">
            <div className="card-head"><span className="card-head-title">Compteurs</span></div>
            <div className="p-3">
              <MetersManager equipmentId={equipment.id} meters={equipment.meters} />
            </div>
          </div>

          {/* QR code */}
          <div className="card">
            <div className="card-head"><span className="card-head-title">QR code</span></div>
            <div className="p-3">
              <EquipmentQrCode dataUrl={qrDataUrl} scanUrl={scanUrl} refCode={equipment.refCode} name={equipment.name} />
              <p className="mt-2 text-[10px] text-muted">À coller sur l&apos;équipement : un scan ouvre sa page terrain (infos + tickets + déclaration).</p>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><span className="card-head-title">Coût cumulé</span></div>
            <div className="grid grid-cols-3 gap-2 p-3">
              <div className="stat-tile">
                <p className="stat-label">Total</p>
                <p className="stat-value text-base tabular-nums">{formatEuros(equipmentCost.totalCents)}</p>
              </div>
              <div className="stat-tile">
                <p className="stat-label">Main d&apos;œuvre</p>
                <p className="stat-value text-base tabular-nums">{formatMinutes(totalMinutes)}</p>
                {appConfig.laborRateCents != null && (
                  <p className="text-[10px] text-muted tabular-nums">{formatEuros(equipmentCost.laborCents)}</p>
                )}
              </div>
              <div className="stat-tile">
                <p className="stat-label">Pièces / externe</p>
                <p className="stat-value text-base tabular-nums">{formatEuros(equipmentCost.linesCents)}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="card-head-title">Historique des ordres de travail</span>
              <span className="badge badge-neutral">{recentTickets.length}</span>
            </div>
            <div className="p-2">
              {recentTickets.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted">Aucun ticket pour cet équipement.</p>
              ) : (
                <ul className="divide-y divide-[color:var(--border-default)]">
                  {recentTickets.map((t) => (
                    <li key={t.id}>
                      <Link href={`/tickets/${t.id}`} className="flex items-center gap-2 px-1.5 py-1.5 hover:bg-surface-alt rounded">
                        <span className="text-[11px] font-semibold text-accent tabular-nums flex-shrink-0">#{t.ticketNumber}</span>
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">{t.title}</span>
                        <span className="badge badge-neutral flex-shrink-0">{t.nature === 'IMPROVEMENT' ? 'Amélioration' : t.nature === 'PREVENTIVE' ? 'Préventif' : 'Correctif'}</span>
                        <span
                          className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ color: t.status.color || '#2f6f9e', backgroundColor: (t.status.color || '#2f6f9e') + '1a' }}
                        >
                          {t.status.name}
                        </span>
                        <span className="flex-shrink-0 text-[10px] text-muted tabular-nums">
                          {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                        </span>
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
