-- Temps & coûts par OT.
CREATE TYPE "CostLineType" AS ENUM ('PART', 'EXTERNAL', 'OTHER');

ALTER TABLE "AppConfig" ADD COLUMN "laborRateCents" INTEGER;

CREATE TABLE "WorkLog" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "minutes" INTEGER NOT NULL,
  "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkLog_ticketId_idx" ON "WorkLog"("ticketId");
CREATE INDEX "WorkLog_userId_idx" ON "WorkLog"("userId");
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CostLine" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "type" "CostLineType" NOT NULL DEFAULT 'OTHER',
  "label" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CostLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CostLine_ticketId_idx" ON "CostLine"("ticketId");
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
