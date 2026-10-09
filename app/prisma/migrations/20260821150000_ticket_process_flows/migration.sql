-- Nature d'un ticket : correctif (SLA en heures) vs amélioratif (devis + priorité en jours).
CREATE TYPE "TicketNature" AS ENUM ('CORRECTIVE', 'IMPROVEMENT');
ALTER TABLE "Ticket" ADD COLUMN "nature" "TicketNature" NOT NULL DEFAULT 'CORRECTIVE';

-- SLA correctif (heures) par type d'intervention, porté par la catégorie d'équipement.
ALTER TABLE "EquipmentCategory" ADD COLUMN "correctiveSlaHours" INTEGER;

-- SLA de prise en charge (triage) + fenêtre d'intervention planifiée (chantier).
ALTER TABLE "Ticket" ADD COLUMN "firstResponseDueAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "firstRespondedAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "interventionStartAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "interventionEndAt" TIMESTAMP(3);

CREATE INDEX "Ticket_nature_idx" ON "Ticket"("nature");
CREATE INDEX "Ticket_firstResponseDueAt_idx" ON "Ticket"("firstResponseDueAt");

-- Réglages globaux éditables au backoffice (singleton).
CREATE TABLE "AppConfig" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "firstResponseHours" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);
