-- CreateEnum
-- SQLite: ShippingMethod stored as TEXT

-- CreateTable
CREATE TABLE "CustomerShippingAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "province" TEXT,
    "city" TEXT,
    "county" TEXT,
    "address" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerShippingAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "ShippingInfo" ADD COLUMN "method" TEXT;
ALTER TABLE "ShippingInfo" ADD COLUMN "recipientName" TEXT;
ALTER TABLE "ShippingInfo" ADD COLUMN "recipientPhone" TEXT;
ALTER TABLE "ShippingInfo" ADD COLUMN "province" TEXT;
ALTER TABLE "ShippingInfo" ADD COLUMN "city" TEXT;
ALTER TABLE "ShippingInfo" ADD COLUMN "county" TEXT;
ALTER TABLE "ShippingInfo" ADD COLUMN "customerAddressId" TEXT;

-- CreateIndex
CREATE INDEX "CustomerShippingAddress_customerId_isDefault_idx" ON "CustomerShippingAddress"("customerId", "isDefault");
