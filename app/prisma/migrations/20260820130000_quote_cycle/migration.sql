-- Cycle du devis : modèle Quote (demandé -> reçu -> accepté/refusé) lié au ticket,
-- au mainteneur (prestataire) et au dispatch externe qui l'a demandé.

CREATE TYPE "QuoteStatus" AS ENUM ('REQUESTED', 'RECEIVED', 'ACCEPTED', 'REJECTED');

CREATE TABLE "Quote" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "maintainerId" TEXT,
  "dispatchId" TEXT,
  "status" "QuoteStatus" NOT NULL DEFAULT 'REQUESTED',
  "reference" TEXT,
  "amountCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "externalQuoteId" TEXT,
  "fileStorageKey" TEXT,
  "fileName" TEXT,
  "contentType" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedAt" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "decidedByUserId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Quote_externalQuoteId_key" ON "Quote"("externalQuoteId");
CREATE INDEX "Quote_ticketId_createdAt_idx" ON "Quote"("ticketId", "createdAt");
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

ALTER TABLE "Quote" ADD CONSTRAINT "Quote_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_maintainerId_fkey"
  FOREIGN KEY ("maintainerId") REFERENCES "Maintainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_dispatchId_fkey"
  FOREIGN KEY ("dispatchId") REFERENCES "ExternalDispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
