-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SalesCommissionRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "isGlobalDefault" BOOLEAN NOT NULL DEFAULT false,
    "productId" TEXT,
    "productSpecId" TEXT,
    "appliesToAllSales" BOOLEAN NOT NULL DEFAULT true,
    "kind" TEXT NOT NULL DEFAULT 'PERCENT',
    "value" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesCommissionRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalesCommissionRule_productSpecId_fkey" FOREIGN KEY ("productSpecId") REFERENCES "ProductSpec" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SalesCommissionRule" ("appliesToAllSales", "createdAt", "id", "isGlobalDefault", "kind", "productId", "productSpecId", "updatedAt", "value") SELECT "appliesToAllSales", "createdAt", "id", false, "kind", "productId", "productSpecId", "updatedAt", "value" FROM "SalesCommissionRule";
DROP TABLE "SalesCommissionRule";
ALTER TABLE "new_SalesCommissionRule" RENAME TO "SalesCommissionRule";
CREATE INDEX "SalesCommissionRule_productId_idx" ON "SalesCommissionRule"("productId");
CREATE INDEX "SalesCommissionRule_productSpecId_idx" ON "SalesCommissionRule"("productSpecId");
CREATE INDEX "SalesCommissionRule_isGlobalDefault_idx" ON "SalesCommissionRule"("isGlobalDefault");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- 全局默认规则：所有产品 · 全部规格 · 全部销售 · 3%
INSERT INTO "SalesCommissionRule" (
    "id",
    "isGlobalDefault",
    "productId",
    "productSpecId",
    "appliesToAllSales",
    "kind",
    "value",
    "createdAt",
    "updatedAt"
)
SELECT
    'global-commission-default',
    true,
    NULL,
    NULL,
    true,
    'PERCENT',
    3,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "SalesCommissionRule" WHERE "isGlobalDefault" = true
);
