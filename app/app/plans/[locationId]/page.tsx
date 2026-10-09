import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import {
  getFloorPlansForLocation,
  getFloorPlanWithEquipments,
  getEquipmentsForLocationPlans,
} from '@/lib/actions/floor-plans';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import FloorPlanViewer from '@/components/FloorPlanViewer';
import FloorPlanManageBar from '@/components/FloorPlanManageBar';

export default async function LocationPlansPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ floor?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  const isManager = user.role === 'ADMIN' || user.role === 'MANAGER';

  const { locationId } = await params;
  const sp = await searchParams;

  const [location, plans, criticalCount] = await Promise.all([
    prisma.location.findUnique({ where: { id: locationId }, select: { id: true, name: true, code: true } }),
    getFloorPlansForLocation(locationId),
    getVisibleCriticalTicketsCountForUser(user),
  ]);
  if (!location) notFound();

  const selectedPlanId =
    sp.floor && plans.some((p) => p.id === sp.floor) ? sp.floor : plans[0]?.id ?? null;

  const [planData, locationEquipments] = await Promise.all([
    selectedPlanId ? getFloorPlanWithEquipments(selectedPlanId) : Promise.resolve(null),
    isManager ? getEquipmentsForLocationPlans(locationId) : Promise.resolve([]),
  ]);

  const currentPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <Link href="/plans" className="text-xs text-muted hover:text-foreground">
                  ← Plans
                </Link>
                <span className="text-border-default">|</span>
                <h1 className="page-toolbar-title">{location.name}</h1>
                <span className="page-toolbar-subtitle font-mono">{location.code}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-3">
          {/* Sélecteur d'étages */}
          {plans.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {plans.map((p) => (
                <Link
                  key={p.id}
                  href={`/plans/${locationId}?floor=${p.id}`}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    p.id === selectedPlanId
                      ? 'bg-[color:var(--primary)] text-[color:var(--surface)]'
                      : 'border border-border-default text-muted hover:text-foreground'
                  }`}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          )}

          {selectedPlanId && planData && currentPlan ? (
            <FloorPlanViewer
              planId={selectedPlanId}
              fileUrl={`/api/floor-plans/${selectedPlanId}/file`}
              contentType={planData.contentType}
              equipments={planData.placedEquipments}
              canEdit={isManager}
              locationEquipments={locationEquipments}
              locationId={locationId}
              currentPlan={{ id: currentPlan.id, name: currentPlan.name }}
            />
          ) : (
            <div className="card p-6 space-y-4">
              <p className="text-center text-sm text-muted">
                Aucun plan pour ce centre.
                {isManager && ' Ajoutez-en un ci-dessous (DWG, SVG, PDF ou image).'}
              </p>
              {isManager && <FloorPlanManageBar locationId={locationId} currentPlan={null} />}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
