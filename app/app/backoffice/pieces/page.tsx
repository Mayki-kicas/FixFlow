import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import { getParts } from '@/lib/actions/parts';
import { isLowStock } from '@/lib/parts-core';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import PartsManager from '@/components/PartsManager';

export default async function PartsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const [parts, criticalCount] = await Promise.all([
    getParts(),
    getVisibleCriticalTicketsCountForUser(user),
  ]);
  const low = parts.filter((p) => isLowStock(p.stockQty, p.reorderPoint)).length;

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
                <h1 className="page-toolbar-title">Pièces &amp; stock</h1>
                <span className="page-toolbar-subtitle tabular-nums">
                  {parts.length} pièce(s){low > 0 ? ` · ${low} sous seuil` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <PartsManager parts={parts} />
        </div>
      </div>
    </>
  );
}
