-- Une demande (idée/suggestion) ne cible pas forcément un équipement : equipmentId devient
-- optionnel, et le lien passe en SET NULL. Le manager choisit l'équipement à la validation.
ALTER TABLE "Demande" DROP CONSTRAINT "Demande_equipmentId_fkey";
ALTER TABLE "Demande" ALTER COLUMN "equipmentId" DROP NOT NULL;
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
