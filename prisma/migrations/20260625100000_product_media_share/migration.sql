-- Product media, retail price tiers, share tokens
ALTER TABLE "Product" ADD COLUMN "thumbnailKey" TEXT;
ALTER TABLE "Product" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Product_shareToken_key" ON "Product"("shareToken");

CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

ALTER TABLE "ProductSpec" ADD COLUMN "retailGuidePrice" REAL;
ALTER TABLE "ProductSpec" ADD COLUMN "retailFloorPrice" REAL;
ALTER TABLE "ProductSpec" ADD COLUMN "groupGuidePrice" REAL;
ALTER TABLE "ProductSpec" ADD COLUMN "groupFloorPrice" REAL;
ALTER TABLE "ProductSpec" ADD COLUMN "wholesaleGuidePrice" REAL;
ALTER TABLE "ProductSpec" ADD COLUMN "wholesaleFloorPrice" REAL;

ALTER TABLE "Order" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Order_shareToken_key" ON "Order"("shareToken");
