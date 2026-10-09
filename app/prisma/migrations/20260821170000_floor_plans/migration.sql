-- Plans d'étage par centre + placement des équipements dessus.
CREATE TABLE "FloorPlan" (
  "id" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "dwgStorageKey" TEXT,
  "svgStorageKey" TEXT NOT NULL,
  "contentType" TEXT NOT NULL DEFAULT 'image/svg+xml',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FloorPlan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FloorPlan_locationId_order_idx" ON "FloorPlan"("locationId", "order");
ALTER TABLE "FloorPlan" ADD CONSTRAINT "FloorPlan_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Icône de marqueur par catégorie.
ALTER TABLE "EquipmentCategory" ADD COLUMN "icon" TEXT;

-- Placement d'un équipement sur un plan (coordonnées normalisées 0→1).
ALTER TABLE "Equipment" ADD COLUMN "floorPlanId" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "planX" DOUBLE PRECISION;
ALTER TABLE "Equipment" ADD COLUMN "planY" DOUBLE PRECISION;
CREATE INDEX "Equipment_floorPlanId_idx" ON "Equipment"("floorPlanId");
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_floorPlanId_fkey"
  FOREIGN KEY ("floorPlanId") REFERENCES "FloorPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
