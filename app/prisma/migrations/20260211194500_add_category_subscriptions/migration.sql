-- Subscriptions on equipment categories for groups and users
CREATE TABLE "GroupCategorySubscription" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupCategorySubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserCategorySubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCategorySubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GroupCategorySubscription_groupId_categoryId_key"
ON "GroupCategorySubscription"("groupId", "categoryId");

CREATE UNIQUE INDEX "UserCategorySubscription_userId_categoryId_key"
ON "UserCategorySubscription"("userId", "categoryId");

ALTER TABLE "GroupCategorySubscription"
ADD CONSTRAINT "GroupCategorySubscription_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupCategorySubscription"
ADD CONSTRAINT "GroupCategorySubscription_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "EquipmentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserCategorySubscription"
ADD CONSTRAINT "UserCategorySubscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserCategorySubscription"
ADD CONSTRAINT "UserCategorySubscription_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "EquipmentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
