-- Managers responsables d'un site : ils valident les demandes rattachées à ce site.
-- Relation many-to-many implicite Prisma (User <-> Location, "LocationManagers").
CREATE TABLE "_LocationManagers" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_LocationManagers_AB_unique" ON "_LocationManagers"("A", "B");
CREATE INDEX "_LocationManagers_B_index" ON "_LocationManagers"("B");
ALTER TABLE "_LocationManagers" ADD CONSTRAINT "_LocationManagers_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_LocationManagers" ADD CONSTRAINT "_LocationManagers_B_fkey"
  FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
