-- Align Location table with current Prisma schema
ALTER TABLE "Location"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "email" TEXT;

-- Backfill existing rows to satisfy NOT NULL + UNIQUE constraint on code
UPDATE "Location"
SET "code" = 'LEGACY-' || SUBSTRING("id" FROM 1 FOR 8)
WHERE "code" IS NULL;

ALTER TABLE "Location"
  ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");
