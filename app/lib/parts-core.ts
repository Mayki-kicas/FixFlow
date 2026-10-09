import { prisma } from '@/lib/prisma';
import { createNotificationsForUsers } from '@/lib/notifications-core';
import { isLowStock } from '@/lib/parts-shared';

// Ré-export pour compat (serveur + tests). Les composants client DOIVENT importer
// depuis '@/lib/parts-shared' pour ne pas embarquer la chaîne serveur (email/node:crypto).
export { isLowStock };

// Alerte les managers des pièces au/sous le seuil de réappro (appelé par la tâche cron).
export async function notifyLowStockParts() {
  const parts = await prisma.part.findMany({
    where: { reorderPoint: { not: null } },
    select: { id: true, reference: true, name: true, stockQty: true, reorderPoint: true },
  });
  const low = parts.filter((p) => isLowStock(p.stockQty, p.reorderPoint));
  if (low.length === 0) return { lowStock: 0 };

  const recipients = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] } },
    select: { id: true },
  });
  const userIds = recipients.map((r) => r.id);
  if (userIds.length === 0) return { lowStock: 0 };

  for (const p of low) {
    await createNotificationsForUsers({
      userIds,
      type: 'SYSTEM',
      title: 'Stock bas',
      message: `${p.name} (${p.reference}) : ${p.stockQty} en stock (seuil ${p.reorderPoint})`,
      link: '/backoffice/pieces',
    });
  }
  return { lowStock: low.length };
}
