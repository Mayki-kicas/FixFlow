-- Phase 8 advanced features: audit logs, notification prefs, async email jobs

-- Extend NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DUE_DATE_REMINDER';

-- Create EmailJobStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailJobStatus') THEN
    CREATE TYPE "EmailJobStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');
  END IF;
END
$$;

-- User notification preferences
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "notifyTicketCreated" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyStatusChanged" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyNewMessage" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyDueDate" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyEmailEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Async email queue
CREATE TABLE IF NOT EXISTS "NotificationEmailJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "toEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "html" TEXT,
  "status" "EmailJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "NotificationEmailJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NotificationEmailJob_status_createdAt_idx"
  ON "NotificationEmailJob"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationEmailJob_userId_createdAt_idx"
  ON "NotificationEmailJob"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'NotificationEmailJob_userId_fkey'
      AND table_name = 'NotificationEmailJob'
  ) THEN
    ALTER TABLE "NotificationEmailJob"
      ADD CONSTRAINT "NotificationEmailJob_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Audit logs
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "changes" JSONB,
  "actorId" TEXT NOT NULL,
  "ticketId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_createdAt_idx"
  ON "AuditLog"("entity", "entityId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx"
  ON "AuditLog"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_ticketId_createdAt_idx"
  ON "AuditLog"("ticketId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'AuditLog_actorId_fkey'
      AND table_name = 'AuditLog'
  ) THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'AuditLog_ticketId_fkey'
      AND table_name = 'AuditLog'
  ) THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
