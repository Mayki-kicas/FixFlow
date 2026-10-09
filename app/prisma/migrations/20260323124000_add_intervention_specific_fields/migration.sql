ALTER TABLE "IncidentReport"
  ALTER COLUMN "subject" DROP NOT NULL,
  ALTER COLUMN "description" DROP NOT NULL;

ALTER TABLE "IncidentReport"
  ADD COLUMN IF NOT EXISTS "company" TEXT,
  ADD COLUMN IF NOT EXISTS "interventionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "requestedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "intervenedBy" TEXT;
