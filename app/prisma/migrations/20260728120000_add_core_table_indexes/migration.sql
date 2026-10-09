-- Ajout d'index sur les tables cœur (Ticket / ChatMessage / Attachment).
-- Les colonnes ci-dessous sont utilisées en permanence dans les where/orderBy/groupBy
-- (listes, kanban, recherche, stats) et n'avaient aucun index → scans séquentiels.
-- CREATE INDEX IF NOT EXISTS pour rester idempotent (cohérent avec les migrations récentes).

-- Ticket
CREATE INDEX IF NOT EXISTS "Ticket_teamId_isArchived_statusId_idx" ON "Ticket" ("teamId", "isArchived", "statusId");
CREATE INDEX IF NOT EXISTS "Ticket_requesterId_idx" ON "Ticket" ("requesterId");
CREATE INDEX IF NOT EXISTS "Ticket_equipmentId_idx" ON "Ticket" ("equipmentId");
CREATE INDEX IF NOT EXISTS "Ticket_locationId_idx" ON "Ticket" ("locationId");
CREATE INDEX IF NOT EXISTS "Ticket_maintainerId_idx" ON "Ticket" ("maintainerId");
CREATE INDEX IF NOT EXISTS "Ticket_statusId_idx" ON "Ticket" ("statusId");
CREATE INDEX IF NOT EXISTS "Ticket_urgency_idx" ON "Ticket" ("urgency");
CREATE INDEX IF NOT EXISTS "Ticket_dueDate_idx" ON "Ticket" ("dueDate");
CREATE INDEX IF NOT EXISTS "Ticket_createdAt_idx" ON "Ticket" ("createdAt");

-- ChatMessage
CREATE INDEX IF NOT EXISTS "ChatMessage_ticketId_createdAt_idx" ON "ChatMessage" ("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_authorId_idx" ON "ChatMessage" ("authorId");

-- Attachment
CREATE INDEX IF NOT EXISTS "Attachment_ticketId_idx" ON "Attachment" ("ticketId");
CREATE INDEX IF NOT EXISTS "Attachment_chatMessageId_idx" ON "Attachment" ("chatMessageId");
CREATE INDEX IF NOT EXISTS "Attachment_uploadedById_idx" ON "Attachment" ("uploadedById");
