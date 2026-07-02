-- Wine + material inventory, spec stock basis, stock movement refactor
-- SQLite: disable FK checks while recreating ProductSpec / StockMovement

PRAGMA foreign_keys=OFF;

-- Clean up partial apply (safe no-ops on fresh DB)
DROP TABLE IF EXISTS "ProductSpecStockBasisLine";
DROP TABLE IF EXISTS "ProductSpec_new";
DROP TABLE IF EXISTS "ProductWineStock";
DROP TABLE IF EXISTS "Material";
DROP TABLE IF EXISTS "_migrate_wine_stock";

CREATE TABLE "_migrate_wine_stock" AS
SELECT
    "productId",
    COALESCE(SUM("stockQty" * "bottlesPerUnit"), 0) AS "bottleQty"
FROM "ProductSpec"
GROUP BY "productId";

CREATE TABLE "ProductWineStock" (
    "productId" TEXT NOT NULL PRIMARY KEY,
    "bottleQty" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductWineStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '个',
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ProductSpec_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitType" TEXT NOT NULL DEFAULT 'BOTTLE',
    "bottlesPerUnit" INTEGER NOT NULL DEFAULT 1,
    "price" REAL NOT NULL,
    "cost" REAL NOT NULL DEFAULT 0,
    "retailGuidePrice" REAL,
    "retailFloorPrice" REAL,
    "groupGuidePrice" REAL,
    "groupFloorPrice" REAL,
    "wholesaleGuidePrice" REAL,
    "wholesaleFloorPrice" REAL,
    "description" TEXT,
    "thumbnailKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductSpec_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "ProductSpec_new" (
    "id", "productId", "name", "unitType", "bottlesPerUnit", "price", "cost",
    "retailGuidePrice", "retailFloorPrice", "groupGuidePrice", "groupFloorPrice",
    "wholesaleGuidePrice", "wholesaleFloorPrice", "description", "thumbnailKey",
    "createdAt", "updatedAt"
)
SELECT
    "id", "productId", "name", "unitType", "bottlesPerUnit", "price", "cost",
    "retailGuidePrice", "retailFloorPrice", "groupGuidePrice", "groupFloorPrice",
    "wholesaleGuidePrice", "wholesaleFloorPrice", "description", "thumbnailKey",
    "createdAt", "updatedAt"
FROM "ProductSpec";

DROP TABLE "ProductSpec";
ALTER TABLE "ProductSpec_new" RENAME TO "ProductSpec";

INSERT INTO "ProductWineStock" ("productId", "bottleQty", "lowStockThreshold", "updatedAt")
SELECT m."productId", m."bottleQty", 0, CURRENT_TIMESTAMP
FROM "_migrate_wine_stock" m;

INSERT INTO "ProductWineStock" ("productId", "bottleQty", "lowStockThreshold", "updatedAt")
SELECT p."id", 0, 0, CURRENT_TIMESTAMP
FROM "Product" p
WHERE NOT EXISTS (
    SELECT 1 FROM "ProductWineStock" w WHERE w."productId" = p."id"
);

DROP TABLE "_migrate_wine_stock";

CREATE TABLE "ProductSpecStockBasisLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productSpecId" TEXT NOT NULL,
    "lineType" TEXT NOT NULL,
    "materialId" TEXT,
    "wineProductId" TEXT,
    "quantity" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductSpecStockBasisLine_productSpecId_fkey" FOREIGN KEY ("productSpecId") REFERENCES "ProductSpec" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductSpecStockBasisLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProductSpecStockBasisLine_productSpecId_sortOrder_idx" ON "ProductSpecStockBasisLine"("productSpecId", "sortOrder");

INSERT INTO "ProductSpecStockBasisLine" ("id", "productSpecId", "lineType", "materialId", "wineProductId", "quantity", "sortOrder")
SELECT
    'basis_' || ps."id",
    ps."id",
    'WINE',
    NULL,
    ps."productId",
    ps."bottlesPerUnit",
    0
FROM "ProductSpec" ps;

CREATE TABLE "StockMovement_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolType" TEXT NOT NULL,
    "productId" TEXT,
    "materialId" TEXT,
    "productSpecId" TEXT,
    "delta" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "StockMovement_new_productId_createdAt_idx" ON "StockMovement_new"("productId", "createdAt");
CREATE INDEX "StockMovement_new_materialId_createdAt_idx" ON "StockMovement_new"("materialId", "createdAt");
CREATE INDEX "StockMovement_new_orderId_idx" ON "StockMovement_new"("orderId");

DROP TABLE "StockMovement";
ALTER TABLE "StockMovement_new" RENAME TO "StockMovement";

PRAGMA foreign_keys=ON;
