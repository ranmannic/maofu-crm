-- Soft delete for products and specs (preserve order/commission/inventory references)

ALTER TABLE "Product" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "ProductSpec" ADD COLUMN "deletedAt" DATETIME;

CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");
CREATE INDEX "ProductSpec_deletedAt_idx" ON "ProductSpec"("deletedAt");
