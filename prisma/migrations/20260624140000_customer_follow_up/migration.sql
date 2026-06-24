-- Customer follow-up management

ALTER TABLE "Customer" ADD COLUMN "followUpStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Customer" ADD COLUMN "abandonedAt" DATETIME;
ALTER TABLE "Customer" ADD COLUMN "abandonReason" TEXT;

CREATE TABLE "CustomerFollowUpRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "followedAt" DATETIME NOT NULL,
    "content" TEXT NOT NULL,
    "nextPlan" TEXT,
    "nextFollowUpAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerFollowUpRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CustomerFollowUpRecord_customerId_followedAt_idx" ON "CustomerFollowUpRecord"("customerId", "followedAt");
CREATE INDEX "CustomerFollowUpRecord_nextFollowUpAt_idx" ON "CustomerFollowUpRecord"("nextFollowUpAt");
