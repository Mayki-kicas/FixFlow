import { getCategories } from '@/lib/actions/categories';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import CategoryManager from '@/components/CategoryManager';

export default async function CategoriesPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const [categories, criticalCount, groups, users] = await Promise.all([
    getCategories(),
    prisma.ticket.count({ where: { priority: 'P1', isArchived: false } }),
    prisma.group.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        role: true,
      },
      orderBy: { displayName: 'asc' },
    }),
  ]);

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
                <h1 className="page-toolbar-title">Catégories d&apos;équipements</h1>
                <span className="page-toolbar-subtitle tabular-nums">{categories.length} catégorie(s) configurée(s)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="card p-4">
            <CategoryManager categories={categories} groups={groups} users={users} />
          </div>
        </div>
      </div>
    </>
  );
}
