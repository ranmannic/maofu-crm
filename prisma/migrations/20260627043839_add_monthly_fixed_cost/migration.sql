-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "edition" TEXT NOT NULL DEFAULT 'STANDARD',
    "premiumTrialStartedAt" DATETIME,
    "premiumTrialEndsAt" DATETIME,
    "premiumSubscribedAt" DATETIME,
    "monthlyFixedCost" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT
);
INSERT INTO "new_AppSetting" ("edition", "id", "premiumSubscribedAt", "premiumTrialEndsAt", "premiumTrialStartedAt", "updatedAt", "updatedById") SELECT "edition", "id", "premiumSubscribedAt", "premiumTrialEndsAt", "premiumTrialStartedAt", "updatedAt", "updatedById" FROM "AppSetting";
DROP TABLE "AppSetting";
ALTER TABLE "new_AppSetting" RENAME TO "AppSetting";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
