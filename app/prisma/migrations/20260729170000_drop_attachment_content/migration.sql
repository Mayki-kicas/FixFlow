-- Bascule complète M4 : les binaires des pièces jointes ne sont plus stockés en base
-- (uniquement sur le stockage objet via storageKey). On supprime la colonne BYTEA.
ALTER TABLE "Attachment" DROP COLUMN IF EXISTS "content";
