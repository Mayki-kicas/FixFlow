-- Nature préventive.
ALTER TYPE "TicketNature" ADD VALUE 'PREVENTIVE';

-- Lien OT -> plan de maintenance + check-list instanciée.
ALTER TABLE "Ticket" ADD COLUMN "maintenancePlanId" TEXT;
CREATE INDEX "Ticket_maintenancePlanId_idx" ON "Ticket"("maintenancePlanId");

CREATE TABLE "MaintenancePlan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "equipmentId" TEXT NOT NULL,
  "intervalDays" INTEGER NOT NULL,
  "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
  "isRegulatory" BOOLEAN NOT NULL DEFAULT false,
  "priority" "Priority",
  "teamId" TEXT,
  "maintainerId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "nextDueAt" TIMESTAMP(3) NOT NULL,
  "lastGeneratedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenancePlan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaintenancePlan_active_nextDueAt_idx" ON "MaintenancePlan"("active", "nextDueAt");
CREATE INDEX "MaintenancePlan_equipmentId_idx" ON "MaintenancePlan"("equipmentId");

CREATE TABLE "MaintenanceTask" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "MaintenanceTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaintenanceTask_planId_idx" ON "MaintenanceTask"("planId");

CREATE TABLE "TicketTask" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "doneByUserId" TEXT,
  "doneAt" TIMESTAMP(3),
  CONSTRAINT "TicketTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TicketTask_ticketId_idx" ON "TicketTask"("ticketId");

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_maintenancePlanId_fkey"
  FOREIGN KEY ("maintenancePlanId") REFERENCES "MaintenancePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_maintainerId_fkey"
  FOREIGN KEY ("maintainerId") REFERENCES "Maintainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "MaintenancePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketTask" ADD CONSTRAINT "TicketTask_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketTask" ADD CONSTRAINT "TicketTask_doneByUserId_fkey"
  FOREIGN KEY ("doneByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
