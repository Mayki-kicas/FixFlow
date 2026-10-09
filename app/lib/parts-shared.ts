// Helpers « pièces » purs, sans aucune dépendance serveur (prisma, email, crypto).
// À importer depuis les composants client — ne jamais y ajouter d'import server-only,
// sous peine de réintroduire node:crypto dans le bundle navigateur.

// Pièce au/sous le seuil de réapprovisionnement (pure, testable).
export function isLowStock(stockQty: number, reorderPoint: number | null | undefined): boolean {
  return reorderPoint != null && stockQty <= reorderPoint;
}
