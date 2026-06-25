-- Product attributes and spec-level thumbnail/description
ALTER TABLE "Product" ADD COLUMN "alcoholContent" TEXT;
ALTER TABLE "Product" ADD COLUMN "aromaType" TEXT;
ALTER TABLE "Product" ADD COLUMN "origin" TEXT;

ALTER TABLE "ProductSpec" ADD COLUMN "description" TEXT;
ALTER TABLE "ProductSpec" ADD COLUMN "thumbnailKey" TEXT;
