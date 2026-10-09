-- Photo d'équipement : sortie du base64-en-base vers le stockage objet.
ALTER TABLE "Equipment" DROP COLUMN IF EXISTS "photoBase64";
ALTER TABLE "Equipment" ADD COLUMN IF NOT EXISTS "photoStorageKey" TEXT;
ALTER TABLE "Equipment" ADD COLUMN IF NOT EXISTS "photoContentType" TEXT;
