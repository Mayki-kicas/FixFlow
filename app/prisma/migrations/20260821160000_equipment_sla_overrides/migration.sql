-- Surcharges SLA/priorité au niveau de l'équipement (écrasent la catégorie ; null = hérite).
ALTER TABLE "Equipment" ADD COLUMN "defaultPriority" "Priority";
ALTER TABLE "Equipment" ADD COLUMN "correctiveSlaHours" INTEGER;
ALTER TABLE "Equipment" ADD COLUMN "p1DelayDays" INTEGER;
ALTER TABLE "Equipment" ADD COLUMN "p2DelayDays" INTEGER;
ALTER TABLE "Equipment" ADD COLUMN "p3DelayDays" INTEGER;
