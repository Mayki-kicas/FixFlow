-- Technicien interne affecté à un OT.
ALTER TABLE "Ticket" ADD COLUMN "assigneeId" TEXT;
CREATE INDEX "Ticket_assigneeId_idx" ON "Ticket"("assigneeId");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Compétences / habilitations.
CREATE TABLE "Skill" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

CREATE TABLE "UserSkill" (
  "userId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("userId", "skillId")
);
CREATE INDEX "UserSkill_skillId_idx" ON "UserSkill"("skillId");
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_skillId_fkey"
  FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
