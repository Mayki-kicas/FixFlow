-- Pièces détachées / magasin (stock unique).
CREATE TYPE "StockMovementReason" AS ENUM ('ENTRY', 'CONSUMPTION', 'ADJUSTMENT', 'RETURN');

CREATE TABLE "Part" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT,
  "unitPriceCents" INTEGER,
  "stockQty" INTEGER NOT NULL DEFAULT 0,
  "reorderPoint" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Part_reference_key" ON "Part"("reference");
CREATE INDEX "Part_reference_idx" ON "Part"("reference");

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "partId" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" "StockMovementReason" NOT NULL,
  "ticketId" TEXT,
  "byUserId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockMovement_partId_createdAt_idx" ON "StockMovement"("partId", "createdAt");
CREATE INDEX "StockMovement_ticketId_idx" ON "StockMovement"("ticketId");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_partId_fkey"
  FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_byUserId_fkey"
  FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
