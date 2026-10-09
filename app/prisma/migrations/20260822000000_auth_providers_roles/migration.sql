-- Enum des méthodes d'authentification
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'LDAP', 'ENTRA');

-- User : nouvelles colonnes
ALTER TABLE "User" ADD COLUMN "entraId" TEXT;
ALTER TABLE "User" ADD COLUMN "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;

-- ldapId devient nullable (les comptes locaux / Entra n'en ont pas)
ALTER TABLE "User" ALTER COLUMN "ldapId" DROP NOT NULL;

-- Unicité de l'identifiant Entra
CREATE UNIQUE INDEX "User_entraId_key" ON "User"("entraId");

-- Grand-père : les comptes existants gardent leur accès.
-- Les comptes à mot de passe = locaux, les autres = LDAP.
UPDATE "User"
SET "authProvider" = CASE WHEN "passwordHash" IS NOT NULL THEN 'LOCAL'::"AuthProvider" ELSE 'LDAP'::"AuthProvider" END,
    "isActive" = true;

-- Configuration d'authentification (singleton)
CREATE TABLE "AuthConfig" (
    "id" TEXT NOT NULL,
    "activeProvider" "AuthProvider" NOT NULL DEFAULT 'LDAP',
    "ldapUrl" TEXT,
    "ldapSearchBase" TEXT,
    "ldapBindDn" TEXT,
    "entraTenantId" TEXT,
    "entraClientId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthConfig_pkey" PRIMARY KEY ("id")
);

-- Ligne singleton par défaut (LDAP actif)
INSERT INTO "AuthConfig" ("id", "activeProvider", "updatedAt") VALUES ('singleton', 'LDAP', NOW());
