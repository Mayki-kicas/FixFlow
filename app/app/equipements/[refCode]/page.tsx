import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import EquipmentTicketsPanel from '@/components/EquipmentTicketsPanel';

const CRITICALITY_LABEL: Record<string, string> = { LOW: 'Basse', MEDIUM: 'Moyenne', HIGH: 'Haute', CRITICAL: 'Critique' };
const LIFECYCLE_LABEL: Record<string, string> = { IN_SERVICE: 'En service', OUT_OF_SERVICE: 'Hors service', RETIRED: 'Réformé' };

// Page « terrain » ouverte en scannant le QR d'un équipement. Accessible à tout
// utilisateur authentifié ; les tickets affichés respectent sa visibilité.
export default async function EquipmentScanPage({ params }: { params: Promise<{ refCode: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');

  const { refCode } = await params;
  const equipment = await prisma.equipment.findUnique({
    where: { refCode: decodeURIComponent(refCode) },
    select: {
      id: true,
      name: true,
      refCode: true,
      criticality: true,
      lifecycleStatus: true,
      category: { select: { name: true } },
      location: { select: { name: true } },
    },
  });
  if (!equipment) notFound();

  const criticalCount = await getVisibleCriticalTicketsCountForUser(user);
  const isManager = user.role === 'ADMIN' || user.role === 'MANAGER';

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          <div className="card p-4">
            <h1 className="text-lg font-bold text-foreground">{equipment.name}</h1>
            <p className="mt-0.5 font-mono text-xs text-muted">{equipment.refCode}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>{equipment.category.name}</span>
              <span>· {equipment.location?.name || 'Global'}</span>
              <span>· Criticité {CRITICALITY_LABEL[equipment.criticality] ?? equipment.criticality}</span>
              <span>· {LIFECYCLE_LABEL[equipment.lifecycleStatus] ?? equipment.lifecycleStatus}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/tickets/new"
                className="rounded-lg bg-[color:var(--primary)] px-3 py-2 text-sm font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)]"
              >
                Déclarer un incident
              </Link>
              {isManager && (
                <Link
                  href={`/backoffice/equipments/${equipment.id}`}
                  className="rounded-lg border border-border-default px-3 py-2 text-sm font-medium text-muted hover:text-foreground"
                >
                  Fiche complète
                </Link>
              )}
            </div>
          </div>

          <EquipmentTicketsPanel equipmentId={equipment.id} canEdit={isManager} />
        </div>
      </div>
    </>
  );
}
