-- Configuration SMTP (singleton)
CREATE TABLE "EmailConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "host" TEXT,
    "port" INTEGER,
    "security" TEXT NOT NULL DEFAULT 'STARTTLS',
    "username" TEXT,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "EmailConfig" ("id", "updatedAt") VALUES ('singleton', NOW());
