-- App edition settings and product spec inventory
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "edition" TEXT NOT NULL DEFAULT 'STANDARD',
    "premiumTrialStartedAt" DATETIME,
    "premiumTrialEndsAt" DATETIME,
    "premiumSubscribedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT
);

INSERT INTO "AppSetting" ("id", "edition", "updatedAt") VALUES ('global', 'STANDARD', CURRENT_TIMESTAMP);

ALTER TABLE "ProductSpec" ADD COLUMN "stockQty" INTEGER NOT NULL DEFAULT 0;
