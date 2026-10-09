-- Sortie des pièces jointes du BYTEA : nouvelle colonne de clé de stockage objet.
-- `content` est conservé pour la lecture des anciennes PJ (fallback), puis pourra être
-- supprimé une fois toutes les PJ migrées sur disque.
ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
