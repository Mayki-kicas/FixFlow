-- Add human-friendly incremental ticket number
CREATE SEQUENCE "Ticket_ticketNumber_seq";

ALTER TABLE "Ticket"
  ADD COLUMN "ticketNumber" INTEGER;

ALTER TABLE "Ticket"
  ALTER COLUMN "ticketNumber" SET DEFAULT nextval('"Ticket_ticketNumber_seq"');

UPDATE "Ticket"
SET "ticketNumber" = nextval('"Ticket_ticketNumber_seq"')
WHERE "ticketNumber" IS NULL;

ALTER TABLE "Ticket"
  ALTER COLUMN "ticketNumber" SET NOT NULL;

ALTER SEQUENCE "Ticket_ticketNumber_seq" OWNED BY "Ticket"."ticketNumber";

CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");
