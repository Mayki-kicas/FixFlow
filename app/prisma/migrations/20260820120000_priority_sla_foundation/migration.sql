-- Priorité (P1/P2/P3) remplaçant l'ancienne urgence, + SLA par catégorie d'équipement,
-- échéance devis, et historique des changements de priorité. Migration data-safe.

-- 1) Nouveau type Priorité
CREATE TYPE "Priority" AS ENUM ('P1', 'P2', 'P3');

-- 2) SLA + priorité par défaut sur la catégorie d'équipement
ALTER TABLE "EquipmentCategory"
  ADD COLUMN "defaultPriority" "Priority" NOT NULL DEFAULT 'P2',
  ADD COLUMN "p1DelayDays" INTEGER DEFAULT 3,
  ADD COLUMN "p2DelayDays" INTEGER DEFAULT 7,
  ADD COLUMN "p3DelayDays" INTEGER;

-- 3) Ticket : ajout priority, backfill depuis urgency, puis suppression d'urgency
ALTER TABLE "Ticket" ADD COLUMN "priority" "Priority";
UPDATE "Ticket" SET "priority" = (
  CASE "urgency"
    WHEN 'CRITICAL' THEN 'P1'
    WHEN 'HIGH'     THEN 'P1'
    WHEN 'MEDIUM'   THEN 'P2'
    WHEN 'LOW'      THEN 'P3'
    ELSE 'P2'
  END
)::"Priority";
ALTER TABLE "Ticket" ALTER COLUMN "priority" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "priority" SET DEFAULT 'P2';

-- 4) Échéance devis
ALTER TABLE "Ticket" ADD COLUMN "quoteDeadline" TIMESTAMP(3);

-- Backfill de l'échéance pour les tickets existants (openedAt + délai catégorie selon priorité)
UPDATE "Ticket" t
SET "quoteDeadline" = t."openedAt" + make_interval(days => (
  CASE t."priority"
    WHEN 'P1' THEN c."p1DelayDays"
    WHEN 'P2' THEN c."p2DelayDays"
    WHEN 'P3' THEN c."p3DelayDays"
  END
))
FROM "Equipment" e
JOIN "EquipmentCategory" c ON c."id" = e."categoryId"
WHERE e."id" = t."equipmentId"
  AND (CASE t."priority"
        WHEN 'P1' THEN c."p1DelayDays"
        WHEN 'P2' THEN c."p2DelayDays"
        WHEN 'P3' THEN c."p3DelayDays"
      END) IS NOT NULL;

-- 5) Suppression de l'ancienne urgence
DROP INDEX IF EXISTS "Ticket_urgency_idx";
ALTER TABLE "Ticket" DROP COLUMN "urgency";
DROP TYPE "TicketUrgency";

-- 6) Index sur les nouveaux champs
CREATE INDEX "Ticket_priority_idx" ON "Ticket"("priority");
CREATE INDEX "Ticket_quoteDeadline_idx" ON "Ticket"("quoteDeadline");

-- 7) Historique des changements de priorité
CREATE TABLE "PriorityChange" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "changedById" TEXT NOT NULL,
  "fromPriority" "Priority",
  "toPriority" "Priority" NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriorityChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PriorityChange_ticketId_createdAt_idx" ON "PriorityChange"("ticketId", "createdAt");
CREATE INDEX "PriorityChange_changedById_idx" ON "PriorityChange"("changedById");
ALTER TABLE "PriorityChange" ADD CONSTRAINT "PriorityChange_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriorityChange" ADD CONSTRAINT "PriorityChange_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
