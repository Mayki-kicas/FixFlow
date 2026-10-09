-- External maintainer app integration tables

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExternalDispatchStatus') THEN
    CREATE TYPE "ExternalDispatchStatus" AS ENUM ('PENDING', 'SENT', 'ACK', 'ERROR', 'CLOSED');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExternalFeedbackIngestionStatus') THEN
    CREATE TYPE "ExternalFeedbackIngestionStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'REJECTED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ExternalDispatch" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "maintainerId" TEXT NOT NULL,
  "phoneSnapshot" TEXT,
  "externalTicketId" TEXT,
  "status" "ExternalDispatchStatus" NOT NULL DEFAULT 'PENDING',
  "lastError" TEXT,
  "dispatchedByUserId" TEXT NOT NULL,
  "dispatchedAt" TIMESTAMP(3) NOT NULL,
  "ackedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalDispatch_externalTicketId_key" ON "ExternalDispatch"("externalTicketId");
CREATE INDEX IF NOT EXISTS "ExternalDispatch_ticketId_createdAt_idx" ON "ExternalDispatch"("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS "ExternalDispatch_maintainerId_createdAt_idx" ON "ExternalDispatch"("maintainerId", "createdAt");

CREATE TABLE IF NOT EXISTS "ExternalFeedbackEvent" (
  "id" TEXT NOT NULL,
  "dispatchId" TEXT NOT NULL,
  "externalMessageId" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "ingestionStatus" "ExternalFeedbackIngestionStatus" NOT NULL DEFAULT 'RECEIVED',
  "processedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalFeedbackEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalFeedbackEvent_externalMessageId_key" ON "ExternalFeedbackEvent"("externalMessageId");
CREATE INDEX IF NOT EXISTS "ExternalFeedbackEvent_dispatchId_createdAt_idx" ON "ExternalFeedbackEvent"("dispatchId", "createdAt");
CREATE INDEX IF NOT EXISTS "ExternalFeedbackEvent_ingestionStatus_createdAt_idx" ON "ExternalFeedbackEvent"("ingestionStatus", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ExternalDispatch_ticketId_fkey'
      AND table_name = 'ExternalDispatch'
  ) THEN
    ALTER TABLE "ExternalDispatch"
      ADD CONSTRAINT "ExternalDispatch_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ExternalDispatch_maintainerId_fkey'
      AND table_name = 'ExternalDispatch'
  ) THEN
    ALTER TABLE "ExternalDispatch"
      ADD CONSTRAINT "ExternalDispatch_maintainerId_fkey"
      FOREIGN KEY ("maintainerId") REFERENCES "Maintainer"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ExternalDispatch_dispatchedByUserId_fkey'
      AND table_name = 'ExternalDispatch'
  ) THEN
    ALTER TABLE "ExternalDispatch"
      ADD CONSTRAINT "ExternalDispatch_dispatchedByUserId_fkey"
      FOREIGN KEY ("dispatchedByUserId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ExternalFeedbackEvent_dispatchId_fkey'
      AND table_name = 'ExternalFeedbackEvent'
  ) THEN
    ALTER TABLE "ExternalFeedbackEvent"
      ADD CONSTRAINT "ExternalFeedbackEvent_dispatchId_fkey"
      FOREIGN KEY ("dispatchId") REFERENCES "ExternalDispatch"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
