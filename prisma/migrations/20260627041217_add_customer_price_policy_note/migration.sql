-- CreateTable
CREATE TABLE "CustomerPricePolicyNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "productSpecId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerPricePolicyNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CustomerPricePolicyNote_customerId_idx" ON "CustomerPricePolicyNote"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPricePolicyNote_customerId_productSpecId_key" ON "CustomerPricePolicyNote"("customerId", "productSpecId");
