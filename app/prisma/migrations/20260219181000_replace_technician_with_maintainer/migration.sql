DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole'
      AND e.enumlabel = 'TECHNICIAN'
  ) THEN
    ALTER TYPE "UserRole" RENAME VALUE 'TECHNICIAN' TO 'MAINTAINER';
  END IF;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

ALTER TABLE "Maintainer"
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Maintainer_email_key" ON "Maintainer"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Maintainer_userId_key" ON "Maintainer"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Maintainer_userId_fkey'
      AND table_name = 'Maintainer'
  ) THEN
    ALTER TABLE "Maintainer"
      ADD CONSTRAINT "Maintainer_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
