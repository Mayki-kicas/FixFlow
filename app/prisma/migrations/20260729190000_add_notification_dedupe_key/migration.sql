-- Dé-duplication des notifications (rappels d'échéance) via clé dédiée indexée,
-- au lieu d'un LIKE non indexé sur le titre.
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
CREATE INDEX IF NOT EXISTS "Notification_type_dedupeKey_idx" ON "Notification" ("type", "dedupeKey");
