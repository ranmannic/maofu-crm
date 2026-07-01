/*
  Warnings:

  - You are about to drop the column `channelId` on the `SalesCommissionRule` table. All the data in the column will be lost.
  - You are about to drop the column `salesId` on the `SalesCommissionRule` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "SalesCommissionRuleSales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "salesId" TEXT NOT NULL,
    CONSTRAINT "SalesCommissionRuleSales_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "SalesCommissionRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalesCommissionRuleSales_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 将旧版单 salesId 迁移到关联表（若线上曾配置过指定销售规则）
INSERT INTO "SalesCommissionRuleSales" ("id", "ruleId", "salesId")
SELECT
    lower(hex(randomblob(16))),
    "id",
    "salesId"
FROM "SalesCommissionRule"
WHERE "salesId" IS NOT NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SalesCommissionRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "productSpecId" TEXT,
    "appliesToAllSales" BOOLEAN NOT NULL DEFAULT true,
    "kind" TEXT NOT NULL DEFAULT 'PERCENT',
    "value" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesCommissionRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalesCommissionRule_productSpecId_fkey" FOREIGN KEY ("productSpecId") REFERENCES "ProductSpec" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SalesCommissionRule" (
    "createdAt",
    "id",
    "kind",
    "productId",
    "productSpecId",
    "updatedAt",
    "value",
    "appliesToAllSales"
)
SELECT
    "createdAt",
    "id",
    "kind",
    "productId",
    "productSpecId",
    "updatedAt",
    "value",
    CASE WHEN "salesId" IS NOT NULL THEN 0 ELSE 1 END
FROM "SalesCommissionRule";
DROP TABLE "SalesCommissionRule";
ALTER TABLE "new_SalesCommissionRule" RENAME TO "SalesCommissionRule";
CREATE INDEX "SalesCommissionRule_productId_idx" ON "SalesCommissionRule"("productId");
CREATE INDEX "SalesCommissionRule_productSpecId_idx" ON "SalesCommissionRule"("productSpecId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SalesCommissionRuleSales_salesId_idx" ON "SalesCommissionRuleSales"("salesId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesCommissionRuleSales_ruleId_salesId_key" ON "SalesCommissionRuleSales"("ruleId", "salesId");
