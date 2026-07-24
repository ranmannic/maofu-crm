-- Sales manager role and team hierarchy

-- SQLite stores Role as TEXT; new value SALES_MANAGER needs no ALTER on enum

ALTER TABLE "User" ADD COLUMN "salesTeamName" TEXT;
ALTER TABLE "User" ADD COLUMN "canViewCustomerContact" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "salesManagerId" TEXT;
CREATE INDEX "User_salesManagerId_idx" ON "User"("salesManagerId");
