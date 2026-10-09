-- Codes de diagnostic (panne / cause / remède).
CREATE TYPE "FailureCodeType" AS ENUM ('FAILURE', 'CAUSE', 'REMEDY');

CREATE TABLE "FailureCode" (
  "id" TEXT NOT NULL,
  "type" "FailureCodeType" NOT NULL,
  "label" TEXT NOT NULL,
  CONSTRAINT "FailureCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FailureCode_type_label_key" ON "FailureCode"("type", "label");

ALTER TABLE "Ticket" ADD COLUMN "failureCodeId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "causeCodeId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "remedyCodeId" TEXT;
CREATE INDEX "Ticket_failureCodeId_idx" ON "Ticket"("failureCodeId");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_failureCodeId_fkey"
  FOREIGN KEY ("failureCodeId") REFERENCES "FailureCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_causeCodeId_fkey"
  FOREIGN KEY ("causeCodeId") REFERENCES "FailureCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_remedyCodeId_fkey"
  FOREIGN KEY ("remedyCodeId") REFERENCES "FailureCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
