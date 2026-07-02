-- Redefine tables to support decimal liter quantities (e.g. 0.75L per unit)
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_WineStock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "skuType" TEXT NOT NULL,
    "stockQty" REAL NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WineStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WineStock" ("id", "productId", "skuType", "stockQty", "lowStockThreshold", "notes", "createdAt", "updatedAt")
SELECT "id", "productId", "skuType", "stockQty", "lowStockThreshold", "notes", "createdAt", "updatedAt" FROM "WineStock";
DROP TABLE "WineStock";
ALTER TABLE "new_WineStock" RENAME TO "WineStock";
CREATE UNIQUE INDEX "WineStock_productId_skuType_key" ON "WineStock"("productId", "skuType");
CREATE INDEX "WineStock_productId_idx" ON "WineStock"("productId");

CREATE TABLE "new_ProductSpecStockBasisLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productSpecId" TEXT NOT NULL,
    "lineType" TEXT NOT NULL,
    "materialId" TEXT,
    "wineProductId" TEXT,
    "wineSkuType" TEXT,
    "quantity" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductSpecStockBasisLine_productSpecId_fkey" FOREIGN KEY ("productSpecId") REFERENCES "ProductSpec" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductSpecStockBasisLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductSpecStockBasisLine" ("id", "productSpecId", "lineType", "materialId", "wineProductId", "wineSkuType", "quantity", "sortOrder")
SELECT "id", "productSpecId", "lineType", "materialId", "wineProductId", "wineSkuType", "quantity", "sortOrder" FROM "ProductSpecStockBasisLine";
DROP TABLE "ProductSpecStockBasisLine";
ALTER TABLE "new_ProductSpecStockBasisLine" RENAME TO "ProductSpecStockBasisLine";
CREATE INDEX "ProductSpecStockBasisLine_productSpecId_sortOrder_idx" ON "ProductSpecStockBasisLine"("productSpecId", "sortOrder");

CREATE TABLE "new_StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolType" TEXT NOT NULL,
    "productId" TEXT,
    "materialId" TEXT,
    "wineSkuType" TEXT,
    "productSpecId" TEXT,
    "delta" REAL NOT NULL,
    "stockAfter" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_StockMovement" ("id", "poolType", "productId", "materialId", "wineSkuType", "productSpecId", "delta", "stockAfter", "reason", "notes", "orderId", "orderItemId", "userId", "userName", "createdAt")
SELECT "id", "poolType", "productId", "materialId", "wineSkuType", "productSpecId", "delta", "stockAfter", "reason", "notes", "orderId", "orderItemId", "userId", "userName", "createdAt" FROM "StockMovement";
DROP TABLE "StockMovement";
ALTER TABLE "new_StockMovement" RENAME TO "StockMovement";
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");
CREATE INDEX "StockMovement_materialId_createdAt_idx" ON "StockMovement"("materialId", "createdAt");
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

PRAGMA foreign_keys=ON;
