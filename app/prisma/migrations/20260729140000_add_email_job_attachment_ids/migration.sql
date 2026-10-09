-- Emails de notification avec pièces jointes : on stocke les IDs des Attachment
-- pour les re-hydrater à l'envoi (file de retry au lieu d'un envoi synchrone).
ALTER TABLE "NotificationEmailJob" ADD COLUMN IF NOT EXISTS "attachmentIds" JSONB;
