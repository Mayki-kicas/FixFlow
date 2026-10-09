-- Hiérarchie d'équipements.
ALTER TABLE "Equipment" ADD COLUMN "parentEquipmentId" TEXT;
CREATE INDEX "Equipment_parentEquipmentId_idx" ON "Equipment"("parentEquipmentId");
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_parentEquipmentId_fkey"
  FOREIGN KEY ("parentEquipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Compteurs.
CREATE TABLE "Meter" (
  "id" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Meter_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Meter_equipmentId_idx" ON "Meter"("equipmentId");
ALTER TABLE "Meter" ADD CONSTRAINT "Meter_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MeterReading" (
  "id" TEXT NOT NULL,
  "meterId" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "byUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MeterReading_meterId_readAt_idx" ON "MeterReading"("meterId", "readAt");
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_meterId_fkey"
  FOREIGN KEY ("meterId") REFERENCES "Meter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_byUserId_fkey"
  FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Préventif par compteur + champs calendaires rendus optionnels.
CREATE TYPE "MaintenancePlanTrigger" AS ENUM ('CALENDAR', 'METER');
ALTER TABLE "MaintenancePlan" ADD COLUMN "trigger" "MaintenancePlanTrigger" NOT NULL DEFAULT 'CALENDAR';
ALTER TABLE "MaintenancePlan" ADD COLUMN "meterId" TEXT;
ALTER TABLE "MaintenancePlan" ADD COLUMN "meterInterval" DOUBLE PRECISION;
ALTER TABLE "MaintenancePlan" ADD COLUMN "lastGeneratedMeterValue" DOUBLE PRECISION;
ALTER TABLE "MaintenancePlan" ALTER COLUMN "intervalDays" DROP NOT NULL;
ALTER TABLE "MaintenancePlan" ALTER COLUMN "nextDueAt" DROP NOT NULL;
CREATE INDEX "MaintenancePlan_meterId_idx" ON "MaintenancePlan"("meterId");
ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_meterId_fkey"
  FOREIGN KEY ("meterId") REFERENCES "Meter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
