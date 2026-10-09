-- Enrichissement prestataire.
ALTER TABLE "Maintainer" ADD COLUMN "phone" TEXT;
ALTER TABLE "Maintainer" ADD COLUMN "specialties" TEXT;
ALTER TABLE "Maintainer" ADD COLUMN "notes" TEXT;

-- Contrats de maintenance.
CREATE TABLE "Contract" (
  "id" TEXT NOT NULL,
  "maintainerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scope" TEXT,
  "slaTerms" TEXT,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "costCents" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Contract_maintainerId_idx" ON "Contract"("maintainerId");
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_maintainerId_fkey"
  FOREIGN KEY ("maintainerId") REFERENCES "Maintainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
