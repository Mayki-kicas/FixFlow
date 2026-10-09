-- Enums référentiel équipement.
CREATE TYPE "Criticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "EquipmentLifecycleStatus" AS ENUM ('IN_SERVICE', 'OUT_OF_SERVICE', 'RETIRED');
CREATE TYPE "EquipmentDocumentType" AS ENUM ('MANUAL', 'SCHEMA', 'CERTIFICATE', 'OTHER');

-- Champs référentiel sur Equipment.
ALTER TABLE "Equipment" ADD COLUMN "serialNumber" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "brand" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "model" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "commissionedAt" TIMESTAMP(3);
ALTER TABLE "Equipment" ADD COLUMN "warrantyUntil" TIMESTAMP(3);
ALTER TABLE "Equipment" ADD COLUMN "criticality" "Criticality" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Equipment" ADD COLUMN "lifecycleStatus" "EquipmentLifecycleStatus" NOT NULL DEFAULT 'IN_SERVICE';
ALTER TABLE "Equipment" ADD COLUMN "supplierId" TEXT;

CREATE INDEX "Equipment_criticality_idx" ON "Equipment"("criticality");
CREATE INDEX "Equipment_lifecycleStatus_idx" ON "Equipment"("lifecycleStatus");
CREATE INDEX "Equipment_supplierId_idx" ON "Equipment"("supplierId");
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Maintainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Documents d'équipement (manuel, schéma, certificat…).
CREATE TABLE "EquipmentDocument" (
  "id" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "type" "EquipmentDocumentType" NOT NULL DEFAULT 'OTHER',
  "label" TEXT,
  "expiryAt" TIMESTAMP(3),
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EquipmentDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EquipmentDocument_equipmentId_idx" ON "EquipmentDocument"("equipmentId");
CREATE INDEX "EquipmentDocument_expiryAt_idx" ON "EquipmentDocument"("expiryAt");
ALTER TABLE "EquipmentDocument" ADD CONSTRAINT "EquipmentDocument_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquipmentDocument" ADD CONSTRAINT "EquipmentDocument_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
