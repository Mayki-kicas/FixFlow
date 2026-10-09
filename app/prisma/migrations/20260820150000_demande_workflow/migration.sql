-- Workflow Demande -> Ticket : une demande d'incident (BASIC+) validée ou rejetée
-- par un manager. La validation crée le ticket ; le rejet porte un motif.

CREATE TYPE "DemandeStatus" AS ENUM ('PENDING', 'CONVERTED', 'REJECTED');

CREATE TABLE "Demande" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "locationId" TEXT,
  "requesterId" TEXT NOT NULL,
  "status" "DemandeStatus" NOT NULL DEFAULT 'PENDING',
  "suggestedPriority" "Priority",
  "rejectionReason" TEXT,
  "decidedByUserId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "ticketId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Demande_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Demande_ticketId_key" ON "Demande"("ticketId");
CREATE INDEX "Demande_status_createdAt_idx" ON "Demande"("status", "createdAt");
CREATE INDEX "Demande_requesterId_idx" ON "Demande"("requesterId");
CREATE INDEX "Demande_equipmentId_idx" ON "Demande"("equipmentId");

ALTER TABLE "Demande" ADD CONSTRAINT "Demande_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Pièces jointes (photos) rattachables à une demande.
ALTER TABLE "Attachment" ADD COLUMN "demandeId" TEXT;
CREATE INDEX "Attachment_demandeId_idx" ON "Attachment"("demandeId");
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_demandeId_fkey"
  FOREIGN KEY ("demandeId") REFERENCES "Demande"("id") ON DELETE SET NULL ON UPDATE CASCADE;
