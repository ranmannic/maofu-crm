-- CreateTable
CREATE TABLE "SalesCommissionRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "productSpecId" TEXT,
    "channelId" TEXT,
    "salesId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'PERCENT',
    "value" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesCommissionRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalesCommissionRule_productSpecId_fkey" FOREIGN KEY ("productSpecId") REFERENCES "ProductSpec" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalesCommissionRule_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ChannelType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SalesCommissionRule_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SalesCommissionRule_productId_idx" ON "SalesCommissionRule"("productId");

-- CreateIndex
CREATE INDEX "SalesCommissionRule_productSpecId_idx" ON "SalesCommissionRule"("productSpecId");

-- CreateIndex
CREATE INDEX "SalesCommissionRule_channelId_idx" ON "SalesCommissionRule"("channelId");

-- CreateIndex
CREATE INDEX "SalesCommissionRule_salesId_idx" ON "SalesCommissionRule"("salesId");
