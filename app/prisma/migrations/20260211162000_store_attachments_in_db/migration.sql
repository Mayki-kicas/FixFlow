-- Store attachment binaries in PostgreSQL
ALTER TABLE "Attachment"
  ADD COLUMN "fileName" TEXT,
  ADD COLUMN "contentType" TEXT,
  ADD COLUMN "content" BYTEA;
