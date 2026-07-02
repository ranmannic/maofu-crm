-- WineStock with BOTTLE/LITER SKUs; wineSkuType on basis lines and movements

PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "WineStock";

CREATE TABLE "WineStock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "skuType" TEXT NOT NULL,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WineStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WineStock_productId_skuType_key" ON "WineStock"("productId", "skuType");
CREATE INDEX "WineStock_productId_idx" ON "WineStock"("productId");

INSERT INTO "WineStock" ("id", "productId", "skuType", "stockQty", "lowStockThreshold", "notes", "createdAt", "updatedAt")
SELECT
    'wstock_' || "productId" || '_BOTTLE',
    "productId",
    'BOTTLE',
    "bottleQty",
    "lowStockThreshold",
    NULL,
    CURRENT_TIMESTAMP,
    "updatedAt"
FROM "ProductWineStock";

DROP TABLE "ProductWineStock";

CREATE TABLE "ProductSpecStockBasisLine_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productSpecId" TEXT NOT NULL,
    "lineType" TEXT NOT NULL,
    "materialId" TEXT,
    "wineProductId" TEXT,
    "wineSkuType" TEXT,
    "quantity" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductSpecStockBasisLine_productSpecId_fkey" FOREIGN KEY ("productSpecId") REFERENCES "ProductSpec" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductSpecStockBasisLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "ProductSpecStockBasisLine_new" (
    "id", "productSpecId", "lineType", "materialId", "wineProductId", "wineSkuType", "quantity", "sortOrder"
)
SELECT
    "id", "productSpecId", "lineType", "materialId", "wineProductId", 'BOTTLE', "quantity", "sortOrder"
FROM "ProductSpecStockBasisLine";

DROP TABLE "ProductSpecStockBasisLine";
ALTER TABLE "ProductSpecStockBasisLine_new" RENAME TO "ProductSpecStockBasisLine";
CREATE INDEX "ProductSpecStockBasisLine_productSpecId_sortOrder_idx" ON "ProductSpecStockBasisLine"("productSpecId", "sortOrder");

CREATE TABLE "StockMovement_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolType" TEXT NOT NULL,
    "productId" TEXT,
    "materialId" TEXT,
    "wineSkuType" TEXT,
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

INSERT INTO "StockMovement_new" (
    "id", "poolType", "productId", "materialId", "wineSkuType", "productSpecId",
    "delta", "stockAfter", "reason", "notes", "orderId", "orderItemId", "userId", "userName", "createdAt"
)
SELECT
    "id", "poolType", "productId", "materialId",
    CASE WHEN "poolType" = 'WINE' THEN 'BOTTLE' ELSE NULL END,
    "productSpecId", "delta", "stockAfter", "reason", "notes", "orderId", "orderItemId", "userId", "userName", "createdAt"
FROM "StockMovement";

DROP TABLE "StockMovement";
ALTER TABLE "StockMovement_new" RENAME TO "StockMovement";
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");
CREATE INDEX "StockMovement_materialId_createdAt_idx" ON "StockMovement"("materialId", "createdAt");
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

PRAGMA foreign_keys=ON;
