-- Suivi des relances prestataire sur un devis (anti-spam / cadence).
ALTER TABLE "Quote"
  ADD COLUMN "lastRemindedAt" TIMESTAMP(3),
  ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;
