import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import EquipmentForm from '@/components/EquipmentForm';

export default async function NewEquipmentPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const [locations, teams, categories, maintainers, parentOptions, criticalCount] = await Promise.all([
    prisma.location.findMany({ orderBy: { code: 'asc' } }),
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.equipmentCategory.findMany({ orderBy: { name: 'asc' } }),
    prisma.maintainer.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.equipment.findMany({ select: { id: true, name: true, refCode: true }, orderBy: { name: 'asc' } }),
    prisma.ticket.count({ where: { priority: 'P1', isArchived: false } }),
  ]);

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
                <h1 className="page-toolbar-title">Nouvel équipement</h1>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-white/90 dark:bg-[#121821]/80 border border-border-default rounded-xl p-4 backdrop-blur">
            <EquipmentForm locations={locations} teams={teams} categories={categories} maintainers={maintainers} parentOptions={parentOptions} />
          </div>
        </div>
      </div>
    </>
  );
}
